// Optional asset preparation. The build uses the committed WebP files and needs only Node.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const html = readFileSync('index.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const sources = [...new Set([...html.matchAll(/<img\b[^>]*\bsrc="(images\/[^"<>]+)"/g)].map(m => m[1]))];
mkdirSync('images/web', { recursive: true });
const manifest = {};
for (const source of sources) {
  const logo = source === 'images/logo.png';
  const output = source.endsWith('.webp') ? source : `images/web/${path.parse(source).name}.webp`;
  if (output !== source) {
    const converted = spawnSync('magick', [source, '-auto-orient', '-resize', logo ? '600x600>' : '960x1280>', '-strip', '-quality', logo ? '90' : '84', output], { encoding: 'utf8' });
    if (converted.status !== 0) throw new Error(converted.stderr || String(converted.error));
  }
  if (!existsSync(output)) throw new Error(`Missing image: ${output}`);
  const size = spawnSync('magick', ['identify', '-format', '%w %h', output], { encoding: 'utf8' });
  if (size.status !== 0) throw new Error(size.stderr);
  const [width, height] = size.stdout.trim().split(' ').map(Number);
  manifest[source] = { src: output, width, height, sourceHash: createHash('sha256').update(readFileSync(source)).digest('hex') };
}
writeFileSync('images/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${sources.length} images for the public site.`);
