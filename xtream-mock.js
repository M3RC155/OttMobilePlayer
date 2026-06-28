const http = require('http');

const PORT = 8082;

const server = http.createServer((req, res) => {
    // Parse the URL
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/get.php') {
        console.log('[Xtream Mock] Received M3U request. Redirecting...');
        res.writeHead(302, {
            'Location': 'https://iptv-org.github.io/iptv/categories/comedy.m3u'
        });
        res.end();
    } else if (url.pathname === '/xmltv.php') {
        console.log('[Xtream Mock] Received EPG request. Redirecting...');
        res.writeHead(302, {
            'Location': 'https://i.mjh.nz/PlutoTV/all.xml'
        });
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
    console.log(`Use the following credentials in your app:`);
    console.log(`\nHost URL: http://10.0.2.2 (if Android emulator)`);
    console.log(`Host URL: http://<Your-PC-IP> (if physical phone)`);
    console.log(`Port:     ${PORT}`);
    console.log(`Username: testuser`);
    console.log(`Password: testpass`);
    console.log(`==============================================\n`);
});
