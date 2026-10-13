const assert = require('node:assert/strict');
const { test } = require('node:test');
const { scan, validate } = require('../extension/content.js');
test('repeated refs and Chinese punctuation retain exact offsets', () => {
  const source = '办公室@image1，角色@image2拿@image3。\n再次@image1';
  const matches = scan(source);
  assert.deepEqual(matches.map(x => x.number), [1, 2, 3, 1]);
  for (const match of matches) assert.equal(source.slice(match.start, match.end), match.token);
  validate(matches, [1, 2, 3]);
});
test('all references preflight before mutations', () => {
  assert.throws(() => validate(scan('@image1 @image9'), [1, 2, 3]), /9/);
});
test('invalid or ambiguous numbering is rejected', () => {
  for (const token of ['@image0', '@image01', '@image-1', '@image', '@image1oops', '@image1_foo', '@image1.5', '@image9007199254740992']) {
    assert.throws(() => scan(token), /编号格式/);
  }
});
test('multi-digit numbers are not split into one-digit references', () => {
  assert.deepEqual(scan('@image10 @IMAGE30').map(x => x.number), [10, 30]);
  assert.throws(() => validate(scan('@image10'), [1, 2, 3]), /10/);
});
test('ordinary prose and native references stay untouched', () => {
  assert.deepEqual(scan('这是人物图。{{Mixed 1}}'), []);
});
test('Chinese and English aliases can mix with or without spaces', () => {
  const source = '@图片1，@图片 2与@图3，@图 1；@image2 @image 3';
  const matches = scan(source);
  assert.deepEqual(matches.map(x => x.number), [1, 2, 3, 1, 2, 3]);
  for (const match of matches) assert.equal(source.slice(match.start, match.end), match.token);
  validate(matches, [1, 2, 3]);
});
test('Chinese aliases support multi-digit references and horizontal spaces', () => {
  const matches = scan('@图片　10，@图\u00a030，@图片\t2');
  assert.deepEqual(matches.map(x => x.number), [10, 30, 2]);
  assert.throws(() => validate(matches, [1, 2, 3]), /10、30/);
});
test('Chinese malformed numbers are rejected instead of guessed', () => {
  for (const token of ['@图片0', '@图片 01', '@图一', '@图片-1', '@图', '@图片 1abc', '@图1.5', '@图片\n1']) {
    assert.throws(() => scan(token), /编号格式/);
  }
});
