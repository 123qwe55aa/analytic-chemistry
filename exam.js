(function () {
  'use strict';

  var STORAGE_KEY = 'chem-cram.examMistakes';
  var state = {
    exams: [],
    activeExam: null,
    questions: [],
    index: 0,
    answers: {},
    submitted: false,
    score: 0,
    startedAt: 0,
    endedAt: 0,
    randomize: true,
    requestedCount: 20
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function typeset() {
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      window.MathJax.typesetPromise().catch(function () {});
    }
  }

  function selectedLabels(question) {
    return state.answers[question.id] || [];
  }

  function correctLabels(question) {
    if (Array.isArray(question.correctAnswers)) {
      return question.correctAnswers.slice().sort();
    }
    if (typeof question.correctAnswer === 'string') {
      return question.correctAnswer.split(/[,，、\s]+/).filter(Boolean).sort();
    }
    return question.answerOptions.filter(function (option) { return option.isCorrect; }).map(function (option) { return option.label; }).sort();
  }

  function isCorrect(question) {
    var selected = selectedLabels(question).slice().sort();
    var correct = correctLabels(question);
    return selected.length === correct.length && selected.every(function (label, index) { return label === correct[index]; });
  }

  function totalScore() {
    return state.questions.reduce(function (sum, question) {
      return sum + (Number(question.score) || 0);
    }, 0);
  }

  function persistMistakes() {
    var mistakes = state.questions.filter(function (question) {
      return !isCorrect(question);
    }).map(function (question) {
      return {
        id: question.id,
        examId: state.activeExam ? state.activeExam.id : '',
        examTitle: state.activeExam ? state.activeExam.title : '',
        question: question.question,
        selectedAnswer: selectedLabels(question).join(', ') || '(blank)',
        correctAnswer: correctLabels(question).join(', '),
        timestamp: Date.now()
      };
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mistakes));
    } catch (error) {
      // Ignore localStorage failures.
    }
  }

  function renderEmpty(root) {
    root.innerHTML =
      '<article class="panel">' +
        '<h3>No extracted exam data yet / 暂无考试题库数据</h3>' +
        '<p class="helper">Put exported Chaoxing homework HTML files into <code>raw-html/</code> or <code>homework/</code>, then run:</p>' +
        '<pre><code>npm run extract:exams</code></pre>' +
        '<p class="helper">The script will generate <code>data/exams.json</code>. Refresh this page after committing or serving the generated file.</p>' +
      '</article>';
  }

  function renderExamChooser(root) {
    if (!state.exams.length) {
      renderEmpty(root);
      return;
    }

    var cards = state.exams.map(function (exam) {
      var count = Array.isArray(exam.questions) ? exam.questions.length : 0;
      return '<article class="chapter-tile">' +
        '<div class="chapter-tile-head">' +
          '<div>' +
            '<p class="card-tag">' + escapeHtml(exam.source || 'HTML export') + '</p>' +
            '<h3>' + escapeHtml(exam.title || exam.id) + '</h3>' +
          '</div>' +
          '<span class="result-chip">' + count + ' Qs</span>' +
        '</div>' +
        '<p class="helper">Score: ' + escapeHtml(exam.totalScore || count * 5) + ' · Choose all questions or a random subset.</p>' +
        '<div class="actions">' +
          '<button class="btn btn-primary" data-exam-start="' + escapeHtml(exam.id) + '" data-random="false">Start All / 全部开始</button>' +
          '<button class="btn btn-ghost" data-exam-start="' + escapeHtml(exam.id) + '" data-random="true">Random / 随机组卷</button>' +
        '</div>' +
      '</article>';
    }).join('');

    root.innerHTML =
      '<div class="section-heading">' +
        '<div><p class="brand-kicker">Extracted from HTML / 从 HTML 提取</p><h3>Choose a paper / 选择试卷</h3></div>' +
        '<label class="helper">Random count: <input id="examQuestionCount" type="number" min="1" max="200" value="' + state.requestedCount + '" style="width: 5rem"></label>' +
      '</div>' +
      '<section class="chapter-grid">' + cards + '</section>';
  }

  function startExam(examId, randomize) {
    var exam = state.exams.find(function (item) { return item.id === examId; });
    if (!exam || !Array.isArray(exam.questions)) return;

    var countInput = byId('examQuestionCount');
    var requestedCount = countInput ? Number(countInput.value) || exam.questions.length : exam.questions.length;
    var questions = randomize ? shuffle(exam.questions).slice(0, requestedCount) : exam.questions.slice();

    state.activeExam = exam;
    state.questions = questions;
    state.index = 0;
    state.answers = {};
    state.submitted = false;
    state.score = 0;
    state.startedAt = Date.now();
    state.endedAt = 0;
    state.randomize = randomize;
    state.requestedCount = requestedCount;
    renderExam();
  }

  function renderQuestion(root) {
    var question = state.questions[state.index];
    if (!question) {
      renderExamChooser(root);
      return;
    }

    var type = question.type === 'multiple' ? 'checkbox' : 'radio';
    var selected = selectedLabels(question);
    var options = question.answerOptions.map(function (option) {
      var checked = selected.includes(option.label) ? 'checked' : '';
      return '<label class="quiz-option">' +
        '<input type="' + type + '" name="exam-answer" value="' + escapeHtml(option.label) + '" ' + checked + (state.submitted ? ' disabled' : '') + '>' +
        '<span>' + escapeHtml(option.label) + '. ' + escapeHtml(option.text) + '</span>' +
      '</label>';
    }).join('');

    var feedback = '';
    if (state.submitted) {
      feedback = '<p class="helper">' +
        (isCorrect(question) ? 'Correct. / 正确。' : 'Wrong. / 错误。') +
        ' Correct answer: ' + escapeHtml(correctLabels(question).join(', ')) +
      '</p>';
    }

    root.innerHTML =
      '<article class="panel">' +
        '<div class="section-heading">' +
          '<div>' +
            '<p class="brand-kicker">' + escapeHtml(state.activeExam.title) + '</p>' +
            '<h3>Question ' + (state.index + 1) + ' / ' + state.questions.length + '</h3>' +
          '</div>' +
          '<span class="result-chip">Score: ' + state.score + ' / ' + totalScore() + '</span>' +
        '</div>' +
        '<h3>' + escapeHtml(question.question) + '</h3>' +
        '<div class="stack">' + options + '</div>' +
        feedback +
        '<div class="actions">' +
          '<button class="btn btn-ghost" data-exam-nav="prev"' + (state.index <= 0 ? ' disabled' : '') + '>Prev / 上一题</button>' +
          '<button class="btn btn-ghost" data-exam-nav="next"' + (state.index >= state.questions.length - 1 ? ' disabled' : '') + '>Next / 下一题</button>' +
          '<button class="btn btn-primary" data-exam-submit-paper"' + (state.submitted ? ' disabled' : '') + '>Submit Paper / 交卷</button>' +
          '<button class="btn btn-ghost" data-exam-reset>Back to Papers / 返回试卷</button>' +
        '</div>' +
      '</article>';
    typeset();
  }

  function renderResult(root) {
    var total = totalScore();
    var wrong = state.questions.filter(function (question) { return !isCorrect(question); });
    var usedSeconds = state.endedAt && state.startedAt ? Math.round((state.endedAt - state.startedAt) / 1000) : 0;
    var wrongHtml = wrong.length ? wrong.map(function (question) {
      return '<li><strong>' + escapeHtml(question.question) + '</strong><br>' +
        'Your answer: ' + escapeHtml(selectedLabels(question).join(', ') || '(blank)') + '<br>' +
        'Correct: ' + escapeHtml(correctLabels(question).join(', ')) + '</li>';
    }).join('') : '<li>No mistakes. / 没有错题。</li>';

    root.innerHTML =
      '<article class="panel">' +
        '<h3>Exam Report / 考试报告</h3>' +
        '<div class="metric-strip">' +
          '<span class="result-chip"><span>Score</span> <strong>' + state.score + ' / ' + total + '</strong></span>' +
          '<span class="result-chip"><span>Accuracy</span> <strong>' + (total ? Math.round(state.score / total * 100) : 0) + '%</strong></span>' +
          '<span class="result-chip"><span>Wrong</span> <strong>' + wrong.length + '</strong></span>' +
          '<span class="result-chip"><span>Time</span> <strong>' + usedSeconds + 's</strong></span>' +
        '</div>' +
        '<h3>Wrong Questions / 错题</h3>' +
        '<ul class="mistake-list">' + wrongHtml + '</ul>' +
        '<div class="actions">' +
          '<button class="btn btn-primary" data-exam-review>Review One by One / 逐题回顾</button>' +
          '<button class="btn btn-ghost" data-exam-reset>Choose Another Paper / 选择其他试卷</button>' +
        '</div>' +
      '</article>';
  }

  function finishExam() {
    state.score = state.questions.reduce(function (sum, question) {
      return sum + (isCorrect(question) ? Number(question.score) || 0 : 0);
    }, 0);
    state.submitted = true;
    state.endedAt = Date.now();
    persistMistakes();
    renderExam();
  }

  function renderExam() {
    var root = byId('examRoot');
    if (!root) return;
    if (!state.activeExam || !state.questions.length) {
      renderExamChooser(root);
    } else if (state.submitted) {
      renderResult(root);
    } else {
      renderQuestion(root);
    }
  }

  async function loadExams() {
    try {
      var response = await fetch('data/exams.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Missing data/exams.json');
      var data = await response.json();
      state.exams = Array.isArray(data.exams) ? data.exams : [];
    } catch (error) {
      state.exams = [];
    }
    renderExam();
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-route="exam"], [data-exam-start], [data-exam-nav], [data-exam-submit-paper], [data-exam-reset], [data-exam-review]');
    if (!target) return;

    if (target.matches('[data-route="exam"]')) {
      setTimeout(renderExam, 0);
      return;
    }

    var examId = target.getAttribute('data-exam-start');
    if (examId) {
      startExam(examId, target.getAttribute('data-random') === 'true');
      return;
    }

    var nav = target.getAttribute('data-exam-nav');
    if (nav === 'prev') {
      state.index = Math.max(0, state.index - 1);
      renderExam();
    } else if (nav === 'next') {
      state.index = Math.min(state.questions.length - 1, state.index + 1);
      renderExam();
    } else if (target.hasAttribute('data-exam-submit-paper')) {
      finishExam();
    } else if (target.hasAttribute('data-exam-reset')) {
      state.activeExam = null;
      state.questions = [];
      state.answers = {};
      state.submitted = false;
      renderExam();
    } else if (target.hasAttribute('data-exam-review')) {
      state.index = 0;
      renderQuestion(byId('examRoot'));
    }
  });

  document.addEventListener('change', function (event) {
    if (!event.target.matches('input[name="exam-answer"]')) return;
    var question = state.questions[state.index];
    if (!question || state.submitted) return;
    var inputs = Array.prototype.slice.call(document.querySelectorAll('input[name="exam-answer"]:checked'));
    state.answers[question.id] = inputs.map(function (input) { return input.value; });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadExams);
  } else {
    loadExams();
  }
})();
