const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CHAPTER_IDS, classifyStudyItem } = require('./chapter-model.js');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, relativePath), 'utf8'));
}

function assertMetadata(items, prefix) {
  const ids = new Set();
  const idPattern = new RegExp(`^${prefix}\\d{3}$`);
  items.forEach((item, index) => {
    assert.match(item.id, idPattern);
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

function collectStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
  return output;
}

test('all study content has stable chapter metadata', () => {
  const flashcards = readJson('data/flashcards.json').cards;
  const questions = readJson('data/quiz.json').questions;
  assertMetadata(flashcards, 'f');
  assertMetadata(questions, 'q');
});

test('quiz questions have exactly one correct answer', () => {
  const questions = readJson('data/quiz.json').questions;
  questions.forEach((question) => {
    assert.equal(
      question.answerOptions.filter((option) => option.isCorrect).length,
      1,
      `${question.id} should have exactly one correct option`
    );
  });
});

test('study content has no obvious mojibake, raw HTML, or broken TeX commands', () => {
  const flashcards = readJson('data/flashcards.json').cards;
  const questions = readJson('data/quiz.json').questions;
  const strings = collectStrings({ flashcards, questions });
  strings.forEach((text) => {
    assert.doesNotMatch(text, /�|Ã|â€|&nbsp;/, `mojibake/entity leak: ${text}`);
    assert.doesNotMatch(text, /<\/?[a-z][^>]*>/i, `raw HTML leak: ${text}`);
    assert.doesNotMatch(text, /\\(?:sqrt|frac|rightleftharpoons|cdot|approx|ge|le)[A-Za-z0-9]/, `possibly broken TeX command: ${text}`);
  });
});

test('curated chapter corrections repair known generated misclassifications', () => {
  const flashcards = readJson('data/flashcards.json').cards;
  const questions = readJson('data/quiz.json').questions;
  const byId = Object.fromEntries(flashcards.concat(questions).map((item) => [item.id, item]));
  assert.equal(classifyStudyItem(byId.f020), 'redox');
  assert.equal(classifyStudyItem(byId.f026), 'redox');
  assert.equal(classifyStudyItem(byId.f043), 'complexation');
  assert.equal(classifyStudyItem(byId.f045), 'complexation');
  assert.equal(classifyStudyItem(byId.q005), 'complexation');
  assert.equal(classifyStudyItem(byId.q015), 'complexation');
});

test('referenced courseware and resource files exist', () => {
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const coursewareFiles = [...app.matchAll(/file: '([^']+\.pdf)'/g)].map(m => m[1]);
  coursewareFiles.forEach(file => {
    const fullPath = path.join(__dirname, 'assets/pdfs', path.basename(file));
    assert.ok(fs.existsSync(fullPath), `Missing courseware PDF: ${file} (looked in assets/pdfs/)`);
  });
  const extrasHrefs = [...app.matchAll(/href: '([^']+)'/g)].map(m => m[1]);
  extrasHrefs.forEach(href => {
    const decoded = decodeURIComponent(href);
    const fullPath = path.join(__dirname, decoded.startsWith('./') ? decoded.slice(2) : decoded);
    assert.ok(fs.existsSync(fullPath), `Missing extra resource: ${href}`);
  });
  ['data/flashcards.json', 'data/quiz.json', 'data/exams.json'].forEach(f => {
    assert.ok(fs.existsSync(path.join(__dirname, f)), `Missing data file: ${f}`);
  });
});

test('exam data schema is stable when extracted exams are present', () => {
  const exams = readJson('data/exams.json').exams;
  assert.ok(Array.isArray(exams));
  exams.forEach((exam) => {
    assert.match(exam.id, /^exam-\d{3}$/);
    assert.ok(typeof exam.title === 'string' && exam.title.length > 0);
    assert.ok(Array.isArray(exam.questions));
    exam.questions.forEach((question) => {
      assert.match(question.id, /^exam-\d{3}-q\d{3}$/);
      assert.ok(typeof question.question === 'string' && question.question.length > 0);
      assert.ok(Number(question.score) > 0);
      assert.ok(Array.isArray(question.answerOptions));
      if (question.answerOptions.length) {
        assert.ok(Array.isArray(question.correctAnswers));
        assert.ok(question.correctAnswers.length > 0);
      }
    });
  });
});

test('dashboard exposes the bilingual study flow and exam bank shell', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.match(html, /Recommended Study Flow \/ 推荐学习流程/);
  assert.equal((html.match(/class="guide-step"/g) || []).length, 4);
  assert.match(html, /data-action="guide-chapter-overview"/);
  assert.match(html, /data-action="guide-chapter-quiz"/);
  assert.match(html, /data-route="mistakes"/);
  assert.match(html, /data-action="start-cram"/);
  assert.match(html, />Dashboard \/ 首页</);
  assert.match(html, />Flashcards \/ 卡片记忆</);
  assert.match(html, />Quiz \/ 测验</);
  assert.match(html, />Exam \/ 考试</);
  assert.match(html, />Mistakes \/ 错题本</);
  assert.match(html, />References \/ 课件资料</);
  assert.match(html, /data-view="exam"/);
  assert.match(html, /id="examRoot"/);
  assert.match(html, /\.\/exam\.js/);
});
