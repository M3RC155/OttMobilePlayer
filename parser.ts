import { File, Paths } from 'expo-file-system';
import { initDb, setPlaylistError, markPlaylistParsed } from './db';

const getErrorMessage = (error: any): string => {
    const msg = error?.message || String(error);
    if (msg.includes('UnknownHostException') || msg.includes('Failed to connect') || msg.includes('No address associated')) {
        return 'Server unreachable. Please check the URL and your internet Connection.';
    }
    if (msg.includes('404')) {
        return 'File not found (404). Ensure the URL is correct.';
    }
    if (msg.includes('Network request failed') || msg.includes('SocketTimeoutException') || msg.includes('timeout')) {
        return 'Network connection timed out or failed.';
    }
    if (msg.includes('invalid format') || msg.includes('Unexpected token') || msg.includes('JSON')) {
        return 'Invalid file format received from server.';
    }

    return msg;
};

export const parsePlaylistBackground = async (playlistId: number, url: string) => {
    try {
        const playlistFile = new File(Paths.document, `playlist_${playlistId}.m3u`);
        console.log('Downloading playlist to', playlistFile.uri);

        // This will automatically throw if status is not 2xx
        await File.downloadFileAsync(url, playlistFile);
        console.log(`[Parser] Download finished successfully`);

        if (!playlistFile.exists) throw new Error('File not found after download');

        const content = await playlistFile.text();
        console.log(`[Parser] File read into memory, length: ${content.length} characters`);

        const lines = content.split('\n');
        console.log(`[Parser] Found ${lines.length} lines in playlist`);
        const db = await initDb();

        let batchChannels: any[] = [];
        const processBatch = async () => {
            if (batchChannels.length === 0) return;

            // Insert in transaction
            await db.withTransactionAsync(async () => {
                for (const ch of batchChannels) {
                    await db.runAsync(
                        'INSERT INTO Channels (playlistId, name, streamUrl, logoUrl, tvgName, tvgId) VALUES (?, ?, ?, ?, ?, ?)',
                        [playlistId, ch.name, ch.streamUrl, ch.logoUrl, ch.tvgName, ch.tvgId]
                    );
                }
            });
            console.log(`[Parser] Processed batch of ${batchChannels.length} channels`);
            batchChannels = [];
            // Yield to UI thread
            await new Promise(resolve => setTimeout(resolve, 0));
        };

        let currentChannel: any = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith('#EXTINF:')) {
                currentChannel = {
                    playlistId,
                    name: 'Unknown Channel',
                    streamUrl: '',
                    logoUrl: null,
                    tvgName: null,
                    tvgId: null
                };

                const commaIndex = line.indexOf(',');
                if (commaIndex !== -1) {
                    currentChannel.name = line.substring(commaIndex + 1).trim();
                }

                const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
                if (tvgIdMatch) currentChannel.tvgId = tvgIdMatch[1];

                const tvgNameMatch = line.match(/tvg-name="([^"]+)"/);
                if (tvgNameMatch) currentChannel.tvgName = tvgNameMatch[1];

                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                if (logoMatch) currentChannel.logoUrl = logoMatch[1];
            } else if (!line.startsWith('#')) {
                if (currentChannel) {
                    currentChannel.streamUrl = line;
                    batchChannels.push(currentChannel);
                    currentChannel = null;

                    if (batchChannels.length >= 500) {
                        await processBatch();
                    }
                }
            }
        }

        await processBatch();

        // Mark as parsed
        await markPlaylistParsed(playlistId);

        // Cleanup
        if (playlistFile.exists) {
            playlistFile.delete();
        }
        console.log(`[Parser] Finished parsing playlist ${playlistId} and cleaned up temp file.`);

        // Now handle EPG if present
        const playlistRows = await db.getAllAsync('SELECT epgUrl FROM Playlists WHERE id = ?', [playlistId]) as any[];
        if (playlistRows.length > 0 && playlistRows[0].epgUrl) {
            await parseEpgBackground(playlistId, playlistRows[0].epgUrl, db);
        }

    } catch (error: any) {
        console.error('Error parsing playlist:', error);
        await setPlaylistError(playlistId, getErrorMessage(error));
    }
};

const parseEpgBackground = async (playlistId: number, epgUrl: string, db: any) => {
    try {
        const epgFile = new File(Paths.document, `epg_${playlistId}.xml`);
        console.log('[Parser] Downloading EPG to', epgFile.uri);
        await File.downloadFileAsync(epgUrl, epgFile);
        if (!epgFile.exists) return;

        const content = await epgFile.text();
        console.log(`[Parser] EPG file read into memory, length: ${content.length} characters`);

        const blocks = content.split('<programme ');
        console.log(`[Parser] EPG found ${blocks.length - 1} programme blocks`);

        let batchPrograms: any[] = [];

        const processBatch = async () => {
            if (batchPrograms.length === 0) return;
            await db.withTransactionAsync(async () => {
                for (const p of batchPrograms) {
                    await db.runAsync(
                        'INSERT INTO Programs (playlistId, tvgId, title, description, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?)',
                        [playlistId, p.channel, p.title, p.desc, p.start, p.stop]
                    );
                }
            });
            console.log(`[Parser] Processed EPG batch of ${batchPrograms.length} programs`);
            batchPrograms = [];
            await new Promise(resolve => setTimeout(resolve, 0));
        };

        const unescapeXml = (safe: string) => {
            return safe.replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'");
        };

        for (let i = 1; i < blocks.length; i++) {
            const block = blocks[i];
            const startMatch = block.match(/start="([^"]+)"/);
            const stopMatch = block.match(/stop="([^"]+)"/);
            const channelMatch = block.match(/channel="([^"]+)"/);

            const titleMatch = block.match(/<title[^>]*>([^<]+)<\/title>/);
            const descMatch = block.match(/<desc[^>]*>([^<]+)<\/desc>/);

            if (channelMatch && startMatch && titleMatch) {
                batchPrograms.push({
                    channel: unescapeXml(channelMatch[1]),
                    start: unescapeXml(startMatch[1]),
                    stop: stopMatch ? unescapeXml(stopMatch[1]) : null,
                    title: unescapeXml(titleMatch[1]),
                    desc: descMatch ? unescapeXml(descMatch[1]) : ''
                });

                if (batchPrograms.length >= 500) {
                    await processBatch();
                }
            }
        }
        await processBatch();

        if (epgFile.exists) {
            epgFile.delete();
        }
        console.log(`[Parser] Finished parsing EPG for playlist ${playlistId}`);
    } catch (error: any) {
        console.error('[Parser] Error parsing EPG:', error);
        await setPlaylistError(playlistId, getErrorMessage(error));
    }
};
