const fs = require('node:fs');
const path = require('node:path');
const { classifyStudyItem } = require('../site/chapter-model.js');

const ROOT = path.resolve(__dirname, '..');
const TOPICS = {
  solubility: 'Ksp and precipitation',
  redox: 'Redox titration and electrochemistry',
  complexation: 'Complexation and EDTA',
  'acid-base': 'Acid-base equilibrium and titration',
  other: 'Instrumental and mixed review'
};

function enrich(file, collectionKey, prefix) {
  const filePath = path.join(ROOT, file);
  const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  document[collectionKey] = document[collectionKey].map((item, index) => {
    const chapter = classifyStudyItem(item);
    return {
      id: `${prefix}${String(index + 1).padStart(3, '0')}`,
      chapter,
      topic: TOPICS[chapter],
      difficulty: 2,
      ...item
    };
  });
  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`);
}

enrich('site/data/flashcards.json', 'cards', 'f');
enrich('site/data/quiz.json', 'questions', 'q');
