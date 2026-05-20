# Chapter Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a chapter-based playground home and focused chapter workspace for the analytical chemistry cram site.

**Architecture:** Add a shared browser/Node chapter model helper, then update the static app to classify content into chapters and render chapter-filtered study flows. Keep existing full-dataset Cram, Flashcards, Quiz, Mistakes, and References views working as global fallback paths.

**Tech Stack:** Plain HTML, CSS, JavaScript, MathJax, Node built-in test runner for helper coverage.

---

## File Structure

- Create `site/chapter-model.js`: shared chapter definitions, keyword classifier, per-chapter summary helpers, and UMD-style export for browser plus Node tests.
- Create `site/chapter-model.test.js`: Node `node:test` coverage for chapter classification and summary counts.
- Modify `site/index.html`: add chapter playground containers and chapter workspace markup.
- Modify `site/app.js`: load chapter model helpers, track selected chapter state, render chapter tiles, and reuse existing study renderers with active chapter filters.
- Modify `site/styles.css`: replace the old beige dashboard treatment with a modern playground layout and responsive chapter workspace styling.

## Tasks

### Task 1: Add Tested Chapter Model

**Files:**
- Create: `site/chapter-model.test.js`
- Create: `site/chapter-model.js`

- [ ] **Step 1: Write the failing test**

Create `site/chapter-model.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test site/chapter-model.test.js
```

Expected: FAIL because `site/chapter-model.js` does not exist.

- [ ] **Step 3: Implement the shared chapter model**

Create `site/chapter-model.js`:

```javascript
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ChapterModel = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CHAPTERS = [
    {
      id: 'solubility',
      name: 'Solubility & Ksp',
      cue: 'Precipitation rules, Ksp math, ion effects',
      re: /(ksp|solub|precip|common ion|salt effect|acid effect|沉淀|溶)/i
    },
    {
      id: 'redox',
      name: 'Redox Titration',
      cue: 'Potentials, iodometry, permanganate, endpoints',
      re: /(redox|oxid|reduc|electro|nernst|iod|permangan|kmno4|dichromate|thiosulfate|sncl2|氧化|还原|电极|电化学)/i
    },
    {
      id: 'complexation',
      name: 'Complexation & EDTA',
      cue: 'Complex ions, EDTA constants, coordination',
      re: /(complex|edta|coordination|ligand|stability constant|cyanide|配位)/i
    },
    {
      id: 'acid-base',
      name: 'Acid-Base / Titration',
      cue: 'Buffers, indicators, pH, titration curves',
      re: /(acid|base|buffer|ph|indicator|titrat|endpoint|equivalence|滴定|酸|碱)/i
    },
    {
      id: 'other',
      name: 'Instrumental / Other',
      cue: 'Magnetism, instruments, and mixed review',
      re: /.+/i
    }
  ];

  function flashcardKey(card, index) {
    return card.front + '::' + card.back + '::' + index;
  }

  function questionKey(question, index) {
    return question.question + '::' + index;
  }

  function itemText(item) {
    if (!item) {
      return '';
    }
    return [
      item.front,
      item.back,
      item.question,
      Array.isArray(item.answerOptions) ? item.answerOptions.map(function (option) { return option.text; }).join(' ') : '',
      item.hint
    ].filter(Boolean).join(' ');
  }

  function classifyStudyItem(item) {
    var text = typeof item === 'string' ? item : itemText(item);
    for (var i = 0; i < CHAPTERS.length; i += 1) {
      if (CHAPTERS[i].re.test(text)) {
        return CHAPTERS[i].id;
      }
    }
    return 'other';
  }

  function emptySummary(chapter) {
    return {
      id: chapter.id,
      name: chapter.name,
      cue: chapter.cue,
      flashcardTotal: 0,
      quizTotal: 0,
      weakTotal: 0,
      missedTotal: 0,
      flashcardIndexes: [],
      questionIndexes: []
    };
  }

  function buildChapterSummaries(cards, questions, flashcardStatus, missedQuestions) {
    var summaries = {};
    CHAPTERS.forEach(function (chapter) {
      summaries[chapter.id] = emptySummary(chapter);
    });

    cards.forEach(function (card, index) {
      var id = classifyStudyItem(card);
      var summary = summaries[id] || summaries.other;
      var status = flashcardStatus[flashcardKey(card, index)];
      summary.flashcardTotal += 1;
      summary.flashcardIndexes.push(index);
      if (status === 'unsure' || status === 'missed') {
        summary.weakTotal += 1;
      }
    });

    questions.forEach(function (question, index) {
      var id = classifyStudyItem(question);
      var summary = summaries[id] || summaries.other;
      summary.quizTotal += 1;
      summary.questionIndexes.push(index);
      if (missedQuestions[questionKey(question, index)]) {
        summary.missedTotal += 1;
      }
    });

    return CHAPTERS.map(function (chapter) {
      return summaries[chapter.id];
    });
  }

  return {
    CHAPTERS: CHAPTERS,
    classifyStudyItem: classifyStudyItem,
    buildChapterSummaries: buildChapterSummaries
  };
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test site/chapter-model.test.js
```

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add site/chapter-model.js site/chapter-model.test.js
git commit -m "Add chapter classification model"
```

### Task 2: Wire Chapter Playground Markup And Script

**Files:**
- Modify: `site/index.html`

- [ ] **Step 1: Write the failing smoke check**

Run:

```bash
node -e "const fs=require('fs'); const html=fs.readFileSync('site/index.html','utf8'); if(!html.includes('chapter-model.js')) throw new Error('missing chapter model script'); if(!html.includes('chapterGrid')) throw new Error('missing chapter grid'); if(!html.includes('view-chapter')) throw new Error('missing chapter workspace');"
```

Expected: FAIL with `missing chapter model script`.

- [ ] **Step 2: Add markup**

Modify `site/index.html`:

- Add this script before `app.js`:

```html
<script src="./chapter-model.js"></script>
```

- Add this tab after Dashboard:

```html
<button class="tab" data-route="chapter">Chapter</button>
```

- Inside `#view-dashboard`, replace the old two-panel dashboard content with:

