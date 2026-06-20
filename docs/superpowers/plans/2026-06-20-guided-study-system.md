# Guided Study System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clickable bilingual study flow, deterministic chapter metadata with legacy fallback, and a dependency-free npm test workflow to the analytical chemistry site.

**Architecture:** Keep the static HTML/CSS/JavaScript architecture. `ChapterModel` owns classification and prefers explicit metadata; a one-time deterministic script enriches all current study data; `app.js` translates guide actions into existing chapter and cram state transitions. The canonical implementation remains in `site/`, then selected deployable files are copied to `docs/` after verification.

**Tech Stack:** HTML5, CSS3, browser JavaScript (ES5-compatible application code), Node.js built-in test runner, JSON, npm scripts.

---

## File Map

- Create `package.json`: root test entry point with no dependencies.
- Create `scripts/enrich-study-data.js`: deterministic one-time metadata migration and validator.
- Create `site/study-content.test.js`: validates migrated JSON and key bilingual guide markup.
- Modify `site/chapter-model.js`: metadata-first classification and metadata validation constants.
- Modify `site/chapter-model.test.js`: metadata precedence and fallback regression tests.
- Modify `site/data/flashcards.json`: add stable `id`, `chapter`, `topic`, and `difficulty` fields to 79 cards.
- Modify `site/data/quiz.json`: add stable `id`, `chapter`, `topic`, and `difficulty` fields to 15 questions.
- Modify `site/index.html`: add the four-step guide and bilingual primary labels.
- Modify `site/styles.css`: style the ordered flow responsively.
- Modify `site/app.js`: wire chapter overview and chapter quiz guide actions and bilingual generated labels.
- Modify `docs/index.html`, `docs/styles.css`, `docs/app.js`, `docs/chapter-model.js`, `docs/data/flashcards.json`, and `docs/data/quiz.json`: deploy the verified `site/` implementation.

### Task 1: Establish the npm Test Entry Point

**Files:**
- Create: `package.json`

- [ ] **Step 1: Add the root package manifest**

```json
{
  "name": "analytical-chemistry-study-system",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "node --test site/*.test.js"
  }
}
```

- [ ] **Step 2: Run the existing tests through npm**

Run: `npm test`

Expected: the three existing `chapter-model.test.js` tests pass and npm exits with status 0.

- [ ] **Step 3: Commit the tooling change**

```bash
git add package.json
git commit -m "test: add npm test entry point"
```

### Task 2: Make Chapter Classification Metadata-First

**Files:**
- Modify: `site/chapter-model.test.js`
- Modify: `site/chapter-model.js`

- [ ] **Step 1: Add failing metadata precedence and fallback tests**

Append to `site/chapter-model.test.js`:

```js
test('prefers valid explicit chapter metadata over matching text', () => {
  assert.equal(
    classifyStudyItem({ chapter: 'redox', question: 'Ksp precipitation rule' }),
    'redox'
  );
});

test('falls back to text classification for missing or invalid metadata', () => {
  assert.equal(classifyStudyItem({ question: 'EDTA complexation' }), 'complexation');
  assert.equal(
    classifyStudyItem({ chapter: 'not-a-chapter', question: 'buffer pH titration' }),
    'acid-base'
  );
});
```

- [ ] **Step 2: Run the focused tests and observe the failure**

Run: `node --test site/chapter-model.test.js`

Expected: `prefers valid explicit chapter metadata over matching text` fails because the current implementation classifies only concatenated text.

- [ ] **Step 3: Add a supported-ID lookup and metadata-first branch**

In `site/chapter-model.js`, directly after `CHAPTERS`, add:

```js
  var CHAPTER_IDS = CHAPTERS.reduce(function (lookup, chapter) {
    lookup[chapter.id] = true;
    return lookup;
  }, {});
```

Replace `classifyStudyItem` with:

