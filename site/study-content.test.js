const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CHAPTER_IDS } = require('./chapter-model.js');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relativePath), 'utf8'));
}

function assertMetadata(items, prefix) {
  const ids = new Set();
  items.forEach((item, index) => {
    assert.match(item.id, new RegExp(`^${prefix}\\d{3}$`));
    assert.equal(ids.has(item.id), false, `duplicate id ${item.id}`);
    ids.add(item.id);
    assert.equal(CHAPTER_IDS[item.chapter], true, `${item.id} has invalid chapter`);
    assert.equal(typeof item.topic, 'string');
    assert.ok(item.topic.length > 0, `${item.id} has an empty topic`);
    assert.ok(Number.isInteger(item.difficulty));
    assert.ok(item.difficulty >= 1 && item.difficulty <= 3);
    assert.equal(item.id, `${prefix}${String(index + 1).padStart(3, '0')}`);
  });
}

test('all study content has stable chapter metadata', () => {
  const flashcards = readJson('data/flashcards.json').cards;
  const questions = readJson('data/quiz.json').questions;
  assertMetadata(flashcards, 'f');
  assertMetadata(questions, 'q');
});

test('dashboard exposes the bilingual four-step study flow', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.match(html, /Recommended Study Flow \/ 推荐学习流程/);
  assert.equal((html.match(/class="guide-step"/g) || []).length, 4);
  assert.match(html, /data-action="guide-chapter-overview"/);
  assert.match(html, /data-action="guide-chapter-quiz"/);
  assert.match(html, /data-route="mistakes"/);
  assert.match(html, /data-action="start-cram"/);
});
