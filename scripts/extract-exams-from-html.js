const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIRS = ['raw-html', 'homework'];
const OUTPUT_FILE = path.join(ROOT, 'data', 'exams.json');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.endsWith('_files')) out.push(...walk(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(Number.parseInt(n, 16)));
}

function cleanHtml(html) {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, '^$1')
    .replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, '_$1')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(html, re, fallback = '') {
  const match = html.match(re);
  return match ? cleanHtml(match[1]) : fallback;
}

function parseSummary(html) {
  const title = firstMatch(html, /<h2[^>]*class="[^"]*mark_title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i, 'HTML Exam');
  const questionCount = Number(firstMatch(html, /题量:\s*<\/span>\s*<span[^>]*>(\d+)<\/span>/i)) || Number(firstMatch(html, /题量:\s*(\d+)/i)) || 0;
  const totalScore = Number(firstMatch(html, /满分:\s*<\/span>\s*<span[^>]*>(\d+)<\/span>/i)) || Number(firstMatch(html, /满分:\s*(\d+)/i)) || 0;
  return { title, questionCount, totalScore };
}

function questionBlocks(html) {
  const starts = [...html.matchAll(/<div[^>]*class="[^"]*questionLi[^"]*"[\s\S]*?>/gi)].map((match) => match.index);
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : html.length;
    return html.slice(start, end);
  });
}

function optionFromLi(liHtml) {
  const text = cleanHtml(liHtml);
  const match = text.match(/^([A-Z])\s*[.、．]?\s*(.*)$/i);
  if (!match) return null;
  return {
    label: match[1].toUpperCase(),
    text: match[2].trim()
  };
}

function inferType(block) {
  const typeLabel = firstMatch(block, /<span[^>]*class="[^"]*colorShallow[^"]*"[^>]*>\s*（?\(?([^<)）]+)[)）]?\s*<\/span>/i, 'single');
  if (/多选/.test(typeLabel)) return 'multiple';
  if (/判断/.test(typeLabel)) return 'judgement';
  if (/填空/.test(typeLabel)) return 'blank';
  if (/简答|问答/.test(typeLabel)) return 'text';
  return 'single';
}

function extractQuestion(block, examId, number, score) {
  const question = firstMatch(block, /<span[^>]*class="[^"]*qtContent[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  if (!question) return null;

  const optionLis = [...block.matchAll(/<li[^>]*class="[^"]*workTextWrap[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => optionFromLi(match[1]))
    .filter(Boolean);

  const correctRaw = firstMatch(block, /<span[^>]*class="[^"]*rightAnswerContent[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const correctAnswers = correctRaw
    .replace(/[；;].*$/, '')
    .split(/[,，、\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  const type = inferType(block);
  const answerOptions = optionLis.map((option) => ({
    ...option,
    isCorrect: correctAnswers.includes(option.label)
  }));

  return {
    id: `${examId}-q${String(number).padStart(3, '0')}`,
    type: type === 'multiple' ? 'multiple' : answerOptions.length ? 'single' : type,
    score,
    question,
    answerOptions,
    correctAnswer: correctAnswers.join(','),
    correctAnswers
  };
}

function extractExam(file, index) {
  const html = fs.readFileSync(file, 'utf8');
  const summary = parseSummary(html);
  const examId = `exam-${String(index).padStart(3, '0')}`;
  const blocks = questionBlocks(html);
  const perQuestionScore = summary.totalScore && (summary.questionCount || blocks.length)
    ? Number((summary.totalScore / (summary.questionCount || blocks.length)).toFixed(2))
    : 5;

  const questions = blocks
    .map((block, questionIndex) => extractQuestion(block, examId, questionIndex + 1, perQuestionScore))
    .filter(Boolean);

  return {
    id: examId,
    source: path.relative(ROOT, file),
    title: summary.title,
    totalScore: summary.totalScore || Number((questions.length * perQuestionScore).toFixed(2)),
    questionCount: questions.length,
    questions
  };
}

const files = INPUT_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
const exams = files
  .map((file, index) => extractExam(file, index + 1))
  .filter((exam) => exam.questions.length > 0);

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify({ title: 'Extracted Exams', exams }, null, 2)}\n`);

console.log(`Extracted ${exams.reduce((sum, exam) => sum + exam.questions.length, 0)} questions from ${exams.length} exams.`);
console.log(`Wrote ${path.relative(ROOT, OUTPUT_FILE)}`);
