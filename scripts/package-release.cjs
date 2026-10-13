const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { FILES, validateSource } = require('./prepare-chrome-extension.cjs');

(async () => {
  const root = path.resolve(__dirname, '..');
  const { manifest } = await validateSource();
  if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) throw new Error('Commit the reviewed release source before packaging.');
  const dist = path.join(root, 'dist');
  await fs.mkdir(dist, { recursive: true });
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'libtv-release-'));
  const names = [`libtv-one-click-at-chrome-${manifest.version}.zip`, `libtv-one-click-at-codex-${manifest.version}.zip`];
  try {
    const chrome = path.join(temp, 'libtv-one-click-at');
    await fs.mkdir(path.join(chrome, 'icons'), { recursive: true });
    for (const file of FILES) await fs.copyFile(path.join(root, 'extension', file), path.join(chrome, file));
    execFileSync('zip', ['-qr', path.join(temp, names[0]), 'libtv-one-click-at'], { cwd: temp });
    execFileSync('git', ['archive', '--format=zip', '--prefix=libtv-one-click-at/', `--output=${path.join(temp, names[1])}`, 'HEAD'], { cwd: root });
    const sums = [];
    for (const name of names) {
      const bytes = await fs.readFile(path.join(temp, name));
      sums.push(`${crypto.createHash('sha256').update(bytes).digest('hex')}  ${name}`);
      await fs.rename(path.join(temp, name), path.join(dist, name));
    }
    await fs.writeFile(path.join(dist, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
    console.log(JSON.stringify({ version: manifest.version, directory: dist, assets: [...names, 'SHA256SUMS.txt'] }, null, 2));
  } finally {
    // Only remove the freshly created release staging directory.
    await fs.rm(temp, { recursive: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
