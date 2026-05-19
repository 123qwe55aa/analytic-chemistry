# Final Exam Cram Site Design

## Summary

Build a static single-page study site for analytical chemistry final-exam review. The first version is a "cram workspace": the opening screen should help the student start a mixed review session quickly, then branch into flashcards, quiz practice, mistakes, and reference materials.

The site will live under `site/` and run without a backend. It will use the existing local JSON datasets:

- `Chemistry Flashcards.json`: 79 flashcards.
- `Chemistry Quiz.json`: 15 multiple-choice questions with hints and rationales.

Large source PDFs and media remain in the project folder, but the MVP links to them as reference resources instead of parsing them.

## Product Goal

Create a one-stop final-exam review and practice website that makes the next useful study action obvious:

- Start a mixed cram session.
- Drill flashcards.
- Answer exam-style questions.
- Rework missed questions and uncertain cards.
- Open reference materials and the generated audio review.

The experience should feel like a compact exam command center, not a landing page.

## User Flows

### Dashboard

The dashboard is the first view. It shows the available study inventory and fast actions:

- Total flashcards.
- Total quiz questions.
- Number of weak flashcards marked as `unsure` or `missed`.
- Number of missed quiz questions.
- Primary action: start a cram session.
- Secondary actions: flashcards, quiz, mistakes, references.

The dashboard should be useful on both desktop and mobile, with the primary action visible without scrolling.

### Cram Session

Cram mode is the core flow. A session mixes a small set of flashcards and quiz questions:

- Default session shape: 5 random flashcards and 5 random quiz questions, or all available items when fewer are eligible.
- Flashcard steps let the user flip the card and mark confidence.
- Quiz steps let the user select an option, reveal an optional hint, submit, then read rationale feedback.
- A final results screen summarizes correct quiz answers, missed questions, and weak flashcards.

The session should use the existing JSON content directly and should not require accounts or network access.

### Flashcards

Flashcard mode supports focused recall:

- Flip front/back.
- Next and previous.
- Shuffle.
- Mark each card as `known`, `unsure`, or `missed`.
- Show progress through the current deck.

Marked confidence is stored locally so the mistakes view and dashboard can reflect weak items.

### Quiz Practice

Quiz mode supports one-question-at-a-time practice:

- Show the question and answer options.
- Optional hint reveal.
- Submit selected answer.
- Show correctness and rationale for every option.
- Move to the next question.
- Track score for the current run.

Wrong answers are stored locally as missed questions.

### Mistakes

Mistakes mode focuses only on weak material:

- Flashcards marked `unsure` or `missed`.
- Quiz questions answered incorrectly.
- Actions to clear an item after review.
- Empty state when there are no weak items.

This view should make it easy to repeat weak material without restarting a full cram session.

### References

References mode gives quick access to deeper study materials:

- Display or link the large concept-map image.
- List local PDFs as reference resources.
- Link or embed the generated podcast audio.

PDF parsing, search indexing, and document summarization are out of scope for the MVP.

## Architecture

Use a self-contained static app:

```text
site/
  index.html
  styles.css
  app.js
  data/
    flashcards.json
    quiz.json
  assets/
    podcast_analytic_chemistry.mp3
```

The app should be plain HTML, CSS, and JavaScript. This keeps the first version fast to build, easy to inspect, and simple to deploy through GitHub Pages or any static host.

## Data Flow

At startup:

1. Fetch `data/flashcards.json` from the static site root.
2. Fetch `data/quiz.json` from the static site root.
3. Normalize data into internal card and question arrays.
4. Load local progress from `localStorage`.
5. Render dashboard.

During study:

- Flashcard confidence writes to `localStorage`.
- Quiz misses write to `localStorage`.
- Session state stays in memory until the session ends.

Recommended local storage keys:

- `chem-cram.flashcardStatus`
- `chem-cram.missedQuestions`
- `chem-cram.lastSession`

## UI Direction

The site should feel like a focused exam workspace:

- Compact and information-dense.
- Clear tab navigation.
- Strong primary action for starting a cram session.
- No marketing hero or explanatory landing page.
- Mobile-friendly controls for quick review.

The visual style should avoid a generic AI-dashboard look. Use a restrained chemistry/exam identity with clear contrast, purposeful typography, and a few tactile details like progress strips and answer state colors.

## Error Handling

The app should handle:

- JSON load failures with a clear message and retry button.
- Empty mistakes list with a positive empty state.
- Quiz submit without selected answer by keeping the submit button disabled.
- Missing optional assets by hiding unavailable reference links.

## Testing And Verification

Manual verification for MVP:

- Start local server from `site/`.
- Confirm dashboard counts show 79 flashcards and 15 questions.
- Confirm cram mode completes and produces results.
- Confirm flashcard confidence persists after refresh.
- Confirm quiz missed questions persist after refresh.
- Confirm mistakes mode only shows weak material.
- Confirm references links and audio render when assets exist.
- Confirm mobile layout at narrow width.

Automated tests are optional for the first static MVP. If added, keep them lightweight around data normalization and score calculations.

## Non-Goals

The MVP will not include:

- User accounts.
- Backend APIs.
- PDF parsing.
- Full-text search.
- AI question generation.
- Multi-course support.
- Cloud sync.

These can be added later after the local cram workflow feels good.

## Implementation Notes

Create `site/data/` by copying the existing JSON files into browser-friendly names. Copy the generated podcast MP3 into `site/assets/`. Large PDFs and images can stay in the project root and be referenced from the references view if pathing works under the local server; otherwise copy only the concept map image needed for the MVP.

Keep `app.js` modular even without a framework:

- State helpers.
- Data loading helpers.
- View render functions.
- Event handlers.
- Study mode logic.

If `app.js` grows beyond roughly 500 lines or the project expands into routing, analytics, or multiple courses, migrate to Vite/React.
