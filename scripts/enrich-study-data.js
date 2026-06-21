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

const TEXT_REPLACEMENTS = [
  [/難溶/g, '难溶'],
  [/\u00a0/g, ' '],
  [/&nbsp;/g, ' '],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&amp;/g, '&']
];

function cleanString(value) {
  return TEXT_REPLACEMENTS.reduce((text, replacement) => text.replace(replacement[0], replacement[1]), value)
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanValue(value) {
  if (typeof value === 'string') {
    return cleanString(value);
  }
  if (Array.isArray(value)) {
    return value.map(cleanValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cleanValue(child)]));
  }
  return value;
}

function enrich(file, collectionKey, prefix) {
  const filePath = path.join(ROOT, file);
  const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  document[collectionKey] = document[collectionKey].map((rawItem, index) => {
    const id = `${prefix}${String(index + 1).padStart(3, '0')}`;
    const item = cleanValue({ ...rawItem, id });
    const chapter = classifyStudyItem(item);
    return {
      ...item,
      id,
      chapter,
      topic: TOPICS[chapter],
      difficulty: Number.isInteger(item.difficulty) ? item.difficulty : 2
    };
  });
  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`);
}

enrich('site/data/flashcards.json', 'cards', 'f');
enrich('site/data/quiz.json', 'questions', 'q');
