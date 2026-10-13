#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const FILES = ['manifest.json', 'content.js', 'content.css', 'README.md', 'LICENSE', 'icons/icon-16.png', 'icons/icon-32.png', 'icons/icon-48.png', 'icons/icon-128.png'];
const packageRoot = path.resolve(__dirname, '..');
const source = path.join(packageRoot, 'extension');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function defaultDestination(platform = process.platform, userHome = os.homedir()) {
  if (platform === 'darwin') return path.join(userHome, 'Library', 'Application Support', 'LibTV One Click At');
  if (platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local'), 'LibTVOneClickAt');
  return path.join(userHome, '.local', 'share', 'libtv-one-click-at');
}

async function exists(file) {
  try { return await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function regularFile(root, relative) {
  const file = path.join(root, relative);
  for (const dir of [root, ...(relative.includes('/') ? [path.join(root, 'icons')] : [])]) {
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Refusing unsafe directory: ${dir}`);
  }
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 5 * 1024 * 1024) throw new Error(`Refusing unsafe extension file: ${file}`);
  return fs.readFile(file);
}

async function validateSource() {
  const checks = JSON.parse(await fs.readFile(path.join(__dirname, 'extension-checksums.json'), 'utf8'));
  if (JSON.stringify(Object.keys(checks.files).sort()) !== JSON.stringify([...FILES].sort())) throw new Error('Checksum inventory mismatch.');
  const manifest = JSON.parse(await regularFile(source, 'manifest.json'));
  if (manifest.name !== 'LibTV 一键绑定 @' || manifest.manifest_version !== 3 || manifest.version !== checks.version) throw new Error('Extension identity mismatch.');
  for (const relative of FILES) {
    const bytes = await regularFile(source, relative);
    if (hash(bytes) !== checks.files[relative]) throw new Error(`Checksum mismatch: ${relative}`);
    if (relative.endsWith('.png')) {
      const size = Number(relative.match(/icon-(\d+)\.png$/)[1]);
      if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== size || bytes.readUInt32BE(20) !== size || manifest.icons[String(size)] !== relative) throw new Error(`Invalid icon: ${relative}`);
    }
  }
  return { checks, manifest };
}

async function inspectDestination(destination, checks) {
  const stat = await exists(destination);
  if (!stat) return { exists: false, identical: false };
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Destination is not a regular extension directory.');
  let manifest;
  try { manifest = JSON.parse(await regularFile(destination, 'manifest.json')); }
  catch { throw new Error('Destination exists but is not a recognized LibTV extension; left unchanged.'); }
  if (manifest.name !== 'LibTV 一键绑定 @' || manifest.manifest_version !== 3) throw new Error('Refusing to overwrite an unrelated destination.');
  const rootEntries = await fs.readdir(destination, { withFileTypes: true });
  const allowedRoot = new Set(['manifest.json', 'content.js', 'content.css', 'README.md', 'LICENSE', 'icons']);
  if (rootEntries.some(entry => !allowedRoot.has(entry.name) || entry.isSymbolicLink())) throw new Error('Destination contains extra files; left unchanged.');
  const iconDir = await exists(path.join(destination, 'icons'));
  if (iconDir && (!iconDir.isDirectory() || iconDir.isSymbolicLink())) throw new Error('Unsafe destination icons directory.');
  if (iconDir) {
    const icons = await fs.readdir(path.join(destination, 'icons'), { withFileTypes: true });
    if (icons.some(entry => ![16, 32, 48, 128].some(n => entry.name === `icon-${n}.png`) || !entry.isFile() || entry.isSymbolicLink())) throw new Error('Destination icons contain extra or unsafe files; left unchanged.');
  }
  let identical = true;
  for (const relative of FILES) {
    try { if (hash(await regularFile(destination, relative)) !== checks.files[relative]) identical = false; }
    catch (error) { if (error.code === 'ENOENT') identical = false; else throw error; }
  }
  return { exists: true, identical };
}

async function prepare({ destination = defaultDestination(), dryRun = false } = {}) {
  destination = path.resolve(destination);
  const separator = path.sep;
  if (destination === path.parse(destination).root || destination === os.homedir() || destination === process.cwd() || packageRoot === destination || packageRoot.startsWith(destination + separator) || destination.startsWith(packageRoot + separator)) throw new Error('Refusing a broad or source-tree destination.');
  const { checks, manifest } = await validateSource();
  const before = await inspectDestination(destination, checks);
  const result = { status: dryRun ? 'dry_run' : before.identical ? 'already_prepared' : 'prepared', version: manifest.version, extensionDirectory: destination, chromeLoaded: 'unverified', manualChromeLoadRequired: true, backupDirectory: null };
  if (dryRun || before.identical) return result;
  const parent = path.dirname(destination);
  await fs.mkdir(parent, { recursive: true });
  const stage = await fs.mkdtemp(path.join(parent, '.libtv-one-click-at-stage-'));
  let backup = null;
  try {
    await fs.mkdir(path.join(stage, 'icons'));
    for (const relative of FILES) await fs.copyFile(path.join(source, relative), path.join(stage, relative), fs.constants.COPYFILE_EXCL);
    const staged = await inspectDestination(stage, checks);
    if (!staged.identical) throw new Error('Staged extension did not verify.');
    // Recheck immediately before changing an existing installation.
    const current = await inspectDestination(destination, checks);
    if (current.identical) { result.status = 'already_prepared'; return result; }
    if (current.exists) {
      backup = `${destination}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
      await fs.rename(destination, backup);
      result.backupDirectory = backup;
    }
    await fs.rename(stage, destination);
    return result;
  } catch (error) {
    if (backup && !await exists(destination)) await fs.rename(backup, destination);
    throw error;
  } finally {
    // The only removed directory is this invocation's fresh staging directory.
    if (await exists(stage)) await fs.rm(stage, { recursive: true });
  }
}

async function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dest' && args[i + 1]) options.destination = args[++i];
    else if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--json') continue;
    else if (args[i] === '--help') { console.log('node scripts/prepare-chrome-extension.cjs [--dest PATH] [--dry-run] [--json]\nPrepares verified files only. Chrome loading remains a manual user step.'); return; }
    else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  console.log(JSON.stringify(await prepare(options), null, 2));
}

module.exports = { prepare, defaultDestination, validateSource, FILES };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(JSON.stringify({ status: 'error', message: error.message, chromeLoaded: 'unverified' })); process.exitCode = 1; });