```html
<section class="playground-hero" aria-labelledby="dashboard-heading">
  <div>
    <p class="brand-kicker">Chapter Playground</p>
    <h2 id="dashboard-heading">Choose a chapter. Drill the weak spots.</h2>
    <p class="helper">Jump into focused flashcards, quiz practice, cram mode, or mistake review by chemistry chapter.</p>
  </div>
  <div class="actions">
    <button class="btn btn-primary" data-action="start-cram">Global Cram</button>
    <button class="btn btn-ghost" data-route="mistakes">All Mistakes</button>
  </div>
</section>

<section class="chapter-grid" id="chapterGrid" aria-label="Chemistry chapters"></section>
```

- Add this new view before References:

```html
<section id="view-chapter" class="view" data-view="chapter" hidden>
  <article class="chapter-workspace">
    <div class="chapter-head">
      <div>
        <p class="brand-kicker">Focused Chapter</p>
        <h2 id="chapterTitle">Chapter</h2>
        <p class="helper" id="chapterCue"></p>
      </div>
      <div class="chapter-metrics" id="chapterMetrics"></div>
    </div>
    <div class="mode-tabs" aria-label="Chapter tools">
      <button class="mode-tab is-active" data-chapter-mode="overview">Overview</button>
      <button class="mode-tab" data-chapter-mode="flashcards">Flashcards</button>
      <button class="mode-tab" data-chapter-mode="quiz">Quiz</button>
      <button class="mode-tab" data-chapter-mode="cram">Cram</button>
      <button class="mode-tab" data-chapter-mode="mistakes">Mistakes</button>
    </div>
    <div id="chapterPanel" class="chapter-panel"></div>
  </article>
</section>
```

- [ ] **Step 3: Re-run smoke check**

Run the same command from Step 1.

Expected: PASS with no output.

- [ ] **Step 4: Commit**

Run:

```bash
git add site/index.html
git commit -m "Add chapter playground markup"
```

### Task 3: Implement Chapter State And Rendering

**Files:**
- Modify: `site/app.js`
- Test: `site/chapter-model.test.js`

- [ ] **Step 1: Add failing model test for first non-empty chapter selection**

Append to `site/chapter-model.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test**

Run:

```bash
node --test site/chapter-model.test.js
```

Expected: PASS if Task 1 implementation already supports indexes. This is acceptable because the behavior is covered before app wiring.

- [ ] **Step 3: Update app state and helpers**

Modify `site/app.js`:

- Add `selectedChapterId: 'solubility'` and `chapterMode: 'overview'` to `state`.
- Add helpers:

```javascript
function chapterModel() {
  return window.ChapterModel;
}

function getChapterSummaries() {
  return chapterModel().buildChapterSummaries(
    state.flashcards,
    state.questions,
    state.flashcardStatus,
    state.missedQuestions
  );
}

function getSelectedChapterSummary() {
  var summaries = getChapterSummaries();
  return summaries.find(function (summary) {
    return summary.id === state.selectedChapterId;
  }) || summaries[0];
}
```

- Add `renderChapterGrid()` to write cards into `#chapterGrid`.
- Add `renderChapterWorkspace()` to write `#chapterTitle`, `#chapterCue`, `#chapterMetrics`, and `#chapterPanel`.
- Add click handling for `data-chapter-id`, `data-chapter-cram`, and `data-chapter-mode`.
- Call `renderChapterGrid()` in `updateDashboard()`.
- Call `renderChapterWorkspace()` in `switchView('chapter')`.

- [ ] **Step 4: Run syntax check and model tests**

Run:

```bash
node --check site/app.js
node --test site/chapter-model.test.js
```

