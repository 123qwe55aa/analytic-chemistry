(function () {
  'use strict';

  var STORAGE_KEYS = {
    flashcardStatus: 'chem-cram.flashcardStatus',
    missedQuestions: 'chem-cram.missedQuestions',
    lastSession: 'chem-cram.lastSession',
    dailyGoal: 'chem-cram.dailyGoal'
  };

  var CRAM_FLASHCARD_COUNT = 5;
  var CRAM_QUIZ_COUNT = 5;

  var state = {
    loading: true,
    loadError: '',
    activeView: 'dashboard',
    flashcardsTitle: '',
    quizTitle: '',
    flashcards: [],
    questions: [],
    flashcardStatus: {},
    missedQuestions: {},
    flashcardOrder: [],
    flashcardIndex: 0,
    flashcardFlipped: false,
    quizOrder: [],
    quizIndex: 0,
    selectedAnswerIndex: null,
    showHint: false,
    quizSubmitted: false,
    quizScore: 0,
    cramQueue: [],
    cramIndex: 0,
    cramFlashcardOrder: [],
    cramQuizOrder: [],
    cramQuizScore: 0,
    cramStartedAt: null,
    selectedChapterId: 'solubility',
    chapterMode: 'overview',
    dailyGoal: {
      date: '',
      completed: 0,
      target: 30
    }
  };

  function byId(id) {
    return document.getElementById(id);
  }

  var mathRenderTimer = null;

  function queueMathTypeset() {
    if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') {
      return;
    }
    if (mathRenderTimer) {
      clearTimeout(mathRenderTimer);
    }
    mathRenderTimer = setTimeout(function () {
      window.MathJax.typesetPromise().catch(function () {});
      mathRenderTimer = null;
    }, 20);
  }

  function queryAll(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function setText(selector, text) {
    var nodes = queryAll(selector);
    nodes.forEach(function (node) {
      node.textContent = text;
    });
  }

  function setHtml(selector, html) {
    var nodes = queryAll(selector);
    nodes.forEach(function (node) {
      node.innerHTML = html;
    });
  }

  function setHidden(selector, hidden) {
    var nodes = queryAll(selector);
    nodes.forEach(function (node) {
      node.hidden = hidden;
      node.style.display = hidden ? 'none' : '';
    });
  }

  function setDisabled(selector, disabled) {
    var nodes = queryAll(selector);
    nodes.forEach(function (node) {
      node.disabled = !!disabled;
      node.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    });
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch (error) {
      return fallback;
    }
  }

  function persist(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Ignore persistence failures (private mode/quota).
    }
  }

  function loadPersisted() {
    var flashcardStatus = safeParse(localStorage.getItem(STORAGE_KEYS.flashcardStatus), {});
    var missedQuestions = safeParse(localStorage.getItem(STORAGE_KEYS.missedQuestions), {});
    var dailyGoal = safeParse(localStorage.getItem(STORAGE_KEYS.dailyGoal), {});

    state.flashcardStatus = flashcardStatus && typeof flashcardStatus === 'object' ? flashcardStatus : {};
    state.missedQuestions = missedQuestions && typeof missedQuestions === 'object' ? missedQuestions : {};
    if (dailyGoal && typeof dailyGoal === 'object') {
      state.dailyGoal.date = typeof dailyGoal.date === 'string' ? dailyGoal.date : '';
      state.dailyGoal.completed = Number(dailyGoal.completed) || 0;
      state.dailyGoal.target = Number(dailyGoal.target) || 30;
    }
  }

  function getTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function ensureDailyGoalDate() {
    var today = getTodayKey();
    if (state.dailyGoal.date !== today) {
      state.dailyGoal.date = today;
      state.dailyGoal.completed = 0;
      persist(STORAGE_KEYS.dailyGoal, state.dailyGoal);
    }
  }

  function getExamCountdownText() {
    // Assumption: final exam is 14 days from today for first-run planning.
    var target = new Date();
    target.setDate(target.getDate() + 14);
    target.setHours(0, 0, 0, 0);
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);
    if (diff <= 0) {
      return 'Today';
    }
    return diff + ' days left';
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function flashcardKey(card, index) {
    return card.front + '::' + card.back + '::' + index;
  }

  function questionKey(question, index) {
    return question.question + '::' + index;
  }

  function weakFlashcardCount() {
    var count = 0;
    state.flashcards.forEach(function (card, index) {
      var status = state.flashcardStatus[flashcardKey(card, index)];
      if (status === 'unsure' || status === 'missed') {
        count += 1;
      }
    });
    return count;
  }

  function missedQuizCount() {
    var count = 0;
    state.questions.forEach(function (question, index) {
      if (state.missedQuestions[questionKey(question, index)]) {
        count += 1;
      }
    });
    return count;
  }

  function chapterModel() {
    return window.ChapterModel;
  }

  function getChapterSummaries() {
    if (!chapterModel()) {
      return [];
    }
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
    }) || summaries[0] || null;
  }

  function metricChip(label, value) {
    return '<span class="result-chip"><span>' + label + '</span> <strong>' + value + '</strong></span>';
  }

  function renderChapterGrid() {
    var summaries = getChapterSummaries();
    var grid = byId('chapterGrid');
    if (!grid) {
      return;
    }

    if (!summaries.length) {
      grid.innerHTML = '<article class="panel"><p class="helper">Chapter model is not available yet.</p></article>';
      return;
    }

    grid.innerHTML = summaries.map(function (summary) {
      var hasPractice = summary.flashcardTotal || summary.quizTotal;
      return '<article class="chapter-tile">' +
        '<div class="chapter-tile-head">' +
          '<div>' +
            '<p class="card-tag">Chapter</p>' +
            '<h3>' + summary.name + '</h3>' +
          '</div>' +
          '<span class="result-chip">' + (summary.weakTotal + summary.missedTotal) + ' weak</span>' +
        '</div>' +
        '<p class="helper">' + summary.cue + '</p>' +
        '<div class="metric-strip">' +
          metricChip('Cards', summary.flashcardTotal) +
          metricChip('Quiz', summary.quizTotal) +
          metricChip('Weak', summary.weakTotal) +
          metricChip('Missed', summary.missedTotal) +
        '</div>' +
        '<div class="actions">' +
          '<button class="btn btn-primary" data-chapter-id="' + summary.id + '"' + (hasPractice ? '' : ' disabled') + '>Open Chapter</button>' +
          '<button class="btn btn-ghost" data-chapter-cram="' + summary.id + '"' + (hasPractice ? '' : ' disabled') + '>Chapter Cram</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function renderChapterOverview(summary) {
    if (!summary) {
      return '<p class="helper">No chapter selected.</p>';
    }
    return '<div class="split-grid">' +
      '<article class="panel">' +
        '<h3>Chapter Tools</h3>' +
        '<p class="helper">Start with the weakest queue or jump into focused practice for this chapter.</p>' +
        '<div class="actions">' +
          '<button class="btn btn-primary" data-chapter-mode="flashcards"' + (summary.flashcardTotal ? '' : ' disabled') + '>Flashcards</button>' +
          '<button class="btn btn-ghost" data-chapter-mode="quiz"' + (summary.quizTotal ? '' : ' disabled') + '>Quiz</button>' +
          '<button class="btn btn-ghost" data-chapter-mode="mistakes">Mistakes</button>' +
          '<button class="btn btn-ghost" data-chapter-cram="' + summary.id + '"' + ((summary.flashcardTotal || summary.quizTotal) ? '' : ' disabled') + '>Cram</button>' +
        '</div>' +
      '</article>' +
      '<article class="panel">' +
        '<h3>Chapter Snapshot</h3>' +
        '<ul class="stat-list">' +
          '<li><span>Flashcards</span><strong>' + summary.flashcardTotal + '</strong></li>' +
          '<li><span>Quiz Questions</span><strong>' + summary.quizTotal + '</strong></li>' +
          '<li><span>Weak Cards</span><strong>' + summary.weakTotal + '</strong></li>' +
          '<li><span>Missed Questions</span><strong>' + summary.missedTotal + '</strong></li>' +
        '</ul>' +
      '</article>' +
    '</div>';
  }

  function renderChapterFlashcardPanel(summary) {
    var preview = summary.flashcardIndexes.slice(0, 4).map(function (index) {
      var card = state.flashcards[index];
      var status = state.flashcardStatus[flashcardKey(card, index)] || 'unseen';
      return '<li><strong>' + card.front + '</strong><span>' + status + '</span></li>';
    }).join('');

    return '<article class="panel">' +
      '<h3>Chapter Flashcards</h3>' +
      '<p class="helper">Drill only the cards classified under ' + summary.name + '.</p>' +
      '<ul class="mistake-list">' + (preview || '<li>No flashcards in this chapter.</li>') + '</ul>' +
      '<div class="actions">' +
        '<button class="btn btn-primary" data-action="chapter-drill-flashcards"' + (summary.flashcardTotal ? '' : ' disabled') + '>Drill Chapter Deck</button>' +
        '<button class="btn btn-ghost" data-chapter-mode="mistakes">Review Weak Cards</button>' +
      '</div>' +
    '</article>';
  }

  function renderChapterQuizPanel(summary) {
    var preview = summary.questionIndexes.slice(0, 4).map(function (index) {
      var question = state.questions[index];
      var missed = state.missedQuestions[questionKey(question, index)] ? 'missed' : 'ready';
      return '<li><strong>' + question.question + '</strong><span>' + missed + '</span></li>';
    }).join('');

    return '<article class="panel">' +
      '<h3>Chapter Quiz</h3>' +
      '<p class="helper">Practice only the quiz questions classified under this chapter.</p>' +
      '<ul class="mistake-list">' + (preview || '<li>No quiz questions in this chapter.</li>') + '</ul>' +
      '<div class="actions">' +
        '<button class="btn btn-primary" data-action="chapter-practice-quiz"' + (summary.quizTotal ? '' : ' disabled') + '>Practice Chapter Quiz</button>' +
        '<button class="btn btn-ghost" data-chapter-cram="' + summary.id + '"' + ((summary.flashcardTotal || summary.quizTotal) ? '' : ' disabled') + '>Mix Into Cram</button>' +
      '</div>' +
    '</article>';
  }

  function renderChapterMistakesPanel(summary) {
    var weakCards = summary.flashcardIndexes.map(function (index) {
      var card = state.flashcards[index];
      var status = state.flashcardStatus[flashcardKey(card, index)];
      if (status !== 'unsure' && status !== 'missed') {
        return '';
      }
      return '<li><strong>' + card.front + '</strong><span>' + status + '</span></li>';
    }).filter(Boolean).join('');

    var missedQuestions = summary.questionIndexes.map(function (index) {
      var question = state.questions[index];
      var entry = state.missedQuestions[questionKey(question, index)];
      if (!entry) {
        return '';
      }
      return '<li><strong>' + question.question + '</strong><span>missed</span></li>';
    }).filter(Boolean).join('');

    return '<div class="split-grid">' +
      '<article class="panel">' +
        '<h3>Weak Flashcards</h3>' +
        '<ul class="mistake-list">' + (weakCards || '<li>No weak cards in this chapter.</li>') + '</ul>' +
      '</article>' +
      '<article class="panel">' +
        '<h3>Missed Quiz Questions</h3>' +
        '<ul class="mistake-list">' + (missedQuestions || '<li>No missed questions in this chapter.</li>') + '</ul>' +
      '</article>' +
    '</div>';
  }

  function renderChapterWorkspace() {
    var summary = getSelectedChapterSummary();
    if (!summary) {
      setText('#chapterTitle', 'Chapter');
      setText('#chapterCue', 'Choose a chapter from the playground.');
      setHtml('#chapterMetrics', '');
      setHtml('#chapterPanel', '<p class="helper">No chapter data available.</p>');
      return;
    }

    setText('#chapterTitle', summary.name);
    setText('#chapterCue', summary.cue);
    setHtml('#chapterMetrics',
      metricChip('Cards', summary.flashcardTotal) +
      metricChip('Quiz', summary.quizTotal) +
      metricChip('Weak', summary.weakTotal) +
      metricChip('Missed', summary.missedTotal)
    );

    queryAll('[data-chapter-mode]').forEach(function (button) {
      var active = button.getAttribute('data-chapter-mode') === state.chapterMode;
      button.classList.toggle('is-active', active);
    });

    if (state.chapterMode === 'overview') {
      setHtml('#chapterPanel', renderChapterOverview(summary));
    } else if (state.chapterMode === 'flashcards') {
      setHtml('#chapterPanel', renderChapterFlashcardPanel(summary));
    } else if (state.chapterMode === 'quiz') {
      setHtml('#chapterPanel', renderChapterQuizPanel(summary));
    } else if (state.chapterMode === 'mistakes') {
      setHtml('#chapterPanel', renderChapterMistakesPanel(summary));
    } else if (state.chapterMode === 'cram') {
      setHtml('#chapterPanel',
        '<article class="panel">' +
          '<h3>Chapter Cram</h3>' +
          '<p class="helper">Mix up to ' + CRAM_FLASHCARD_COUNT + ' flashcards and ' + CRAM_QUIZ_COUNT + ' quiz questions from this chapter.</p>' +
          '<div class="actions">' +
            '<button class="btn btn-primary" data-chapter-cram="' + summary.id + '"' + ((summary.flashcardTotal || summary.quizTotal) ? '' : ' disabled') + '>Start Chapter Cram</button>' +
          '</div>' +
        '</article>'
      );
    } else {
      setHtml('#chapterPanel', '<article class="panel"><h3>' + summary.name + ' ' + state.chapterMode + '</h3><p class="helper">This chapter tool is ready for filtered practice wiring.</p></article>');
    }
    queueMathTypeset();
  }

  function updateDashboard() {
    ensureDailyGoalDate();
    setText('[data-bind="flashcard-total"], #dashboardFlashcardTotal', String(state.flashcards.length));
    setText('[data-bind="quiz-total"], #dashboardQuizTotal', String(state.questions.length));
    setText('[data-bind="weak-total"], #dashboardWeakTotal', String(weakFlashcardCount()));
    setText('[data-bind="missed-total"], #dashboardMissedTotal', String(missedQuizCount()));
    setText('[data-bind="flashcard-title"], #flashcardsTitle', state.flashcardsTitle || 'Flashcards');
    setText('[data-bind="quiz-title"], #quizTitle', state.quizTitle || 'Quiz');
    setText('#examCountdown', getExamCountdownText());
    setText('#dailyGoalProgress', state.dailyGoal.completed + ' / ' + state.dailyGoal.target);
    renderChapterGrid();
    queueMathTypeset();
  }

  function renderError() {
    var showError = !!state.loadError;
    setHidden('#errorView, [data-view="error"]', !showError);
    setHidden('#appRoot, .app-root, [data-app-root="true"]', showError);
    setText('#errorMessage, [data-bind="error-message"]', state.loadError || '');
  }

  function switchView(view) {
    state.activeView = view;
    var panels = queryAll('[data-view]');
    panels.forEach(function (panel) {
      var isActive = panel.getAttribute('data-view') === view;
      panel.hidden = !isActive;
      panel.style.display = isActive ? '' : 'none';
    });

    queryAll('[data-route]').forEach(function (button) {
      var active = button.getAttribute('data-route') === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });

    if (view === 'dashboard') {
      updateDashboard();
    } else if (view === 'flashcards') {
      renderFlashcards();
    } else if (view === 'quiz') {
      renderQuiz();
    } else if (view === 'mistakes') {
      renderMistakes();
    } else if (view === 'cram') {
      renderCram();
    } else if (view === 'chapter') {
      renderChapterWorkspace();
    }
  }

  function renderFlashcards() {
    if (!state.flashcardOrder.length) {
      state.flashcardOrder = state.flashcards.map(function (_, i) { return i; });
    }

    state.flashcardIndex = clamp(state.flashcardIndex, 0, Math.max(0, state.flashcardOrder.length - 1));
    var orderIndex = state.flashcardOrder[state.flashcardIndex];
    var card = state.flashcards[orderIndex];

    setText('[data-bind="flashcard-position"], #flashcardPosition', state.flashcardOrder.length ? (state.flashcardIndex + 1) + ' / ' + state.flashcardOrder.length : '0 / 0');

    if (!card) {
      setText('[data-bind="flashcard-front"], #flashcardFront', 'No flashcards available.');
      setText('[data-bind="flashcard-back"], #flashcardBack', '');
      setDisabled('#flashcardPrev, [data-action="flashcard-prev"]', true);
      setDisabled('#flashcardNext, [data-action="flashcard-next"]', true);
      setDisabled('#flashcardFlip, [data-action="flashcard-flip"]', true);
      queueMathTypeset();
      return;
    }

    var key = flashcardKey(card, orderIndex);
    var status = state.flashcardStatus[key] || 'unseen';

    setText('[data-bind="flashcard-front"], #flashcardFront', card.front);
    setText('[data-bind="flashcard-back"], #flashcardBack', card.back);
    setHidden('[data-face="front"], #flashcardFrontFace', state.flashcardFlipped);
    setHidden('[data-face="back"], #flashcardBackFace', !state.flashcardFlipped);
    setText('[data-bind="flashcard-status"], #flashcardStatus', 'Status: ' + status);

    setDisabled('#flashcardPrev, [data-action="flashcard-prev"]', state.flashcardIndex <= 0);
    setDisabled('#flashcardNext, [data-action="flashcard-next"]', state.flashcardIndex >= state.flashcardOrder.length - 1);
    setDisabled('#flashcardFlip, [data-action="flashcard-flip"]', false);
    queueMathTypeset();
  }

  function setFlashcardStatus(status) {
    var orderIndex = state.flashcardOrder[state.flashcardIndex];
    var card = state.flashcards[orderIndex];
    if (!card) {
      return;
    }
    state.flashcardStatus[flashcardKey(card, orderIndex)] = status;
    persist(STORAGE_KEYS.flashcardStatus, state.flashcardStatus);
    updateDashboard();
    renderFlashcards();
    renderMistakes();
  }

  function nextFlashcard(step) {
    if (!state.flashcardOrder.length) {
      return;
    }
    state.flashcardIndex = clamp(state.flashcardIndex + step, 0, state.flashcardOrder.length - 1);
    state.flashcardFlipped = false;
    renderFlashcards();
  }

  function shuffleFlashcards() {
    state.flashcardOrder = shuffle(state.flashcardOrder.length ? state.flashcardOrder : state.flashcards.map(function (_, i) { return i; }));
    state.flashcardIndex = 0;
    state.flashcardFlipped = false;
    renderFlashcards();
  }

  function renderQuiz() {
    if (!state.quizOrder.length) {
      state.quizOrder = state.questions.map(function (_, i) { return i; });
    }

    state.quizIndex = clamp(state.quizIndex, 0, Math.max(0, state.quizOrder.length - 1));
    var qIndex = state.quizOrder[state.quizIndex];
    var question = state.questions[qIndex];

    setText('[data-bind="quiz-position"], #quizPosition', state.quizOrder.length ? (state.quizIndex + 1) + ' / ' + state.quizOrder.length : '0 / 0');

    if (!question) {
      setText('[data-bind="quiz-question"], #quizQuestion', 'No quiz questions available.');
      setHtml('[data-bind="quiz-options"], #quizOptions', '');
      setDisabled('#quizSubmit, [data-action="quiz-submit"]', true);
      queueMathTypeset();
      return;
    }

    setText('[data-bind="quiz-question"], #quizQuestion', question.question);

    var optionHtml = question.answerOptions.map(function (option, i) {
      var checked = state.selectedAnswerIndex === i ? 'checked' : '';
      return '<label class="quiz-option">' +
        '<input type="radio" name="quiz-answer" value="' + i + '" ' + checked + '>' +
        '<span>' + option.text + '</span>' +
        '</label>';
    }).join('');

    setHtml('[data-bind="quiz-options"], #quizOptions', optionHtml);

    var hintVisible = state.showHint && question.hint;
    setHidden('[data-bind="quiz-hint"], #quizHint', !hintVisible);
    setText('[data-bind="quiz-hint"], #quizHint', question.hint || '');

    var feedbackVisible = state.quizSubmitted;
    setHidden('[data-bind="quiz-feedback"], #quizFeedback', !feedbackVisible);

    if (state.quizSubmitted && state.selectedAnswerIndex !== null) {
      var selected = question.answerOptions[state.selectedAnswerIndex];
      var correct = !!(selected && selected.isCorrect);
      var feedback = correct ? 'Correct.' : 'Not quite.';
      var rationale = selected ? selected.rationale : '';
      setText('[data-bind="quiz-feedback"], #quizFeedback', feedback + (rationale ? ' ' + rationale : ''));
    } else {
      setText('[data-bind="quiz-feedback"], #quizFeedback', '');
    }

    setDisabled('#quizSubmit, [data-action="quiz-submit"]', state.selectedAnswerIndex === null || state.quizSubmitted);
    setDisabled('#quizPrev, [data-action="quiz-prev"]', state.quizIndex <= 0);
    setDisabled('#quizNext, [data-action="quiz-next"]', state.quizIndex >= state.quizOrder.length - 1);
    setText('[data-bind="quiz-score"], #quizScore', String(state.quizScore));
    queueMathTypeset();
  }

  function setQuizQuestionState(partialReset) {
    state.selectedAnswerIndex = null;
    state.showHint = false;
    state.quizSubmitted = false;
    if (!partialReset) {
      state.quizScore = 0;
    }
  }

  function submitQuizAnswer() {
    if (state.selectedAnswerIndex === null || state.quizSubmitted) {
      return;
    }

    var qIndex = state.quizOrder[state.quizIndex];
    var question = state.questions[qIndex];
    if (!question) {
      return;
    }

    state.quizSubmitted = true;
    var selected = question.answerOptions[state.selectedAnswerIndex];
    var correct = !!(selected && selected.isCorrect);
    var key = questionKey(question, qIndex);

    if (correct) {
      state.quizScore += 1;
      delete state.missedQuestions[key];
    } else {
      state.missedQuestions[key] = {
        question: question.question,
        selectedAnswer: selected ? selected.text : '',
        timestamp: Date.now()
      };
    }

    persist(STORAGE_KEYS.missedQuestions, state.missedQuestions);
    updateDashboard();
    renderQuiz();
    renderMistakes();
  }

  function stepQuiz(step) {
    if (!state.quizOrder.length) {
      return;
    }
    state.quizIndex = clamp(state.quizIndex + step, 0, state.quizOrder.length - 1);
    setQuizQuestionState(true);
    renderQuiz();
  }

  function startCramSession() {
    var cardIndices = shuffle(state.flashcards.map(function (_, i) { return i; })).slice(0, CRAM_FLASHCARD_COUNT);
    var questionIndices = shuffle(state.questions.map(function (_, i) { return i; })).slice(0, CRAM_QUIZ_COUNT);

    state.cramFlashcardOrder = cardIndices;
    state.cramQuizOrder = questionIndices;
    state.cramQueue = cardIndices.map(function (idx) {
      return { type: 'flashcard', index: idx };
    }).concat(questionIndices.map(function (idx) {
      return { type: 'quiz', index: idx };
    }));

    state.cramQueue = shuffle(state.cramQueue);
    state.cramIndex = 0;
    state.cramQuizScore = 0;
    state.cramStartedAt = Date.now();

    persist(STORAGE_KEYS.lastSession, {
      startedAt: state.cramStartedAt,
      flashcards: cardIndices,
      questions: questionIndices
    });

    switchView('cram');
  }

  function startChapterCram(summary) {
    if (!summary) {
      return;
    }
    var cardIndices = shuffle(summary.flashcardIndexes).slice(0, CRAM_FLASHCARD_COUNT);
    var questionIndices = shuffle(summary.questionIndexes).slice(0, CRAM_QUIZ_COUNT);

    state.cramFlashcardOrder = cardIndices;
    state.cramQuizOrder = questionIndices;
    state.cramQueue = cardIndices.map(function (idx) {
      return { type: 'flashcard', index: idx };
    }).concat(questionIndices.map(function (idx) {
      return { type: 'quiz', index: idx };
    }));

    if (!state.cramQueue.length) {
      renderChapterWorkspace();
      return;
    }

    state.cramQueue = shuffle(state.cramQueue);
    state.cramIndex = 0;
    state.cramQuizScore = 0;
    state.cramStartedAt = Date.now();

    persist(STORAGE_KEYS.lastSession, {
      startedAt: state.cramStartedAt,
      chapter: summary.id,
      flashcards: cardIndices,
      questions: questionIndices
    });

    switchView('cram');
  }

  function renderCram() {
    var current = state.cramQueue[state.cramIndex];
    setText('[data-bind="cram-progress"], #cramProgress', state.cramQueue.length ? (state.cramIndex + 1) + ' / ' + state.cramQueue.length : '0 / 0');

    if (!current) {
      setText('[data-bind="cram-type"], #cramType', 'Session Complete');
      setText('[data-bind="cram-prompt"], #cramPrompt', 'Great work. Review mistakes or start another session.');
      setText('[data-bind="cram-score"], #cramScore', String(state.cramQuizScore));
      setHtml('[data-bind="cram-options"], #cramOptions', '');
      setHidden('#cramSubmit, [data-action="cram-submit"]', true);
      queueMathTypeset();
      return;
    }

    if (current.type === 'flashcard') {
      var card = state.flashcards[current.index];
      setText('[data-bind="cram-type"], #cramType', 'Flashcard');
      setText('[data-bind="cram-prompt"], #cramPrompt', card ? card.front + ' -> ' + card.back : 'Missing flashcard');
      setHtml('[data-bind="cram-options"], #cramOptions', '<p>Rate recall:</p><button data-action="cram-rate" data-value="known">Known</button><button data-action="cram-rate" data-value="unsure">Unsure</button><button data-action="cram-rate" data-value="missed">Missed</button>');
      setHidden('#cramSubmit, [data-action="cram-submit"]', true);
    } else {
      var question = state.questions[current.index];
      setText('[data-bind="cram-type"], #cramType', 'Quiz');
      setText('[data-bind="cram-prompt"], #cramPrompt', question ? question.question : 'Missing question');

      var optionsHtml = question ? question.answerOptions.map(function (opt, i) {
        return '<label class="quiz-option"><input type="radio" name="cram-answer" value="' + i + '"><span>' + opt.text + '</span></label>';
      }).join('') : '';
      setHtml('[data-bind="cram-options"], #cramOptions', optionsHtml);
      setHidden('#cramSubmit, [data-action="cram-submit"]', false);
      setDisabled('#cramSubmit, [data-action="cram-submit"]', false);
    }

    setText('[data-bind="cram-score"], #cramScore', String(state.cramQuizScore));
    queueMathTypeset();
  }

  function advanceCram() {
    state.cramIndex += 1;
    renderCram();
    updateDashboard();
    renderMistakes();
  }

  function rateCramFlashcard(status) {
    var current = state.cramQueue[state.cramIndex];
    if (!current || current.type !== 'flashcard') {
      return;
    }
    var card = state.flashcards[current.index];
    if (card) {
      state.flashcardStatus[flashcardKey(card, current.index)] = status;
      persist(STORAGE_KEYS.flashcardStatus, state.flashcardStatus);
    }
    advanceCram();
  }

  function submitCramQuiz() {
    var current = state.cramQueue[state.cramIndex];
    if (!current || current.type !== 'quiz') {
      return;
    }

    var selected = queryAll('input[name="cram-answer"]:checked')[0];
    if (!selected) {
      setDisabled('#cramSubmit, [data-action="cram-submit"]', true);
      return;
    }

    var selectedIndex = Number(selected.value);
    var question = state.questions[current.index];
    if (!question) {
      advanceCram();
      return;
    }

    var selectedOption = question.answerOptions[selectedIndex];
    var correct = !!(selectedOption && selectedOption.isCorrect);
    var key = questionKey(question, current.index);

    if (correct) {
      state.cramQuizScore += 1;
      delete state.missedQuestions[key];
    } else {
      state.missedQuestions[key] = {
        question: question.question,
        selectedAnswer: selectedOption ? selectedOption.text : '',
        timestamp: Date.now()
      };
    }

    persist(STORAGE_KEYS.missedQuestions, state.missedQuestions);
    advanceCram();
  }

  function renderMistakes() {
    var weakCards = [];
    state.flashcards.forEach(function (card, index) {
      var key = flashcardKey(card, index);
      var status = state.flashcardStatus[key];
      if (status === 'unsure' || status === 'missed') {
        weakCards.push({ front: card.front, back: card.back, status: status });
      }
    });

    var missedQuestions = [];
    state.questions.forEach(function (question, index) {
      var key = questionKey(question, index);
      if (state.missedQuestions[key]) {
        missedQuestions.push(state.missedQuestions[key]);
      }
    });

    var weakHtml = weakCards.length
      ? weakCards.map(function (card) { return '<li><strong>' + card.front + '</strong>: ' + card.back + ' (' + card.status + ')</li>'; }).join('')
      : '<li>No weak flashcards.</li>';

    var missedHtml = missedQuestions.length
      ? missedQuestions.map(function (entry) { return '<li><strong>' + entry.question + '</strong> Selected: ' + entry.selectedAnswer + '</li>'; }).join('')
      : '<li>No missed quiz questions.</li>';

    var topicCounts = {};
    var topicPatterns = [
      { key: 'Ksp/Solubility', re: /(ksp|solub|溶|沉淀)/i },
      { key: 'Acid-Base/Titration', re: /(acid|base|titrat|buffer|滴定|酸|碱)/i },
      { key: 'Complexation/EDTA', re: /(complex|edta|coordination|配位)/i },
      { key: 'Redox/Electrochem', re: /(redox|electro|nernst|氧化还原|电极|电化学)/i }
    ];

    missedQuestions.forEach(function (entry) {
      var text = (entry.question || '') + ' ' + (entry.selectedAnswer || '');
      var matched = false;
      topicPatterns.forEach(function (item) {
        if (item.re.test(text)) {
          topicCounts[item.key] = (topicCounts[item.key] || 0) + 1;
          matched = true;
        }
      });
      if (!matched) {
        topicCounts.Other = (topicCounts.Other || 0) + 1;
      }
    });

    var topicList = Object.keys(topicCounts).sort(function (a, b) {
      return topicCounts[b] - topicCounts[a];
    });
    var topicHtml = topicList.length
      ? topicList.map(function (name) { return '<li><strong>' + name + '</strong>: ' + topicCounts[name] + ' item(s)</li>'; }).join('')
      : '<li>No topic hotspots yet.</li>';

    setHtml('[data-bind="mistakes-weak"], #mistakesWeakList', weakHtml);
    setHtml('[data-bind="mistakes-quiz"], #mistakesQuizList', missedHtml);
    setHtml('[data-bind="mistakes-topics"], #mistakesTopicList', topicHtml);

    setDisabled('#clearWeakCards, [data-action="clear-weak-cards"]', weakCards.length === 0);
    setDisabled('#clearMissedQuestions, [data-action="clear-missed-questions"]', missedQuestions.length === 0);
    queueMathTypeset();
  }

  function clearWeakCards() {
    state.flashcards.forEach(function (card, index) {
      var key = flashcardKey(card, index);
      var status = state.flashcardStatus[key];
      if (status === 'unsure' || status === 'missed') {
        delete state.flashcardStatus[key];
      }
    });
    persist(STORAGE_KEYS.flashcardStatus, state.flashcardStatus);
    updateDashboard();
    renderMistakes();
    renderFlashcards();
  }

  function clearMissedQuestions() {
    state.missedQuestions = {};
    persist(STORAGE_KEYS.missedQuestions, state.missedQuestions);
    updateDashboard();
    renderMistakes();
  }

  function bindEvents() {
    document.addEventListener('click', function (event) {
      var target = event.target.closest('[data-route], [data-action], [data-chapter-id], [data-chapter-mode], [data-chapter-cram]');
      if (!target) {
        return;
      }

      var chapterId = target.getAttribute('data-chapter-id');
      if (chapterId) {
        state.selectedChapterId = chapterId;
        state.chapterMode = 'overview';
        switchView('chapter');
        return;
      }

      var chapterMode = target.getAttribute('data-chapter-mode');
      if (chapterMode) {
        state.chapterMode = chapterMode;
        renderChapterWorkspace();
        return;
      }

      var chapterCram = target.getAttribute('data-chapter-cram');
      if (chapterCram) {
        state.selectedChapterId = chapterCram;
        startChapterCram(getSelectedChapterSummary());
        return;
      }

      var route = target.getAttribute('data-route');
      if (route) {
        switchView(route);
        return;
      }

      var action = target.getAttribute('data-action');
      if (!action) {
        return;
      }

      if (action === 'retry-load') {
        loadData();
      } else if (action === 'start-cram') {
        startCramSession();
      } else if (action === 'chapter-drill-flashcards') {
        var flashcardSummary = getSelectedChapterSummary();
        state.flashcardOrder = flashcardSummary ? flashcardSummary.flashcardIndexes.slice() : [];
        state.flashcardIndex = 0;
        state.flashcardFlipped = false;
        switchView('flashcards');
      } else if (action === 'chapter-practice-quiz') {
        var quizSummary = getSelectedChapterSummary();
        state.quizOrder = quizSummary ? quizSummary.questionIndexes.slice() : [];
        state.quizIndex = 0;
        setQuizQuestionState(false);
        switchView('quiz');
      } else if (action === 'flashcard-flip') {
        state.flashcardFlipped = !state.flashcardFlipped;
        renderFlashcards();
      } else if (action === 'flashcard-next') {
        nextFlashcard(1);
      } else if (action === 'flashcard-prev') {
        nextFlashcard(-1);
      } else if (action === 'flashcard-shuffle') {
        shuffleFlashcards();
      } else if (action === 'flashcard-known') {
        setFlashcardStatus('known');
      } else if (action === 'flashcard-unsure') {
        setFlashcardStatus('unsure');
      } else if (action === 'flashcard-missed') {
        setFlashcardStatus('missed');
      } else if (action === 'quiz-submit') {
        submitQuizAnswer();
      } else if (action === 'quiz-next') {
        stepQuiz(1);
      } else if (action === 'quiz-prev') {
        stepQuiz(-1);
      } else if (action === 'quiz-toggle-hint') {
        state.showHint = !state.showHint;
        renderQuiz();
      } else if (action === 'clear-weak-cards') {
        clearWeakCards();
      } else if (action === 'clear-missed-questions') {
        clearMissedQuestions();
      } else if (action === 'cram-submit') {
        submitCramQuiz();
      } else if (action === 'cram-rate') {
        rateCramFlashcard(target.getAttribute('data-value'));
      } else if (action === 'goal-add') {
        ensureDailyGoalDate();
        state.dailyGoal.completed += 1;
        persist(STORAGE_KEYS.dailyGoal, state.dailyGoal);
        updateDashboard();
      } else if (action === 'goal-reset') {
        ensureDailyGoalDate();
        state.dailyGoal.completed = 0;
        persist(STORAGE_KEYS.dailyGoal, state.dailyGoal);
        updateDashboard();
      }
    });

    document.addEventListener('change', function (event) {
      var target = event.target;
      if (!target) {
        return;
      }

      if (target.matches('input[name="quiz-answer"]')) {
        state.selectedAnswerIndex = Number(target.value);
        renderQuiz();
      }

      if (target.matches('input[name="cram-answer"]')) {
        setDisabled('#cramSubmit, [data-action="cram-submit"]', false);
      }
    });
  }

  function normalizeData(data) {
    return Array.isArray(data) ? data : [];
  }

  async function loadData() {
    state.loading = true;
    state.loadError = '';
    renderError();

    try {
      var responses = await Promise.all([
        fetch('data/flashcards.json', { cache: 'no-store' }),
        fetch('data/quiz.json', { cache: 'no-store' })
      ]);

      if (!responses[0].ok || !responses[1].ok) {
        throw new Error('Could not load study data.');
      }

      var flashcardData = await responses[0].json();
      var quizData = await responses[1].json();

      state.flashcardsTitle = flashcardData.title || 'Flashcards';
      state.quizTitle = quizData.title || 'Quiz';
      state.flashcards = normalizeData(flashcardData.cards);
      state.questions = normalizeData(quizData.questions);
      state.flashcardOrder = state.flashcards.map(function (_, i) { return i; });
      state.quizOrder = state.questions.map(function (_, i) { return i; });
      state.flashcardIndex = 0;
      state.quizIndex = 0;
      state.flashcardFlipped = false;
      setQuizQuestionState(false);

      state.loading = false;
      state.loadError = '';
      renderError();
      updateDashboard();
      renderFlashcards();
      renderQuiz();
      renderMistakes();
      renderCram();
      switchView(state.activeView || 'dashboard');
      queueMathTypeset();
    } catch (error) {
      state.loading = false;
      state.loadError = 'Failed to load study data. Check your files and try again.';
      renderError();
    }
  }

  function init() {
    loadPersisted();
    bindEvents();
    switchView('dashboard');
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
