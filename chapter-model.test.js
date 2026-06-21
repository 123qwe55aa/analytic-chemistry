const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CHAPTERS,
  CHAPTER_OVERRIDES_BY_ID,
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

test('chapter summaries expose indexes for filtered study flows', () => {
  const cards = [
    { front: 'Ksp precipitation', back: 'solubility' },
    { front: 'KMnO4 redox', back: 'permanganate' }
  ];
  const questions = [
    { question: 'EDTA complexation', answerOptions: [] },
    { question: 'buffer pH acid base', answerOptions: [] }
  ];

  const summaries = buildChapterSummaries(cards, questions, {}, {});
  const byId = Object.fromEntries(summaries.map((summary) => [summary.id, summary]));

  assert.deepEqual(byId.solubility.flashcardIndexes, [0]);
  assert.deepEqual(byId.redox.flashcardIndexes, [1]);
  assert.deepEqual(byId.complexation.questionIndexes, [0]);
  assert.deepEqual(byId['acid-base'].questionIndexes, [1]);
});

test('prefers valid explicit chapter metadata over matching text', () => {
  assert.equal(
    classifyStudyItem({ chapter: 'redox', question: 'Ksp precipitation rule' }),
    'redox'
  );
});

test('uses curated overrides before stale explicit metadata', () => {
  assert.equal(Object.keys(CHAPTER_OVERRIDES_BY_ID).length >= 10, true);
  assert.equal(
    classifyStudyItem({
      id: 'f020',
      chapter: 'solubility',
      front: 'What reagent removes excess SnCl2 after reducing Fe3+?',
      back: 'HgCl2 forms a white precipitate.'
    }),
    'redox'
  );
  assert.equal(
    classifyStudyItem({
      id: 'f045',
      chapter: 'acid-base',
      front: 'Which metal indicator is used for Mg2+ and Zn2+ at pH 10?'
    }),
    'complexation'
  );
  assert.equal(
    classifyStudyItem({
      id: 'q005',
      chapter: 'redox',
      question: 'Which hybridization and geometry are associated with [Ni(CN)4]2-?'
    }),
    'complexation'
  );
});

test('falls back to text classification for missing or invalid metadata', () => {
  assert.equal(classifyStudyItem({ question: 'EDTA complexation' }), 'complexation');
  assert.equal(
    classifyStudyItem({ chapter: 'not-a-chapter', question: 'buffer pH titration' }),
    'acid-base'
  );
});
