
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threeBuildDir } from './vendor-three.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const threeBuild = threeBuildDir();
const port = Number(process.env.PORT || 8127);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

function within(root, target) {
  const r = resolve(root);
  const t = resolve(target);
  return t === r || t.startsWith(r + sep);
}

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  let file;
  if (path.startsWith('/vendor/')) {
    file = join(threeBuild, path.slice('/vendor/'.length));
    if (!within(threeBuild, file)) return void res.writeHead(403).end('forbidden');
  } else {
    file = join(here, path === '/' ? 'index.html' : path.replace(/^\/+/, ''));
    if (!within(here, file)) return void res.writeHead(403).end('forbidden');
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(`not found: ${path}`);
  }
}).listen(port, () => {
  console.log(`not-fur-threejs  ->  http://localhost:${port}/`);
  console.log(`three from ->  ${threeBuild}`);
});