```js
  function classifyStudyItem(item) {
    if (item && typeof item === 'object' && CHAPTER_IDS[item.chapter]) {
      return item.chapter;
    }

    var text = typeof item === 'string' ? item : itemText(item);
    for (var i = 0; i < CHAPTERS.length; i += 1) {
      if (CHAPTERS[i].re.test(text)) {
        return CHAPTERS[i].id;
      }
    }
    return 'other';
  }
```

Expose `CHAPTER_IDS` from the returned API:

```js
  return {
    CHAPTERS: CHAPTERS,
    CHAPTER_IDS: CHAPTER_IDS,
    classifyStudyItem: classifyStudyItem,
    buildChapterSummaries: buildChapterSummaries
  };
```

- [ ] **Step 4: Run the focused tests**

Run: `node --test site/chapter-model.test.js`

Expected: all five tests pass.

- [ ] **Step 5: Commit the model change**

```bash
git add site/chapter-model.js site/chapter-model.test.js
git commit -m "feat: prefer explicit chapter metadata"
```

### Task 3: Enrich and Validate Current Study Data

**Files:**
- Create: `scripts/enrich-study-data.js`
- Create: `site/study-content.test.js`
- Modify: `site/data/flashcards.json`
- Modify: `site/data/quiz.json`

- [ ] **Step 1: Add a failing data contract test**

Create `site/study-content.test.js`:

```js
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
```

- [ ] **Step 2: Run the data contract test and observe the failure**

Run: `node --test site/study-content.test.js`

Expected: failure because the current items have no `id`.

- [ ] **Step 3: Add the deterministic enrichment script**

Create `scripts/enrich-study-data.js`:

```js
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
```

- [ ] **Step 4: Run the migration once**

Run: `node scripts/enrich-study-data.js`

Expected: both JSON files are formatted with four metadata fields before each item's original content fields; card IDs span `f001`–`f079` and quiz IDs span `q001`–`q015`.

- [ ] **Step 5: Run all tests**

Run: `npm test`

Expected: six tests pass.

- [ ] **Step 6: Commit the migration**

```bash
git add scripts/enrich-study-data.js site/study-content.test.js site/data/flashcards.json site/data/quiz.json
git commit -m "feat: add structured study metadata"
```

### Task 4: Add the Clickable Bilingual Study Flow

**Files:**
- Modify: `site/index.html`
- Modify: `site/styles.css`
- Modify: `site/app.js`
- Modify: `site/study-content.test.js`

- [ ] **Step 1: Add a failing markup contract test**

Append to `site/study-content.test.js`:

```js
test('dashboard exposes the bilingual four-step study flow', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.match(html, /Recommended Study Flow \/ 推荐学习流程/);
  assert.equal((html.match(/class="guide-step"/g) || []).length, 4);
  assert.match(html, /data-action="guide-chapter-overview"/);
  assert.match(html, /data-action="guide-chapter-quiz"/);
  assert.match(html, /data-route="mistakes"/);
  assert.match(html, /data-action="start-cram"/);
});
```

- [ ] **Step 2: Run the markup test and observe the failure**

Run: `node --test site/study-content.test.js`

Expected: the bilingual heading assertion fails.

- [ ] **Step 3: Add the ordered guide after the dashboard hero**

Insert in `site/index.html` after `.playground-hero` and before `.section-heading`:

```html
<section class="study-guide" aria-labelledby="study-guide-heading">
  <div class="guide-intro">
    <p class="brand-kicker">A clear route through the material / 清晰学习路径</p>
    <h2 id="study-guide-heading">Recommended Study Flow / 推荐学习流程</h2>
    <p>Follow the sequence once, then repeat from your weak spots. / 完成一轮后，从薄弱点继续循环。</p>
  </div>
  <ol class="guide-steps">
    <li class="guide-step">
      <span class="guide-number">01</span>
      <button class="guide-link" data-action="guide-chapter-overview">
        <strong>Read Chapter Notes</strong><span>阅读章节笔记</span>
      </button>
    </li>
    <li class="guide-step">
      <span class="guide-number">02</span>
      <button class="guide-link" data-action="guide-chapter-quiz">
        <strong>Do Chapter Quiz</strong><span>完成章节测验</span>
      </button>
    </li>
    <li class="guide-step">
      <span class="guide-number">03</span>
      <button class="guide-link" data-route="mistakes">
        <strong>Review Mistakes</strong><span>回顾错题</span>
      </button>
    </li>
    <li class="guide-step">
      <span class="guide-number">04</span>
      <button class="guide-link" data-action="start-cram">
        <strong>Run Global Cram</strong><span>全局冲刺复习</span>
      </button>
    </li>
  </ol>
</section>
```

