const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CHAPTERS,
  classifyStudyItem,
  buildChapterSummaries
} = require('./chapter-model.js');

test('classifies representative chemistry content into deterministic chapters', () => {
  assert.equal(classifyStudyItem('Term: Solubility Product Ksp'), 'solubility');
  assert.equal(classifyStudyItem('KMnO4 redox titration endpoint'), 'redox');
  assert.equal(classifyStudyItem('EDTA conditional stability constant'), 'complexation');
  assert.equal(classifyStudyItem('acid base buffer titration curve'), 'acid-base');
  assert.equal(classifyStudyItem('spin-only magnetic moment for V3+'), 'other');
});

test('builds chapter summaries from cards, questions, and local progress', () => {
  const cards = [
    { front: 'Ksp precipitation rule', back: 'Q and Ksp' },
    { front: 'EDTA titration', back: 'metal complex' }
  ];
  const questions = [
    { question: 'Redox titration potential', answerOptions: [] },
    { question: 'Acid base indicator', answerOptions: [] }
  ];
  const flashcardStatus = {
    'Ksp precipitation rule::Q and Ksp::0': 'missed'
  };
  const missedQuestions = {
    'Redox titration potential::0': { selectedAnswer: 'wrong' }
  };

  const summaries = buildChapterSummaries(cards, questions, flashcardStatus, missedQuestions);
  const byId = Object.fromEntries(summaries.map((summary) => [summary.id, summary]));

  assert.equal(CHAPTERS.length, 5);
  assert.equal(byId.solubility.flashcardTotal, 1);
  assert.equal(byId.solubility.weakTotal, 1);
  assert.equal(byId.redox.quizTotal, 1);
  assert.equal(byId.redox.missedTotal, 1);
  assert.equal(byId['acid-base'].quizTotal, 1);
  assert.equal(byId.complexation.flashcardTotal, 1);
});
