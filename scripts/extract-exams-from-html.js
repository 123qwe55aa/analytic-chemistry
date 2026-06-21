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
  return out.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)));
}

function compactText(text) {
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function stripNoise(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
}

function htmlToText(html) {
  return compactText(
    stripNoise(html)
      .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, '^$1')
      .replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, '_$1')
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function normalizeHtmlFragment(html) {
  return decodeEntities(String(html || ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function firstRawMatch(html, re, fallback = '') {
  const match = html.match(re);
  return match ? match[1] : fallback;
}

function firstTextMatch(html, re, fallback = '') {
  return htmlToText(firstRawMatch(html, re, fallback));
}

function parseSummary(html) {
  const titleHtml = firstRawMatch(html, /<h2[^>]*class="[^"]*mark_title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i, 'HTML Exam');
  const title = htmlToText(titleHtml) || 'HTML Exam';
  const questionCount = Number(firstTextMatch(html, /题量:\s*(?:<\/span>\s*<span[^>]*>)?(\d+)/i)) || 0;
  const totalScore = Number(firstTextMatch(html, /满分:\s*(?:<\/span>\s*<span[^>]*>)?(\d+)/i)) || 0;
  const availableTime = firstTextMatch(html, /作答时间:\s*<em>([\s\S]*?)<\/em>\s*至\s*<em>([\s\S]*?)<\/em>/i);
  return { title, titleHtml: normalizeHtmlFragment(titleHtml), questionCount, totalScore, availableTime };
}

function questionBlocks(html) {
  const starts = [...html.matchAll(/<div[^>]*class="[^"]*questionLi[^"]*"[\s\S]*?>/gi)].map((match) => match.index);
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : html.length;
    return html.slice(start, end);
  });
}

function extractId(block) {
  return firstRawMatch(block, /id="(question\d+)"/i) || firstRawMatch(block, /data="(\d+)"/i);
}

function optionFromLi(liHtml) {
  const originalHtml = normalizeHtmlFragment(liHtml);
  const originalText = htmlToText(liHtml);
  const match = originalText.match(/^([A-Z])\s*[.、．]?\s*(.*)$/i);
  if (!match) return null;
  return {
    label: match[1].toUpperCase(),
    text: match[2].trim(),
    originalText,
    html: originalHtml
  };
}

function inferType(block) {
  const typeLabel = firstTextMatch(block, /<span[^>]*class="[^"]*colorShallow[^"]*"[^>]*>\s*（?\(?([^<)）]+)[)）]?\s*<\/span>/i, '单选题');
  if (/多选/.test(typeLabel)) return { type: 'multiple', label: typeLabel };
  if (/判断/.test(typeLabel)) return { type: 'judgement', label: typeLabel };
  if (/填空/.test(typeLabel)) return { type: 'blank', label: typeLabel };
  if (/简答|问答/.test(typeLabel)) return { type: 'text', label: typeLabel };
  return { type: 'single', label: typeLabel };
}

function normalizeCorrectAnswers(correctRaw, options) {
  const cleaned = htmlToText(correctRaw).replace(/[；;].*$/, '').trim();
  const tokens = cleaned
    .split(/[,，、\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  const optionLabels = new Set(options.map((option) => option.label));
  return tokens.filter((token) => optionLabels.size ? optionLabels.has(token) : token.length > 0);
}

function extractQuestion(block, examId, number, score) {
  const questionHtml = firstRawMatch(block, /<span[^>]*class="[^"]*qtContent[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const question = htmlToText(questionHtml);
  if (!question) return null;

  const optionMatches = [...block.matchAll(/<li[^>]*class="[^"]*workTextWrap[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)];
  const options = optionMatches.map((match) => optionFromLi(match[1])).filter(Boolean);

  const correctRaw = firstRawMatch(block, /<span[^>]*class="[^"]*rightAnswerContent[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const correctAnswers = normalizeCorrectAnswers(correctRaw, options);
  const inferred = inferType(block);
  const normalizedType = inferred.type === 'multiple' ? 'multiple' : options.length ? 'single' : inferred.type;
  const answerOptions = options.map((option) => ({
    ...option,
    isCorrect: correctAnswers.includes(option.label)
  }));

  return {
    id: `${examId}-q${String(number).padStart(3, '0')}`,
    sourceQuestionId: extractId(block),
    number,
    type: normalizedType,
    typeLabel: inferred.label,
    score,
    question,
    questionHtml: normalizeHtmlFragment(questionHtml),
    answerOptions,
    rawCorrectAnswer: htmlToText(correctRaw),
    correctAnswer: correctAnswers.join(','),
    correctAnswers,
    originalText: htmlToText(block),
    originalHtml: normalizeHtmlFragment(block).slice(0, 12000)
  };
}

function extractExam(file, index) {
  const html = fs.readFileSync(file, 'utf8');
  const summary = parseSummary(html);
  const examId = `exam-${String(index).padStart(3, '0')}`;
  const blocks = questionBlocks(html);
  const declaredCount = summary.questionCount || blocks.length;
  const perQuestionScore = summary.totalScore && declaredCount
    ? Number((summary.totalScore / declaredCount).toFixed(2))
    : 5;

  const questions = blocks
    .map((block, questionIndex) => extractQuestion(block, examId, questionIndex + 1, perQuestionScore))
    .filter(Boolean);

  return {
    id: examId,
    source: path.relative(ROOT, file),
    title: summary.title,
    titleHtml: summary.titleHtml,
    totalScore: summary.totalScore || Number((questions.length * perQuestionScore).toFixed(2)),
    declaredQuestionCount: summary.questionCount,
    questionCount: questions.length,
    availableTime: summary.availableTime,
    extractedAt: new Date().toISOString(),
    questions
  };
}

const files = INPUT_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
const exams = files
  .map((file, index) => extractExam(file, index + 1))
  .filter((exam) => exam.questions.length > 0);

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify({ title: 'Extracted Exams', sourceDirs: INPUT_DIRS, exams }, null, 2)}\n`);

console.log(`Extracted ${exams.reduce((sum, exam) => sum + exam.questions.length, 0)} questions from ${exams.length} exams.`);
console.log(`Wrote ${path.relative(ROOT, OUTPUT_FILE)}`);