- [ ] **Step 4: Style the guide as a responsive sequence**

Add before `.section-heading` in `site/styles.css`:

```css
.study-guide { padding: 3.5rem 0; border-bottom: 1px solid var(--ink); }
.guide-intro { display: grid; grid-template-columns: 1fr 2fr; gap: 1rem 2rem; align-items: end; margin-bottom: 1.5rem; }
.guide-intro .brand-kicker { grid-column: 1 / -1; }
.guide-intro h2 { margin: 0; font-family: var(--serif); font-size: clamp(2rem, 4vw, 3rem); font-weight: 500; letter-spacing: -0.04em; }
.guide-intro > p:last-child { margin: 0; color: var(--muted); }
.guide-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.guide-step { display: flex; gap: 0.8rem; min-width: 0; padding: 1rem; border-bottom: 1px solid var(--line); }
.guide-step + .guide-step { border-left: 1px solid var(--line); }
.guide-number { color: var(--primary); font-size: 0.72rem; font-weight: 800; }
.guide-link { display: grid; gap: 0.25rem; padding: 0; border: 0; color: var(--ink); background: transparent; text-align: left; cursor: pointer; }
.guide-link strong { font-family: var(--serif); font-size: 1.05rem; font-weight: 600; }
.guide-link span { color: var(--muted); font-size: 0.82rem; }
.guide-link:hover strong, .guide-link:focus-visible strong { color: var(--primary); }
```

Add inside the `max-width: 900px` media query:

```css
  .guide-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .guide-step:nth-child(3) { border-left: 0; }
```

Add inside the `max-width: 720px` media query:

```css
  .guide-intro, .guide-steps { grid-template-columns: 1fr; }
  .guide-step + .guide-step { border-left: 0; }
```

- [ ] **Step 5: Wire the two chapter guide actions**

In the delegated click handler in `site/app.js`, immediately after the existing `if (!action) { return; }` guard and before the `retry-load` branch, add:

```js
      if (action === 'guide-chapter-overview' || action === 'guide-chapter-quiz') {
        state.chapterMode = action === 'guide-chapter-quiz' ? 'quiz' : 'overview';
        switchView('chapter');
        return;
      }
```

- [ ] **Step 6: Run the tests**

Run: `npm test`

Expected: seven tests pass.

- [ ] **Step 7: Commit the guide**

```bash
git add site/index.html site/styles.css site/app.js site/study-content.test.js
git commit -m "feat: add guided dashboard study flow"
```

### Task 5: Apply Concise Bilingual Labels Across the Primary UI

**Files:**
- Modify: `site/index.html`
- Modify: `site/app.js`
- Modify: `site/study-content.test.js`

- [ ] **Step 1: Extend the markup test with primary bilingual labels**

Add these assertions to the dashboard markup test:

```js
  assert.match(html, />Dashboard \/ 首页</);
  assert.match(html, />Flashcards \/ 卡片记忆</);
  assert.match(html, />Quiz \/ 测验</);
  assert.match(html, />Mistakes \/ 错题本</);
  assert.match(html, />References \/ 课件资料</);
```

- [ ] **Step 2: Run the focused test and observe the failure**

Run: `node --test site/study-content.test.js`

Expected: the first primary label assertion fails.

- [ ] **Step 3: Update static primary labels in `site/index.html`**

Use these labels consistently in the top-level navigation and view headings/actions:

```text
Dashboard / 首页
Chapter / 章节
Cram / 冲刺
Flashcards / 卡片记忆
Quiz / 测验
Mistakes / 错题本
References / 课件资料
Start Global Cram / 开始全局冲刺
Review Mistakes / 回顾错题
```

