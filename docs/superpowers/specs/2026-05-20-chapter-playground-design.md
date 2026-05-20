# Chapter Playground Redesign

## Summary

Redesign the analytical chemistry cram site from a flat tabbed dashboard into a chapter-based playground. The first screen should make chapters the main way to enter the study flow, while each chapter exposes the same practical tools: overview, flashcards, quiz practice, cram, mistakes, and references.

The app remains a static site under `site/` using plain HTML, CSS, and JavaScript. The existing JSON files do not currently include chapter metadata, so the first implementation will classify cards and questions in the browser using topic keyword rules.

## Product Goal

Make the site feel like an interactive study playground instead of an old static page. A student should be able to choose a chemistry chapter, see the available practice inventory for that chapter, and immediately start a useful activity.

## Chapter Model

The initial chapters will be derived from existing content patterns:

- Solubility & Ksp
- Redox Titration
- Complexation & EDTA
- Acid-Base / Titration
- Instrumental / Other

Each flashcard and quiz question will be assigned to one chapter with a deterministic classifier. If multiple chapter rules match, the first matching chapter wins. If no rule matches, the item goes to `Instrumental / Other`.

## User Experience

### Playground Home

The dashboard becomes a chapter playground:

- A compact header with total flashcards, quiz questions, weak items, and missed questions.
- A main grid of chapter tiles.
- Each tile shows chapter name, short cue text, flashcard count, quiz count, weak count, and missed count.
- Tile actions let the user open the chapter or start a chapter cram session.
- Existing global actions remain available, but they become secondary.

### Chapter Workspace

Selecting a chapter opens a focused workspace for that chapter:

- Chapter title and progress summary.
- Segmented controls for `Overview`, `Flashcards`, `Quiz`, `Cram`, and `Mistakes`.
- Chapter flashcards only cycle through items in that chapter.
- Chapter quiz only cycles through questions in that chapter.
- Chapter cram mixes cards and questions from that chapter.
- Mistakes show weak cards and missed quiz questions from that chapter.

### Global Views

The existing top-level views remain for fallback and full-dataset practice:

- Cram
- Flashcards
- Quiz
- Mistakes
- References

The home screen should encourage chapter-first use, but users can still access full mixed practice.

## Visual Direction

Move away from the beige, old-dashboard feel. The redesigned UI should be modern, compact, and tool-like:

- Use a cleaner neutral background with high-contrast surfaces.
- Make chapter tiles structured and scannable.
- Use small status chips for counts and progress.
- Keep cards at modest border radius.
- Avoid marketing hero treatment; the first screen is the usable app.
- Preserve MathJax readability and mobile usability.

## Architecture

Keep the static app structure:

```text
site/
  index.html
  styles.css
  app.js
  data/
    flashcards.json
    quiz.json
```

Implementation changes:

- Add chapter definitions and classification helpers in `app.js`.
- Track `selectedChapterId` and `chapterMode` in state.
- Add render functions for chapter tiles and chapter workspace.
- Reuse existing flashcard, quiz, cram, and mistakes logic where possible by filtering active indexes.
- Update `index.html` to include the new playground and chapter workspace markup.
- Replace the old visual styling in `styles.css` with the new playground layout.

## Error Handling

- If a chapter has no quiz questions, disable chapter quiz and cram quiz actions that require questions.
- If a chapter has no flashcards, disable chapter flashcard actions.
- Empty chapter mistakes show a clear empty state.
- JSON load failures continue to show the existing retry screen.

## Testing And Verification

Manual verification:

- Start a local server from `site/`.
- Confirm the home screen shows chapter tiles with nonzero counts.
- Confirm opening a chapter filters flashcards and quiz questions to that chapter.
- Confirm chapter cram works when both cards and questions exist.
- Confirm weak flashcards and missed quiz questions appear in the correct chapter.
- Confirm full global flashcard, quiz, cram, mistakes, and references views still work.
- Check mobile layout at a narrow viewport.

## Non-Goals

- Do not manually rewrite all JSON content with chapter fields in this pass.
- Do not add backend storage, accounts, or sync.
- Do not add PDF parsing or search.
- Do not replace the static app with a framework.
