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

  var CHAPTER_IDS = CHAPTERS.reduce(function (lookup, chapter) {
    lookup[chapter.id] = true;
    return lookup;
  }, {});

  var CHAPTER_OVERRIDES_BY_ID = {
    f020: 'redox',
    f026: 'redox',
    f029: 'redox',
    f031: 'redox',
    f032: 'complexation',
    f038: 'complexation',
    f043: 'complexation',
    f045: 'complexation',
    f046: 'complexation',
    f051: 'complexation',
    f061: 'complexation',
    f062: 'complexation',
    f063: 'complexation',
    f075: 'complexation',
    q005: 'complexation',
    q006: 'complexation',
    q010: 'complexation',
    q014: 'other',
    q015: 'complexation'
  };

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

  function overrideChapter(item) {
    if (!item || typeof item !== 'object') {
      return '';
    }
    var override = CHAPTER_OVERRIDES_BY_ID[item.id];
    return CHAPTER_IDS[override] ? override : '';
  }

  function classifyStudyItem(item) {
    var override = overrideChapter(item);
    if (override) {
      return override;
    }

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
    CHAPTER_IDS: CHAPTER_IDS,
    CHAPTER_OVERRIDES_BY_ID: CHAPTER_OVERRIDES_BY_ID,
    classifyStudyItem: classifyStudyItem,
    buildChapterSummaries: buildChapterSummaries
  };
}));
