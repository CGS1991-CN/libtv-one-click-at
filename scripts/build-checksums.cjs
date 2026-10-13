const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { FILES } = require('./prepare-chrome-extension.cjs');
(async () => {
  const source = path.join(__dirname, '..', 'extension');
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
  const files = {};
  for (const relative of FILES) files[relative] = crypto.createHash('sha256').update(await fs.readFile(path.join(source, relative))).digest('hex');
  await fs.writeFile(path.join(__dirname, 'extension-checksums.json'), JSON.stringify({ version: manifest.version, files }, null, 2) + '\n');
  console.log('Updated extension checksums. Review the diff before release.');
})().catch(error => { console.error(error); process.exitCode = 1; });
