// Serves renderer/ over http so the UI can be previewed in a browser (data falls back to localStorage there).
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'renderer');
const port = Number(process.argv[2]) || 5179;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html');
  const file = path.join(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`Tempo UI on http://localhost:${port}`));