Keep card content, chemistry questions, hints, rationales, counters, and compact status words unchanged.

- [ ] **Step 4: Update generated chapter labels in `site/app.js`**

Use the following bilingual strings in `renderChapterGrid`, `renderChapterOverview`, and the chapter mode panels:

```text
Open Chapter / 打开章节
Chapter Cram / 章节冲刺
Chapter Tools / 章节工具
Chapter Snapshot / 章节概览
Flashcards / 卡片记忆
Quiz / 测验
Mistakes / 错题本
Cram / 冲刺
Review Weak Cards / 回顾薄弱卡片
Practice Chapter Quiz / 练习章节测验
Start Chapter Cram / 开始章节冲刺
```

- [ ] **Step 5: Run all tests**

Run: `npm test`

Expected: seven tests pass.

- [ ] **Step 6: Commit the bilingual UI**

```bash
git add site/index.html site/app.js site/study-content.test.js
git commit -m "feat: add bilingual study labels"
```

### Task 6: Synchronize the GitHub Pages Copy and Verify

**Files:**
- Modify: `docs/index.html`
- Modify: `docs/styles.css`
- Modify: `docs/app.js`
- Modify: `docs/chapter-model.js`
- Modify: `docs/data/flashcards.json`
- Modify: `docs/data/quiz.json`

- [ ] **Step 1: Copy only verified deployable files**

Run:

```bash
cp site/index.html docs/index.html
cp site/styles.css docs/styles.css
cp site/app.js docs/app.js
cp site/chapter-model.js docs/chapter-model.js
cp site/data/flashcards.json docs/data/flashcards.json
cp site/data/quiz.json docs/data/quiz.json
```

Expected: each destination contains the same bytes as its `site/` source.

- [ ] **Step 2: Prove source/deploy parity**

Run:

```bash
cmp site/index.html docs/index.html
cmp site/styles.css docs/styles.css
cmp site/app.js docs/app.js
cmp site/chapter-model.js docs/chapter-model.js
cmp site/data/flashcards.json docs/data/flashcards.json
cmp site/data/quiz.json docs/data/quiz.json
```

Expected: all six commands exit with status 0 and print nothing.

- [ ] **Step 3: Run the full automated suite**

Run: `npm test`

Expected: seven tests pass with zero failures.

- [ ] **Step 4: Serve and manually inspect the static site**

Run: `python3 -m http.server 4173 --directory site`

Open `http://localhost:4173/` and verify:

- the guide appears between the hero and chapter grid at desktop and narrow widths;
- step 1 opens the selected chapter overview;
- step 2 opens the selected chapter quiz;
- step 3 opens the mistakes view;
- step 4 starts a global cram session;
- bilingual labels do not clip or overlap;
- chapter counts still populate and saved weak/missed state remains visible;
- no browser console errors occur.

- [ ] **Step 5: Review the final diff for unrelated changes**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only the files listed in this plan plus pre-existing user changes appear.

- [ ] **Step 6: Commit the deployable copy**

```bash
git add docs/index.html docs/styles.css docs/app.js docs/chapter-model.js docs/data/flashcards.json docs/data/quiz.json
git commit -m "chore: publish guided study system"
```

## Execution Notes

- Do not let Hermes and Codex write to the same checkout concurrently.
- Codex owns architecture, integration, dirty-worktree conflict handling, browser verification, and final acceptance.
- Hermes should execute bounded repeatable tasks in a separate remote worktree: Task 1, Task 3 after Task 2 is integrated, and Task 6 source/deploy synchronization. Each delegation must name an exclusive file set, require tests, and return a Git commit for Codex review.
- Codex must inspect and integrate each Hermes commit before starting any dependent Hermes task. Independent tasks may overlap only when their files and worktrees are disjoint.
- Before each commit, inspect `git diff --cached` so pre-existing user modifications are not accidentally included beyond files intentionally changed for this feature.
