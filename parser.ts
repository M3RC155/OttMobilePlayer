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

const toRawUrl = (url: string): string =>
    url.replace(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\//, 'https://raw.githubusercontent.com/$1/');

const fetchText = async (url: string): Promise<string> => {
    const res = await fetch(toRawUrl(url));
    if (!res.ok) throw new Error(`${res.status}`);
    return res.text();
};

const insertChannelBatch = async (db: any, batch: any[]) => {
    if (batch.length === 0) return;
    await db.withTransactionAsync(async () => {
        for (const ch of batch) {
            await db.runAsync(
                'INSERT INTO Channels (playlistId, name, streamUrl, logoUrl, tvgName, tvgId) VALUES (?, ?, ?, ?, ?, ?)',
                [ch.playlistId, ch.name, ch.streamUrl, ch.logoUrl, ch.tvgName, ch.tvgId]
            );
        }
    });
    await new Promise(resolve => setTimeout(resolve, 0));
};

export const parsePlaylistBackground = async (playlistId: number, url: string) => {
    if (url.includes('player_api.php')) {
        return parseXtreamBackground(playlistId, url);
    }

    try {
        const content = await fetchText(url);

        const lines = content.split('\n');
        const db = await initDb();

        let batch: any[] = [];
        let current: any = null;
        let count = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith('#EXTINF:')) {
                current = { playlistId, name: 'Unknown Channel', streamUrl: '', logoUrl: null, tvgName: null, tvgId: null };

                const commaIndex = line.indexOf(',');
                if (commaIndex !== -1) current.name = line.substring(commaIndex + 1).trim();

                const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
                if (tvgIdMatch) current.tvgId = tvgIdMatch[1];
                const tvgNameMatch = line.match(/tvg-name="([^"]+)"/);
                if (tvgNameMatch) current.tvgName = tvgNameMatch[1];
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                if (logoMatch) current.logoUrl = logoMatch[1];
            } else if (!line.startsWith('#')) {
                if (current) {
                    current.streamUrl = line;
                    batch.push(current);
                    current = null;
                    if (batch.length >= 500) {
                        count += batch.length;
                        await insertChannelBatch(db, batch);
                        batch = [];
                    }
                }
            }
        }

        count += batch.length;
        await insertChannelBatch(db, batch);

        await markPlaylistParsed(playlistId);
        await maybeParseEpg(playlistId, db);
    } catch (error: any) {
        console.error('Error parsing playlist:', error);
        await setPlaylistError(playlistId, getErrorMessage(error));
    }
};

const parseXtreamBackground = async (playlistId: number, apiUrl: string) => {
    try {
        const u = new URL(apiUrl);
        const base = `${u.protocol}//${u.host}`;
        const username = u.searchParams.get('username') || '';
        const password = u.searchParams.get('password') || '';
        const creds = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

        const fetchJson = async (action?: string) => {
            const target = action ? `${base}/player_api.php?${creds}&action=${action}` : `${base}/player_api.php?${creds}`;
            const res = await fetch(target);
            if (!res.ok) throw new Error(`${res.status}`);
            return res.json();
        };

        const auth = await fetchJson();
        if (!auth?.user_info || auth.user_info.auth !== 1) {
            throw new Error('Invalid credentials. Check username and password.');
        }

        const db = await initDb();

        const categoryName: Record<string, string> = {};
        try {
            const liveCats = await fetchJson('get_live_categories');
            const vodCats = await fetchJson('get_vod_categories');
            for (const c of [...(liveCats || []), ...(vodCats || [])]) {
                categoryName[String(c.category_id)] = c.category_name;
            }
        } catch (e) {
            console.warn('[Parser] Could not load Xtream categories, continuing without names', e);
        }

        let batch: any[] = [];
        const flush = async (force = false) => {
            if (batch.length >= 500 || (force && batch.length > 0)) {
                await insertChannelBatch(db, batch);
                batch = [];
            }
        };

        const liveStreams = await fetchJson('get_live_streams');
        for (const s of liveStreams || []) {
            batch.push({
                playlistId,
                name: s.name || 'Unknown Channel',
                streamUrl: `${base}/live/${username}/${password}/${s.stream_id}.ts`, // MPEGTS
                logoUrl: s.stream_icon || null,
                tvgName: categoryName[String(s.category_id)] || null,
                tvgId: s.epg_channel_id || null,
            });
            await flush();
        }

        const vodStreams = await fetchJson('get_vod_streams');
        for (const s of vodStreams || []) {
            const ext = s.container_extension || 'mp4';
            batch.push({
                playlistId,
                name: s.name || 'Unknown Movie',
                streamUrl: `${base}/movie/${username}/${password}/${s.stream_id}.${ext}`,
                logoUrl: s.stream_icon || null,
                tvgName: categoryName[String(s.category_id)] || null,
                tvgId: null,
            });
            await flush();
        }

        await flush(true);
        await markPlaylistParsed(playlistId);

        await maybeParseEpg(playlistId, db);
    } catch (error: any) {
        console.error('[Parser] Error importing Xtream:', error);
        await setPlaylistError(playlistId, getErrorMessage(error));
    }
};

const maybeParseEpg = async (playlistId: number, db: any) => {
    const playlistRows = await db.getAllAsync('SELECT epgUrl FROM Playlists WHERE id = ?', [playlistId]) as any[];
    if (playlistRows.length > 0 && playlistRows[0].epgUrl) {
        await parseEpgBackground(playlistId, playlistRows[0].epgUrl, db);
    }
};

const parseEpgBackground = async (playlistId: number, epgUrl: string, db: any) => {
    try {
        const content = await fetchText(epgUrl);

        const blocks = content.split('<programme ');

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
            batchPrograms = [];
            await new Promise(resolve => setTimeout(resolve, 0));
        };

        const unescapeXml = (safe: string) => safe
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

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
                if (batchPrograms.length >= 500) await processBatch();
            }
        }
        await processBatch();
    } catch (error: any) {
        console.error('[Parser] Error parsing EPG:', error);
    }
};