Expected: both commands pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add site/app.js site/chapter-model.test.js
git commit -m "Render chapter playground"
```

### Task 4: Add Chapter-Filtered Study Actions

**Files:**
- Modify: `site/app.js`

- [ ] **Step 1: Write failing smoke check for action names**

Run:

```bash
node -e "const fs=require('fs'); const js=fs.readFileSync('site/app.js','utf8'); for (const name of ['startChapterCram','renderChapterFlashcardPanel','renderChapterQuizPanel','renderChapterMistakesPanel']) { if(!js.includes(name)) throw new Error('missing '+name); }"
```

Expected: FAIL because these functions do not exist yet.

- [ ] **Step 2: Implement chapter panels**

Modify `site/app.js`:

- Add `startChapterCram(summary)` to set `state.cramFlashcardOrder`, `state.cramQuizOrder`, `state.cramQueue`, and `state.cramIndex` from the selected chapter indexes, then route to global Cram.
- Add `renderChapterFlashcardPanel(summary)` that renders chapter-scoped flashcard controls into `#chapterPanel`.
- Add `renderChapterQuizPanel(summary)` that renders chapter-scoped quiz launch controls and question list counts into `#chapterPanel`.
- Add `renderChapterMistakesPanel(summary)` that renders weak and missed chapter items into `#chapterPanel`.
- In `renderChapterWorkspace()`, switch by `state.chapterMode` and call the panel renderers.

- [ ] **Step 3: Re-run checks**

Run:

```bash
node --check site/app.js
node --test site/chapter-model.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add site/app.js
git commit -m "Add chapter filtered study actions"
```

### Task 5: Modernize Playground Styling

**Files:**
- Modify: `site/styles.css`

- [ ] **Step 1: Write failing CSS smoke check**

Run:

```bash
node -e "const fs=require('fs'); const css=fs.readFileSync('site/styles.css','utf8'); for (const name of ['chapter-grid','chapter-tile','chapter-workspace','mode-tabs','playground-hero']) { if(!css.includes(name)) throw new Error('missing .'+name); }"
```

Expected: FAIL because the new classes are not styled yet.

- [ ] **Step 2: Replace old visual treatment**

Modify `site/styles.css`:

- Use cleaner variables:

```css
:root {
  color-scheme: light;
  --bg: #eef2f6;
  --ink: #101820;
  --surface: #ffffff;
  --surface-alt: #f7fafc;
  --line: #cbd5df;
  --primary: #176b87;
  --primary-strong: #0f4c64;
  --accent: #7b5cff;
  --good: #16734f;
  --bad: #b43b3b;
  --neutral: #6a5b20;
  --shadow: 0 18px 45px rgba(16, 24, 32, 0.1);
}
```

- Remove decorative radial background.
- Add styles for `.playground-hero`, `.chapter-grid`, `.chapter-tile`, `.chapter-tile-head`, `.metric-strip`, `.chapter-workspace`, `.chapter-head`, `.chapter-metrics`, `.mode-tabs`, `.mode-tab`, and `.chapter-panel`.
- Keep mobile breakpoints and add a single-column chapter grid below 720px.

- [ ] **Step 3: Re-run CSS smoke check**

Run the same command from Step 1.

Expected: PASS with no output.

- [ ] **Step 4: Commit**

Run:

```bash
git add site/styles.css
git commit -m "Modernize chapter playground styling"
```

### Task 6: Browser Verification And Docs Copy

**Files:**
- Modify if needed: `site/app.js`, `site/styles.css`, `docs/index.html`, `docs/app.js`, `docs/styles.css`, `docs/chapter-model.js`

- [ ] **Step 1: Run static checks**

Run:

```bash
node --check site/app.js
node --check site/chapter-model.js
node --test site/chapter-model.test.js
```

Expected: PASS.

- [ ] **Step 2: Start local server**

Run:

```bash
python3 -m http.server 4173 --directory site
```

Expected: server starts at `http://localhost:4173`.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:4173` and confirm:

- Chapter tiles render on first screen.
- At least one chapter has flashcard count greater than zero.
- Opening a chapter updates title, metrics, and panel content.
- Chapter mode buttons switch panel content.
- Global Cram, Flashcards, Quiz, Mistakes, and References still navigate.
- Narrow viewport keeps controls readable without overlap.

- [ ] **Step 4: Copy site output to docs**

Run:

```bash
cp site/index.html docs/index.html
cp site/styles.css docs/styles.css
cp site/app.js docs/app.js
cp site/chapter-model.js docs/chapter-model.js
```

Expected: docs mirror deployable site files.

- [ ] **Step 5: Final commit**

Run:

```bash
git add site docs
git commit -m "Build chapter playground experience"
```

## Self-Review

- Spec coverage: chapter model, playground home, chapter workspace, visual refresh, error/empty states, and verification are covered by Tasks 1-6.
- Placeholder scan: no unresolved placeholders are present.
- Type consistency: `selectedChapterId`, `chapterMode`, `CHAPTERS`, `buildChapterSummaries`, and chapter summary field names are consistent across tasks.
