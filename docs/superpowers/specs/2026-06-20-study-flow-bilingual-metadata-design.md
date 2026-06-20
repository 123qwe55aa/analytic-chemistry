# Study Flow, Bilingual UI, and Chapter Metadata Design

## Goal

Turn the analytical chemistry site from a collection of study tools into a guided study system. The dashboard should tell a learner what to do first, core navigation should be immediately understandable in English and Chinese, and chapter assignment should support reliable future mistake review.

## Scope

This change covers four connected improvements:

1. Add a four-step recommended study flow to the dashboard.
2. Add concise bilingual labels to primary navigation, headings, and actions.
3. Introduce explicit study-item metadata while retaining regex classification as a compatibility fallback.
4. Add a minimal npm test entry point for the existing Node test suite.

The change will preserve the existing visual direction, localStorage keys and stored progress, study interactions, and content wording. Existing uncommitted work will be preserved.

## Dashboard Study Flow

Place a `Recommended Study Flow / 推荐学习流程` section between the dashboard hero and chapter grid. It contains four ordered, clickable steps:

1. `Read Chapter Notes / 阅读章节笔记` opens the chapter overview.
2. `Do Chapter Quiz / 完成章节测验` opens the selected chapter's quiz mode.
3. `Review Mistakes / 回顾错题` opens the global mistakes view.
4. `Run Global Cram / 全局冲刺复习` starts a global cram session.

The section must visually communicate sequence, remain readable at mobile widths, and use existing button and typography conventions. It must not introduce a second progress-tracking system.

## Bilingual UI

Use compact `English / 中文` labels for the primary navigation, major study headings, and key actions. Examples include `Flashcards / 卡片记忆`, `Quiz / 测验`, `Mistakes / 错题本`, and `References / 课件资料`.

Question text, flashcard content, rationales, and chemistry terminology remain unchanged. Secondary status labels may remain English where translation would make the interface crowded. Accessibility labels should describe the bilingual destination or action clearly.

## Chapter Metadata Model

Study items may define these fields:

```json
{
  "id": "q001",
  "chapter": "solubility",
  "topic": "Ksp and precipitation",
  "difficulty": 2
}
```

Supported chapter IDs are `solubility`, `redox`, `complexation`, `acid-base`, and `other`. Difficulty is an integer from 1 to 3.

Classification follows this order:

1. Use a valid explicit `chapter` value.
2. If metadata is absent or invalid, classify the item's content with the existing regex rules.
3. If no specific rule matches, use `other`.

This progressive migration keeps legacy content usable while making newly structured content deterministic. Initial data updates will add stable IDs and metadata without removing the fallback.

## Testing and Tooling

Add a minimal root `package.json` with an `npm test` script that runs the chapter model tests with Node's built-in test runner. No runtime dependencies are required.

Tests must cover:

- explicit chapter metadata taking precedence over matching text;
- regex classification for legacy items without metadata;
- invalid metadata falling back safely;
- chapter summaries retaining filtered card and question indexes;
- migrated data using valid IDs, chapter values, topics, and difficulty values.

## File and Publishing Strategy

The working implementation lives in `site/`. After verification, the corresponding deployable files are synchronized to `docs/`, which is the current GitHub Pages copy. Only files involved in this feature are synchronized.

## Error Handling and Compatibility

Missing metadata must never prevent the app from loading. Invalid chapter metadata falls back to content classification. Existing localStorage identifiers remain unchanged so saved weak-card and missed-question progress is not discarded.

The implementation must avoid overwriting unrelated or pre-existing uncommitted changes in `site/index.html` and `site/app.js`.

## Success Criteria

- A first-time user can identify the intended four-step learning sequence from the dashboard.
- Primary study destinations are labeled in both English and Chinese.
- Explicit chapter metadata deterministically controls classification.
- Legacy unstructured items continue to classify and render.
- `npm test` runs successfully from the repository root.
- The `site/` and deployed `docs/` copies contain the same feature behavior.
