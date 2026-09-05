import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const files = [
  ["/index.html", "index.html", "text/html; charset=utf-8"],
  ["/styles.css", "styles.css", "text/css; charset=utf-8"],
  ["/app.js", "app.js", "text/javascript; charset=utf-8"],
  ["/sw.js", "sw.js", "text/javascript; charset=utf-8"],
  ["/manifest.webmanifest", "manifest.webmanifest", "application/manifest+json; charset=utf-8"],
  ["/icon.svg", "icon.svg", "image/svg+xml; charset=utf-8"],
  ["/og.png", "og.png", "image/png"],
];

const assets = {};
for (const [urlPath, fileName, type] of files) {
  assets[urlPath] = { type, body: (await fs.readFile(path.join(root, fileName))).toString("base64") };
}

const worker = `const ASSETS=${JSON.stringify(assets)};
function decode(value){const text=atob(value);const bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);return bytes;}
export default {async fetch(request){const url=new URL(request.url);const key=url.pathname==='/'?'/index.html':url.pathname;const asset=ASSETS[key];if(!asset)return new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8'}});const headers={'content-type':asset.type,'x-content-type-options':'nosniff'};if(key==='/sw.js')headers['cache-control']='no-cache';else if(key==='/index.html')headers['cache-control']='no-cache';else headers['cache-control']='public, max-age=31536000, immutable';return new Response(decode(asset.body),{status:200,headers});}};
`;

await fs.rm(path.join(root, "dist"), { recursive: true, force: true });
await fs.mkdir(path.join(root, "dist", "server"), { recursive: true });
await fs.mkdir(path.join(root, "dist", ".openai"), { recursive: true });
await fs.writeFile(path.join(root, "dist", "server", "index.js"), worker);
await fs.copyFile(path.join(root, ".openai", "hosting.json"), path.join(root, "dist", ".openai", "hosting.json"));
