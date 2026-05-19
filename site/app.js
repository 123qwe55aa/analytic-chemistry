(function () {
  'use strict';

  var STORAGE_KEYS = {
    flashcardStatus: 'chem-cram.flashcardStatus',
    missedQuestions: 'chem-cram.missedQuestions',
    lastSession: 'chem-cram.lastSession'
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
    cramStartedAt: null
  };

  function byId(id) {
    return document.getElementById(id);
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

    state.flashcardStatus = flashcardStatus && typeof flashcardStatus === 'object' ? flashcardStatus : {};
    state.missedQuestions = missedQuestions && typeof missedQuestions === 'object' ? missedQuestions : {};
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

  function updateDashboard() {
    setText('[data-bind="flashcard-total"], #dashboardFlashcardTotal', String(state.flashcards.length));
    setText('[data-bind="quiz-total"], #dashboardQuizTotal', String(state.questions.length));
    setText('[data-bind="weak-total"], #dashboardWeakTotal', String(weakFlashcardCount()));
    setText('[data-bind="missed-total"], #dashboardMissedTotal', String(missedQuizCount()));
    setText('[data-bind="flashcard-title"], #flashcardsTitle', state.flashcardsTitle || 'Flashcards');
    setText('[data-bind="quiz-title"], #quizTitle', state.quizTitle || 'Quiz');
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

  function renderCram() {
    var current = state.cramQueue[state.cramIndex];
    setText('[data-bind="cram-progress"], #cramProgress', state.cramQueue.length ? (state.cramIndex + 1) + ' / ' + state.cramQueue.length : '0 / 0');

    if (!current) {
      setText('[data-bind="cram-type"], #cramType', 'Session Complete');
      setText('[data-bind="cram-prompt"], #cramPrompt', 'Great work. Review mistakes or start another session.');
      setText('[data-bind="cram-score"], #cramScore', String(state.cramQuizScore));
      setHtml('[data-bind="cram-options"], #cramOptions', '');
      setHidden('#cramSubmit, [data-action="cram-submit"]', true);
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

    setHtml('[data-bind="mistakes-weak"], #mistakesWeakList', weakHtml);
    setHtml('[data-bind="mistakes-quiz"], #mistakesQuizList', missedHtml);

    setDisabled('#clearWeakCards, [data-action="clear-weak-cards"]', weakCards.length === 0);
    setDisabled('#clearMissedQuestions, [data-action="clear-missed-questions"]', missedQuestions.length === 0);
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
      var target = event.target.closest('[data-route], [data-action]');
      if (!target) {
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
