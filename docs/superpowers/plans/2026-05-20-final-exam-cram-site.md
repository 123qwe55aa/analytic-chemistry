# Final Exam Cram Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static one-stop exam cram workspace with dashboard, cram mode, flashcards, quiz, mistakes, and references using local chemistry datasets.

**Architecture:** Implement a single-page static app in `site/` with tabbed views rendered by vanilla JavaScript. Keep all practice state in browser `localStorage` and load flashcard/quiz content from local JSON files under `site/data/`.

**Tech Stack:** HTML, CSS, vanilla JavaScript, local JSON assets, `python3 -m http.server` for local run.

---

### Task 1: Scaffold Static App And Data Assets

**Files:**
- Create: `site/index.html`
- Create: `site/styles.css`
- Create: `site/app.js`
- Create: `site/data/flashcards.json`
- Create: `site/data/quiz.json`
- Create: `site/assets/podcast_analytic_chemistry.mp3`
- Create: `site/assets/Mastering Analytical Equilibria Principles.png`

- [ ] **Step 1: Create static app directories**

Run:

```bash
mkdir -p site/data site/assets
```

Expected: directories exist at `site/data` and `site/assets`.

- [ ] **Step 2: Copy source study data and assets**

Run:

```bash
cp "Chemistry Flashcards.json" "site/data/flashcards.json"
cp "Chemistry Quiz.json" "site/data/quiz.json"
cp "podcast_analytic_chemistry.mp3" "site/assets/podcast_analytic_chemistry.mp3"
cp "Mastering Analytical Equilibria Principles.png" "site/assets/Mastering Analytical Equilibria Principles.png"
```

Expected: all four copied files are present.

- [ ] **Step 3: Commit scaffold assets**

```bash
git add site/data site/assets
git commit -m "chore: add local study datasets and media assets for cram site"
```

### Task 2: Build Cram Workspace UI Shell

**Files:**
- Modify: `site/index.html`
- Modify: `site/styles.css`

- [ ] **Step 1: Add semantic app structure**

Include:

```html
<header class="topbar">...</header>
<main class="layout">
  <nav class="tabs">...</nav>
  <section id="view-dashboard"></section>
  <section id="view-cram" hidden></section>
  <section id="view-flashcards" hidden></section>
  <section id="view-quiz" hidden></section>
  <section id="view-mistakes" hidden></section>
  <section id="view-references" hidden></section>
</main>
```

- [ ] **Step 2: Add responsive visual system in CSS**

Define:

```css
:root { --bg: ...; --surface: ...; --accent: ...; }
```

Include: desktop + mobile layout, button states, tabs, cards, answer states, progress strip.

- [ ] **Step 3: Add lightweight entry animation**

Use CSS keyframes for staggered entrance on dashboard cards and section transitions.

- [ ] **Step 4: Commit UI shell**

```bash
git add site/index.html site/styles.css
git commit -m "feat: build cram workspace shell and responsive styling"
```

### Task 3: Implement Core Data Loading And App State

**Files:**
- Modify: `site/app.js`

- [ ] **Step 1: Implement data loader and normalization**

Add:

```js
async function loadData() {
  const [flashcardsRes, quizRes] = await Promise.all([
    fetch("data/flashcards.json"),
    fetch("data/quiz.json")
  ]);
  // parse and normalize
}
```

- [ ] **Step 2: Implement persistent local state helpers**

Add keys:

```js
const STORAGE_KEYS = {
  flashcardStatus: "chem-cram.flashcardStatus",
  missedQuestions: "chem-cram.missedQuestions",
  lastSession: "chem-cram.lastSession"
};
```

- [ ] **Step 3: Implement tab routing and empty/error states**

Add click handlers for tabs and shared render entrypoints.

- [ ] **Step 4: Commit core state**

```bash
git add site/app.js
git commit -m "feat: add data loading, state persistence, and tab routing"
```

### Task 4: Implement Study Modes (Dashboard, Cram, Flashcards, Quiz, Mistakes, References)

**Files:**
- Modify: `site/app.js`
- Modify: `site/styles.css`

- [ ] **Step 1: Implement dashboard metrics and quick actions**

Render total cards/questions, weak card count, missed question count, and action buttons.

- [ ] **Step 2: Implement flashcard mode**

Include flip, next/prev, shuffle, mark `known/unsure/missed`, progress indicator.

- [ ] **Step 3: Implement quiz mode**

Include option selection, hint reveal, submit, correctness feedback, rationale display, and score counter.

- [ ] **Step 4: Implement cram mode**

Generate mixed session: default 5 flashcards + 5 quiz items, sequence flow, final summary.

- [ ] **Step 5: Implement mistakes and references views**

Show weak material loop and media/reference links (image/audio + PDF links).

- [ ] **Step 6: Commit study modes**

```bash
git add site/app.js site/styles.css
git commit -m "feat: implement cram, flashcards, quiz, mistakes, and references flows"
```

### Task 5: Verify End-To-End And Ship

**Files:**
- Modify: `site/app.js` (if fixes needed)
- Modify: `site/styles.css` (if fixes needed)
- Modify: `site/index.html` (if fixes needed)

- [ ] **Step 1: Run local server**

```bash
cd site
python3 -m http.server 5173
```

Expected: site available at `http://localhost:5173`.

- [ ] **Step 2: Run manual verification checklist**

Verify:
- Dashboard shows 79 flashcards and 15 questions.
- Cram mode completes and returns summary.
- Flashcard status persists after refresh.
- Quiz misses persist after refresh.
- Mistakes view reflects weak items only.
- References view shows image/audio and PDF links.
- Mobile layout is usable.

- [ ] **Step 3: Commit verification fixes**

```bash
git add site
git commit -m "fix: polish cram site interactions and verification issues"
```

- [ ] **Step 4: Push branch**

```bash
git push
```
