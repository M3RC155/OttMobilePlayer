const http = require('http');

const PORT = 8082;

const TEST_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

const json = (res, body) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
};

const xmltvTime = (d) => d.getUTCFullYear()
    + String(d.getUTCMonth() + 1).padStart(2, '0')
    + String(d.getUTCDate()).padStart(2, '0')
    + String(d.getUTCHours()).padStart(2, '0')
    + String(d.getUTCMinutes()).padStart(2, '0')
    + '00 +0000';

const buildEpg = () => {
    const now = Date.now();
    const HOUR = 3600 * 1000;
    const shows = ['Morning News', 'The Midday Show', 'Afternoon Movie', 'Evening Talk', 'Late Night'];
    let programmes = '';
    for (let i = -1; i < shows.length; i++) {
        const start = xmltvTime(new Date(now + i * HOUR));
        const stop = xmltvTime(new Date(now + (i + 1) * HOUR));
        programmes += `  <programme start="${start}" stop="${stop}" channel="test.us">\n` +
            `    <title>${shows[i + 1] || 'Programming'}</title>\n` +
            `    <desc>Sample programme for the EPG demo.</desc>\n` +
            `  </programme>\n`;
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n` +
        `  <channel id="test.us"><display-name>Test Live Channel</display-name></channel>\n` +
        programmes + `</tv>\n`;
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');

    if (url.pathname === '/player_api.php') {
        console.log(`[Xtream Mock] player_api.php action=${action || '(auth)'}`);
        if (!action) return json(res, { user_info: { auth: 1, status: 'Active' }, server_info: { url: 'localhost', port: PORT } });
        if (action === 'get_live_categories') return json(res, [{ category_id: '1', category_name: 'News' }, { category_id: '2', category_name: 'Movies' }]);
        if (action === 'get_vod_categories') return json(res, [{ category_id: '2', category_name: 'Movies' }]);
        if (action === 'get_live_streams') return json(res, [
            { stream_id: 1, name: 'Test Live Channel', stream_icon: '', epg_channel_id: 'test.us', category_id: '1' },
            { stream_id: 2, name: 'Another Channel', stream_icon: '', epg_channel_id: '', category_id: '1' },
        ]);
        if (action === 'get_vod_streams') return json(res, [
            { stream_id: 100, name: 'Test Movie', stream_icon: '', container_extension: 'mp4', category_id: '2' },
        ]);
        return json(res, []);
    } else if (url.pathname === '/xmltv.php') {
        console.log('[Xtream Mock] Serving inline EPG');
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(buildEpg());
    } else if (url.pathname.startsWith('/live/')) {
        console.log(`[Xtream Mock] Live stream request ${url.pathname} -> test stream`);
        res.writeHead(302, { 'Location': TEST_STREAM });
        res.end();
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`\n==============================================`);
    console.log(`   Xtream Mock API Server is running!`);
    console.log(`==============================================`);
    console.log(`Host URL: http://localhost   (iOS simulator)`);
    console.log(`Host URL: http://10.0.2.2     (Android emulator)`);
    console.log(`Port:     ${PORT}`);
    console.log(`Username: testuser   Password: testpass`);
    console.log(`"Test Live Channel" plays a real HLS stream and has EPG (TV Guide).`);
    console.log(`==============================================\n`);
});
