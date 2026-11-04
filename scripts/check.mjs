import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
let count = 0;
for (const dir of ['src', 'scripts', 'server', 'tests']) {
  for (const name of await readdir(new URL(`${dir}/`, root))) {
    if (!/\.(m?js)$/.test(name)) continue;
    const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(`${dir}/${name}`, root))], { encoding: 'utf8' });
    if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
    count++;
  }
}
const html = await readFile(new URL('index.html', root), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate static HTML IDs');
if (/\bon(?:click|submit|change)\s*=/.test(html)) throw new Error('Inline handlers are not allowed');
for (const link of [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s))) { const asset = new URL(link, root); asset.search = ''; asset.hash = ''; await readFile(asset); }
console.log(`Checked ${count} JavaScript files, static HTML IDs and local assets.`);
