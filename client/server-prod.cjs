const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3009;
const DIST = path.join(__dirname, 'dist');
const API_HOST = '127.0.0.1';
const API_PORT = 3015;

const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
};

http.createServer((req, res) => {
    // API proxy
    if (req.url.startsWith('/api')) {
        const options = {
            hostname: API_HOST,
            port: API_PORT,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: API_HOST + ':' + API_PORT },
        };
        const proxyReq = http.request(options, proxyRes => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });
        proxyReq.on('error', () => {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Proxy error');
        });
        req.pipe(proxyReq);
        return;
    }

    // Static files with SPA fallback
    let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(DIST, 'index.html');
    }

    const ext = path.extname(filePath);
    res.setHeader('Content-Type', types[ext] || 'text/plain');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const content = fs.readFileSync(filePath);
        res.end(content);
    } catch {
        res.statusCode = 404;
        res.end('Not found');
    }
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Radar-FX running at http://localhost:${PORT}`);
    console.log(`API proxy → http://${API_HOST}:${API_PORT}`);
});
