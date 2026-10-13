const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { validateSource } = require('./prepare-chrome-extension.cjs');

(async () => {
  const root = path.resolve(__dirname, '..');
  const readJSON = async relative => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
  const plugin = await readJSON('plugin.json');
  const legacy = await readJSON('.codex-plugin/plugin.json');
  const marketplace = await readJSON('.agents/plugins/marketplace.json');
  const pkg = await readJSON('package.json');
  const extension = (await validateSource()).manifest;
  for (const document of [plugin, legacy, pkg, extension]) assert.equal(document.version, '1.0.4');
  assert.equal(plugin.name, legacy.name);
  assert.equal(plugin.license, 'MIT');
  assert.equal(plugin.name, pkg.name);
  assert.equal(plugin.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, plugin.name);
  assert.equal(marketplace.plugins[0].source.path, './');
  assert.equal(marketplace.plugins[0].policy.installation, 'AVAILABLE');
  assert(!plugin.apps && !legacy.apps && !plugin.extensions['com.openai'].apps);
  assert(!(await fs.readdir(root)).includes('.app.json'));
  const ui = plugin.extensions['com.openai'].interface;
  assert(ui.shortDescription.length <= 30);
  assert(ui.defaultPrompt.length <= 128);
  for (const relative of [ui.logo, ui.composerIcon, plugin.extensions['com.openai'].onboardingSkill]) {
    assert(relative.startsWith('./') && !relative.includes('..'));
    const stat = await fs.lstat(path.join(root, relative));
    assert(stat.isFile() && !stat.isSymbolicLink());
  }
  const icon = await fs.readFile(path.join(root, ui.logo));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(icon.readUInt32BE(16), 256);
  assert.equal(icon.readUInt32BE(20), 256);
  assert(icon.length < 5 * 1024 * 1024);
  const skill = await fs.readFile(path.join(root, plugin.extensions['com.openai'].onboardingSkill), 'utf8');
  const frontmatter = skill.match(/^---\nname: ([a-z0-9-]+)\ndescription: ([^\n]+)\n---\n/);
  assert(frontmatter, 'This simple skill must have exactly the expected plain YAML fields.');
  assert.equal(frontmatter[1], 'libtv-one-click-at-install');
  assert(frontmatter[1].length <= 64 && frontmatter[2].length <= 1024 && !/[<>]/.test(frontmatter[2]));
  assert(!skill.includes('[TODO:'));
  console.log('PASS: package identity, marketplace, Codex skill frontmatter, public-asset paths, dimensions, and checksums.');
})().catch(error => { console.error(error); process.exitCode = 1; });
