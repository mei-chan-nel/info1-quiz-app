const startView = document.querySelector("#startView");
const statusBar = document.querySelector("#statusBar");
const questionView = document.querySelector("#questionView");
const summaryView = document.querySelector("#summaryView");
const startButton = document.querySelector("#startButton");
const clearFiltersButton = document.querySelector("#clearFiltersButton");
const fieldFilters = document.querySelector("#fieldFilters");
const questionCount = document.querySelector("#questionCount");
const setSizeValue = document.querySelector("#setSizeValue");
const increaseSetSizeButton = document.querySelector("#increaseSetSizeButton");
const decreaseSetSizeButton = document.querySelector("#decreaseSetSizeButton");
const progressText = document.querySelector("#progressText");
const progressFill = document.querySelector("#progressFill");
const setStatus = document.querySelector("#setStatus");
const calcMode = document.querySelector("#calcMode");
const questionStem = document.querySelector("#questionStem");
const choices = document.querySelector("#choices");
const questionSource = document.querySelector("#questionSource");
const nextButton = document.querySelector("#nextButton");
const resultPanel = document.querySelector("#resultPanel");
const resultMark = document.querySelector("#resultMark");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");
const explanation = document.querySelector("#explanation");
const summaryTitle = document.querySelector("#summaryTitle");
const summaryRate = document.querySelector("#summaryRate");
const summaryList = document.querySelector("#summaryList");
const retryButton = document.querySelector("#retryButton");
const finishButton = document.querySelector("#finishButton");

const STORAGE_KEY = "info1QuizStats:v4";
const DEFAULT_SET_SIZE = 5;
const MIN_SET_SIZE = 1;
const MAX_SET_SIZE = 50;
const SUPABASE_URL = "https://yygezzpowsvpzarqdtls.supabase.co";
// Supabase publishable keys are designed for browser clients. Never use a secret or service_role key here.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rQmX7MCx_8W3nz-xWXQBpA_CHzdRQSk";

const TEXT = {
  loadError: "問題データを読み込めません",
  notStarted: "未開始",
  running: "挑戦中",
  saving: "集計中",
  finish: "終了する",
  next: "次の問題",
  summary: "結果を見る",
  empty: "条件に合う問題がありません。",
  correct: "正解",
  incorrect: "不正解",
  result: "結果",
  answer: "正答",
  selected: "選んだ選択肢",
  unanswered: "未解答",
  outOfScopeReport: "範囲外報告",
  you: "あなた",
  statsUnavailable: "公開版では選択率を保存・表示できません。",
};

const FIELD_DEFINITIONS = [
  {
    id: "society_security",
    label: "社会・セキュリティ",
    needles: [
      "情報社会",
      "情報セキュリティ",
      "著作権",
      "肖像権",
      "個人情報",
      "不正アクセス",
      "フィッシング",
      "マルウェア",
      "認証",
      "パスワード",
      "暗号",
      "ディジタル署名",
      "デジタル署名",
      "バックアップ",
      "機密性",
      "完全性",
      "可用性",
      "アクセス制御",
      "ハッシュ",
    ],
  },
  {
    id: "digital",
    label: "デジタル表現",
    needles: [
      "bit",
      "ビット",
      "バイト",
      "2進数",
      "16進数",
      "データ量",
      "デジタル表現",
      "画像",
      "音声",
      "動画",
      "標本化",
      "量子化",
      "符号化",
      "圧縮",
      "論理演算",
      "AND",
      "OR",
      "XOR",
      "CPU",
      "主記憶",
      "ファイル",
    ],
  },
  {
    id: "network",
    label: "ネットワーク",
    needles: [
      "ネットワーク",
      "IPアドレス",
      "IPv4",
      "IPv6",
      "DNS",
      "DHCP",
      "TCP",
      "UDP",
      "パケット",
      "LAN",
      "Web",
      "Webページ",
      "URL",
      "HTTP",
      "E-mail",
      "電子メール",
    ],
  },
  {
    id: "data_db",
    label: "データ活用・DB",
    needles: [
      "データ活用",
      "データベース",
      "RDB",
      "主キー",
      "外部キー",
      "フィールド",
      "レコード",
      "テーブル",
      "平均",
      "中央値",
      "最頻値",
      "標準偏差",
      "グラフ",
      "欠損",
      "外れ値",
      "匿名",
    ],
  },
  {
    id: "algorithm",
    label: "アルゴリズム",
    needles: [
      "プログラム",
      "アルゴリズム",
      "条件分岐",
      "繰返し",
      "変数",
      "配列",
      "探索",
      "並べ替え",
      "シミュレーション",
      "確率",
      "チェックディジット",
      "関数",
      "フローチャート",
    ],
  },
  {
    id: "design",
    label: "情報デザイン",
    needles: [
      "情報デザイン",
      "ユーザインタフェース",
      "UI",
      "アクセシビリティ",
      "可読性",
      "視認性",
      "入力",
      "ピクトグラム",
    ],
  },
];

const FIELD_ID_SET = new Set(FIELD_DEFINITIONS.map((definition) => definition.id));

const state = {
  allQuestions: [],
  sessionQuestions: [],
  responses: [],
  outOfScopeReports: {},
  pastChoiceStats: {},
  sessionChoiceStats: {},
  currentIndex: 0,
  selectedChoiceId: null,
  history: loadHistory(),
  setSize: DEFAULT_SET_SIZE,
  questionDataStatus: "loading",
  apiAvailable: false,
  apiAvailabilityStatus: "checking",
  apiAvailabilityPromise: Promise.resolve(false),
  sessionId: 0,
  pastStatsPromise: Promise.resolve(),
  pastStatsLoading: false,
  pastStatsLoaded: false,
  sessionHistoryRecorded: false,
  responseSubmission: null,
  pendingResponseSubmissions: [],
  outOfScopeSubmission: null,
  pendingOutOfScopeSubmissions: [],
  cumulativeTotal: 0,
  cumulativeCorrect: 0,
  sessionSummaryRecorded: false,
};

init();

function init() {
  renderFieldFilters();
  bindStartControls();
  showStart();
  void loadQuestionData();
  state.apiAvailabilityPromise = initializeApiAvailability();
}

async function loadQuestionData() {
  try {
    const response = await fetch("../data/questions/completed_questions.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.allQuestions = await response.json();
    state.questionDataStatus = "ready";
    updateStartControls();
  } catch (error) {
    state.questionDataStatus = "error";
    updateStartControls();
    console.error(error);
  }
}

async function initializeApiAvailability() {
  const available = await detectApiAvailability();
  state.apiAvailable = available;
  state.apiAvailabilityStatus = available ? "available" : "unavailable";
  if (!summaryView.hidden) {
    renderSummary();
  }
  if (available) {
    retryPendingSubmissions();
  }
  return available;
}

async function detectApiAvailability() {
  try {
    await callSupabaseRpc("get_question_stats", { p_ids: [] });
    return true;
  } catch {
    return false;
  }
}

function bindStartControls() {
  startButton.addEventListener("click", () => {
    resetCumulativeResults();
    startSession();
  });

  clearFiltersButton.addEventListener("click", () => {
    const inputs = fieldFilters.querySelectorAll("input[type='checkbox']");
    const shouldSelectAll = !Array.from(inputs).some((input) => input.checked);
    for (const input of inputs) {
      input.checked = shouldSelectAll;
    }
    updateStartControls();
  });

  increaseSetSizeButton.addEventListener("click", () => {
    changeSetSize(1);
  });

  decreaseSetSizeButton.addEventListener("click", () => {
    changeSetSize(-1);
  });

  calcMode.addEventListener("change", () => {
    updateStartControls();
  });

  fieldFilters.addEventListener("change", () => {
    updateStartControls();
  });
}

nextButton.addEventListener("click", async () => {
  if (state.currentIndex >= state.sessionQuestions.length - 1) {
    await showSummary();
    return;
  }
  state.currentIndex += 1;
  renderQuestion();
  scrollToTop();
});

retryButton.addEventListener("click", async () => {
  await completeSummaryExit();
  startSession();
});

finishButton.addEventListener("click", async () => {
  await completeSummaryExit();
  showStart();
  retryPendingSubmissions();
});

document.addEventListener("keydown", (event) => {
  if (questionView.hidden || resultPanel.hidden === false) {
    return;
  }
  const index = Number(event.key);
  if (!Number.isInteger(index)) {
    return;
  }
  const question = currentQuestion();
  const choice = question?.choices.find((item) => item.displayLabel === String(index));
  if (choice) {
    selectChoice(choice.choice_id);
  }
});

function showStart() {
  resetSessionState();
  startView.hidden = false;
  statusBar.hidden = true;
  questionView.hidden = true;
  summaryView.hidden = true;
  setStatus.textContent = TEXT.notStarted;
  progressFill.style.width = "0%";
  updateStartControls();
  progressText.textContent = `0/${state.setSize}`;
}

function resetSessionState() {
  state.sessionId += 1;
  state.sessionQuestions = [];
  state.responses = [];
  state.outOfScopeReports = {};
  state.pastChoiceStats = {};
  state.sessionChoiceStats = {};
  state.currentIndex = 0;
  state.selectedChoiceId = null;
  state.pastStatsPromise = Promise.resolve();
  state.pastStatsLoading = false;
  state.pastStatsLoaded = false;
  state.sessionHistoryRecorded = false;
  state.sessionSummaryRecorded = false;
  state.responseSubmission = null;
  state.outOfScopeSubmission = null;
  retryButton.disabled = false;
  finishButton.disabled = false;
  finishButton.textContent = TEXT.finish;
  summaryView.querySelector(".end-message")?.remove();
}

function startSession() {
  const pool = getQuestionPool();
  if (!pool.length) {
    updateStartControls();
    return;
  }
  state.sessionId += 1;
  const sessionId = state.sessionId;
  updateSetSizeControls(pool.length);
  state.sessionQuestions = pickRandomSet(pool, Math.min(state.setSize, pool.length)).map(prepareSessionQuestion);
  state.responses = state.sessionQuestions.map((question) => ({
    questionId: question.id,
    selectedChoiceId: null,
    isCorrect: null,
  }));
  state.outOfScopeReports = {};
  state.pastChoiceStats = {};
  state.sessionChoiceStats = {};
  state.currentIndex = 0;
  state.selectedChoiceId = null;
  state.pastStatsPromise = Promise.resolve();
  state.pastStatsLoading = false;
  state.pastStatsLoaded = false;
  state.sessionHistoryRecorded = false;
  state.sessionSummaryRecorded = false;
  state.responseSubmission = null;
  state.outOfScopeSubmission = null;

  startView.hidden = true;
  statusBar.hidden = false;
  questionView.hidden = false;
  summaryView.hidden = true;
  setStatus.textContent = TEXT.running;
  retryButton.disabled = false;
  finishButton.disabled = false;
  finishButton.textContent = TEXT.finish;
  summaryView.querySelector(".end-message")?.remove();
  renderQuestion();
  scrollToTop();
  loadPastChoiceStats(sessionId, state.sessionQuestions.map((question) => question.id));
  retryPendingSubmissions();
}

function renderFieldFilters() {
  if (fieldFilters.querySelectorAll("input[type='checkbox']").length === FIELD_DEFINITIONS.length) {
    return;
  }
  fieldFilters.replaceChildren(
    ...FIELD_DEFINITIONS.map((definition) => {
      const label = document.createElement("label");
      label.className = "field-chip";
      label.innerHTML = `
        <input type="checkbox" value="${escapeHtml(definition.id)}" checked />
        <span>${escapeHtml(definition.label)}</span>
      `;
      return label;
    }),
  );
}

function updateStartControls() {
  updateFieldSelectionButton();

  if (state.questionDataStatus === "loading") {
    questionCount.textContent = "";
    questionCount.classList.add("metric-loading");
    updateSetSizeControls(0);
    startButton.disabled = true;
    startButton.textContent = "―読込中―";
    return;
  }

  questionCount.classList.remove("metric-loading");
  if (state.questionDataStatus === "error" || !state.allQuestions.length) {
    questionCount.textContent = "-";
    updateSetSizeControls(0);
    startButton.disabled = true;
    startButton.textContent = TEXT.loadError;
    return;
  }

  const pool = getQuestionPool();
  questionCount.textContent = `${pool.length}問`;
  updateSetSizeControls(pool.length);
  startButton.disabled = pool.length === 0;
  startButton.textContent = pool.length === 0 ? TEXT.empty : "挑戦を開始";
}

function updateFieldSelectionButton() {
  const hasSelectedField = fieldFilters.querySelector("input[type='checkbox']:checked") !== null;
  clearFiltersButton.textContent = hasSelectedField ? "全解除" : "全選択";
}

function resetCumulativeResults() {
  state.cumulativeTotal = 0;
  state.cumulativeCorrect = 0;
}

function changeSetSize(delta) {
  const poolLength = getQuestionPool().length;
  const max = getSetSizeMax(poolLength);
  state.setSize = Math.min(Math.max(state.setSize + delta, MIN_SET_SIZE), max);
  updateStartControls();
}

function updateSetSizeControls(poolLength) {
  const max = getSetSizeMax(poolLength);
  if (poolLength > 0) {
    state.setSize = Math.min(Math.max(state.setSize, MIN_SET_SIZE), max);
  }
  setSizeValue.textContent = `${state.setSize}問`;
  decreaseSetSizeButton.disabled = poolLength === 0 || state.setSize <= MIN_SET_SIZE;
  increaseSetSizeButton.disabled = poolLength === 0 || state.setSize >= max;
}

function getSetSizeMax(poolLength) {
  return poolLength > 0 ? Math.max(MIN_SET_SIZE, Math.min(MAX_SET_SIZE, poolLength)) : MAX_SET_SIZE;
}

function getQuestionPool() {
  const selectedFields = getSelectedFields();
  if (!selectedFields.length) {
    return [];
  }
  return state.allQuestions.filter((question) => {
    if (!matchesCalcMode(question)) {
      return false;
    }
    if (selectedFields.length === FIELD_DEFINITIONS.length) {
      return true;
    }
    return selectedFields.some((definition) => questionMatchesField(question, definition));
  });
}

function getSelectedFields() {
  const selectedIds = new Set(
    Array.from(fieldFilters.querySelectorAll("input[type='checkbox']:checked")).map((input) => input.value),
  );
  return FIELD_DEFINITIONS.filter((definition) => selectedIds.has(definition.id));
}

function getCalcModeValue() {
  return calcMode.querySelector("input[name='calcMode']:checked")?.value || "all";
}

function matchesCalcMode(question) {
  const mode = getCalcModeValue();
  if (mode === "only") {
    return question.difficulty === "calculation_basic";
  }
  if (mode === "without") {
    return question.difficulty !== "calculation_basic";
  }
  return true;
}

function questionMatchesField(question, definition) {
  return getQuestionFieldIds(question).has(definition.id);
}

function getQuestionFieldIds(question) {
  if (question.__fieldIds) {
    return question.__fieldIds;
  }

  const explicitFields = []
    .concat(Array.isArray(question.fields) ? question.fields : [])
    .concat(Array.isArray(question.field_ids) ? question.field_ids : [])
    .filter((fieldId) => FIELD_ID_SET.has(fieldId));
  const inferredFields = FIELD_DEFINITIONS
    .filter((definition) => fieldNeedlesMatch(question, definition))
    .map((definition) => definition.id);

  question.__fieldIds = new Set([...explicitFields, ...inferredFields]);
  return question.__fieldIds;
}

function fieldNeedlesMatch(question, definition) {
  const searchText = getQuestionSearchText(question);
  return definition.needles.some((needle) => searchText.includes(needle));
}

function getQuestionSearchText(question) {
  if (question.__searchText) {
    return question.__searchText;
  }
  const primaryTerms = Array.isArray(question.primary_terms) ? question.primary_terms : [];
  question.__searchText = [
    ...(question.tags || []),
    ...(question.primary_term_names || []),
    ...primaryTerms.flatMap((term) => [term.term, term.category, term.code]),
  ]
    .filter(Boolean)
    .join(" ");
  return question.__searchText;
}

function pickRandomSet(questions, count) {
  return shuffleArray(questions).slice(0, count);
}

function prepareSessionQuestion(question) {
  const answerChoiceId = getAnswerChoiceId(question);
  const shuffledChoices = shuffleArray(question.choices).map((choice, index) => {
    const choiceId = getChoiceId(question, choice);
    return {
      ...choice,
      choice_id: choiceId,
      displayLabel: String(index),
      is_correct: isChoiceCorrect(question, choice, choiceId, answerChoiceId),
    };
  });

  return {
    ...question,
    answer_choice_id: answerChoiceId,
    choices: shuffledChoices,
  };
}

function currentQuestion() {
  return state.sessionQuestions[state.currentIndex];
}

function currentResponse() {
  return state.responses[state.currentIndex];
}

function renderQuestion() {
  const question = currentQuestion();
  const total = state.sessionQuestions.length;

  state.selectedChoiceId = null;
  resultPanel.hidden = true;
  nextButton.hidden = true;
  nextButton.disabled = false;
  nextButton.textContent = state.currentIndex >= total - 1 ? TEXT.summary : TEXT.next;

  if (!question) {
    renderEmptyState();
    return;
  }

  questionStem.textContent = question.stem;
  renderChoices(question);
  renderSourceNote(question);
  updateProgressView();
}

function renderEmptyState() {
  questionStem.textContent = TEXT.empty;
  choices.replaceChildren();
  questionSource.textContent = "";
  questionSource.hidden = true;
  progressText.textContent = "0/0";
  progressFill.style.width = "0%";
}

function renderChoices(question) {
  choices.replaceChildren(
    ...question.choices.map((choice) => {
      const button = document.createElement("button");
      button.className = "choice-button";
      button.type = "button";
      button.dataset.choiceId = choice.choice_id;
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = `
        <span class="choice-label">${escapeHtml(choice.displayLabel)}</span>
        <span class="choice-text">${escapeHtml(choice.text)}</span>
      `;
      button.addEventListener("click", () => selectChoice(choice.choice_id));
      return button;
    }),
  );
}

function renderSourceNote(question) {
  const sourceText = formatSourceNote(question);
  questionSource.textContent = sourceText ? `出典：${sourceText}` : "";
  questionSource.hidden = !sourceText;
}

function selectChoice(choiceId) {
  const question = currentQuestion();
  const response = currentResponse();
  if (!question || !response || response.selectedChoiceId !== null) {
    return;
  }
  state.selectedChoiceId = choiceId;
  grade(question);
}

function grade(question) {
  const response = currentResponse();
  const correctChoice = getCorrectChoice(question);
  const selectedChoice = findChoice(question, state.selectedChoiceId);
  const isCorrect = Boolean(correctChoice && selectedChoice?.choice_id === correctChoice.choice_id);
  response.selectedChoiceId = state.selectedChoiceId;
  response.isCorrect = isCorrect;
  recordSessionChoiceStats(question, selectedChoice, isCorrect);

  for (const button of choices.querySelectorAll(".choice-button")) {
    button.disabled = true;
    button.setAttribute("aria-pressed", String(button.dataset.choiceId === state.selectedChoiceId));
    if (button.dataset.choiceId === correctChoice?.choice_id) {
      button.classList.add("correct");
    } else if (button.dataset.choiceId === state.selectedChoiceId) {
      button.classList.add("incorrect");
    }
  }

  resultPanel.hidden = false;
  resultMark.textContent = isCorrect ? "○" : "!";
  resultMark.className = `result-mark ${isCorrect ? "right" : "wrong"}`;
  resultTitle.textContent = isCorrect ? TEXT.correct : TEXT.incorrect;
  resultText.hidden = shouldShowChoiceReasonList(question);
  resultText.textContent = resultText.hidden ? "" : `${TEXT.answer}: ${formatChoice(correctChoice)}`;
  explanation.textContent = buildExplanation(question, selectedChoice, correctChoice);

  nextButton.hidden = false;
  updateProgressView();
}

async function showSummary() {
  nextButton.disabled = true;
  statusBar.hidden = true;
  questionView.hidden = true;
  summaryView.hidden = false;
  setStatus.textContent = TEXT.result;
  recordCumulativeResults();
  renderSummary();
  scrollToTop();
  recordSessionHistory();
  const submission = createResponseSubmission();
  if (submission) {
    void submitResponseSubmission(submission);
  }
}

function recordCumulativeResults() {
  if (state.sessionSummaryRecorded) {
    return;
  }
  state.cumulativeTotal += state.sessionQuestions.length;
  state.cumulativeCorrect += state.responses.filter((response) => response.isCorrect).length;
  state.sessionSummaryRecorded = true;
}

function renderSummary() {
  const correct = state.cumulativeCorrect;
  const total = state.cumulativeTotal;
  const rate = total ? Math.round((correct / total) * 100) : 0;

  summaryTitle.textContent = `${total}問中 ${correct}問正解`;
  summaryRate.textContent = `${rate}%`;

  summaryList.replaceChildren(
    ...state.sessionQuestions.map((question, index) => {
      const response = state.responses[index];
      const selectedChoice = findChoice(question, response.selectedChoiceId);
      const correctChoice = getCorrectChoice(question);
      const item = document.createElement("article");
      item.className = "summary-item";
      item.innerHTML = `
        <div class="summary-item-head">
          <span class="summary-number">${index + 1}</span>
          <span class="summary-status ${response.isCorrect ? "right" : "wrong"}">
            ${response.isCorrect ? TEXT.correct : TEXT.incorrect}
          </span>
          ${renderOutOfScopeReportAction(question)}
        </div>
        <div class="summary-body">
          <p class="summary-stem">${escapeHtml(question.stem)}</p>
          ${renderChoiceStats(question, selectedChoice, correctChoice)}
          ${renderSummaryExplanation(question, selectedChoice, correctChoice)}
          ${renderSummarySourceNote(question)}
        </div>
      `;
      if (state.apiAvailable) {
        for (const button of item.querySelectorAll(".scope-report-button")) {
          button.addEventListener("click", () => toggleOutOfScopeReport(button.dataset.id));
        }
        refreshOutOfScopeReportButton(item, question.id);
      }
      return item;
    }),
  );
}

function renderSummaryExplanation(question, selectedChoice, correctChoice) {
  const answer = shouldShowChoiceReasonList(question)
    ? ""
    : `<p>${TEXT.answer}: ${escapeHtml(formatChoice(correctChoice))}</p>`;
  return `
    <section class="result-panel summary-result-panel">
      ${answer}
      <p class="explanation">${escapeHtml(buildExplanation(question, selectedChoice, correctChoice))}</p>
    </section>
  `;
}

function renderOutOfScopeReportAction(question) {
  if (!state.apiAvailable) {
    return "";
  }
  return `
    <div class="scope-report-action">
      <button class="scope-report-button" type="button" data-id="${escapeHtml(question.id)}">${TEXT.outOfScopeReport}</button>
    </div>
  `;
}

function renderSummarySourceNote(question) {
  const sourceText = formatSourceNote(question);
  if (!sourceText) {
    return "";
  }
  return `<p class="summary-source">出典：${escapeHtml(sourceText)}</p>`;
}

function renderChoiceStats(question, selectedChoice, correctChoice) {
  const stats = getDisplayChoiceStats(question.id);
  const attempts = Number(stats?.attempts || 0);
  const choiceCounts = stats?.choices || {};
  const showSharedStats = state.apiAvailable;
  const rows = question.choices
    .map((choice) => {
      const count = Number(choiceCounts[choice.choice_id] || 0);
      const percent = attempts ? Math.round((count / attempts) * 100) : 0;
      const marker = getChoiceReviewMarker(choice, selectedChoice, correctChoice);
      const classes = [
        "choice-stat",
        selectedChoice?.choice_id === choice.choice_id ? "selected" : "",
        correctChoice?.choice_id === choice.choice_id ? "correct" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const rate = attempts ? `${percent}%` : "-";
      const sharedStatsColumns = showSharedStats
        ? `
          <span class="choice-stat-rate">${escapeHtml(rate)}</span>
        `
        : "";
      return `
        <div class="${classes}" style="--bar-width: ${percent}%">
          <span class="choice-stat-label">${escapeHtml(choice.displayLabel)}</span>
          <span class="choice-stat-text">
            ${escapeHtml(choice.text)}
            ${marker ? `<span class="choice-review-marker">${marker}</span>` : ""}
          </span>
          ${sharedStatsColumns}
        </div>
      `;
    })
    .join("");
  const listClass = showSharedStats ? "choice-stat-list" : "choice-stat-list session-review";
  const statsNote = showSharedStats ? "" : `<p class="shared-stats-disabled">${TEXT.statsUnavailable}</p>`;
  return `<div class="${listClass}" aria-label="選択肢">${rows}</div>${statsNote}`;
}

function getChoiceReviewMarker(choice, selectedChoice, correctChoice) {
  const isSelected = selectedChoice?.choice_id === choice.choice_id;
  const isCorrect = correctChoice?.choice_id === choice.choice_id;
  if (isSelected && isCorrect) {
    return "（正解）";
  }
  if (isCorrect) {
    return "（正答）";
  }
  if (isSelected) {
    return "（あなた）";
  }
  return "";
}

function toggleOutOfScopeReport(questionId) {
  state.outOfScopeReports[questionId] = !state.outOfScopeReports[questionId];
  const item = summaryList.querySelector(`[data-id="${cssEscape(questionId)}"]`)?.closest(".summary-item");
  if (item) {
    refreshOutOfScopeReportButton(item, questionId);
  }
}

function refreshOutOfScopeReportButton(item, questionId) {
  for (const button of item.querySelectorAll(".scope-report-button")) {
    button.classList.toggle("active-scope", Boolean(state.outOfScopeReports[questionId]));
  }
}

function recordSessionChoiceStats(question, selectedChoice, isCorrect) {
  if (!question || !selectedChoice) {
    return;
  }
  const stats = state.sessionChoiceStats[question.id] ?? {
    attempts: 0,
    correct: 0,
    choices: {},
  };
  stats.attempts += 1;
  stats.correct += isCorrect ? 1 : 0;
  stats.choices[selectedChoice.choice_id] = Number(stats.choices[selectedChoice.choice_id] || 0) + 1;
  state.sessionChoiceStats[question.id] = stats;
}

function recordSessionHistory() {
  if (state.sessionHistoryRecorded) {
    return;
  }
  for (const [index, question] of state.sessionQuestions.entries()) {
    const response = state.responses[index];
    if (response.selectedChoiceId === null) {
      continue;
    }
    const item = state.history[question.id] ?? { attempts: 0, correct: 0 };
    item.attempts += 1;
    item.correct += response.isCorrect ? 1 : 0;
    state.history[question.id] = item;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  state.sessionHistoryRecorded = true;
}

function loadPastChoiceStats(sessionId, questionIds) {
  if (!questionIds.length) {
    return state.pastStatsPromise;
  }

  const request = (async () => {
    const available = await state.apiAvailabilityPromise;
    if (!available || state.sessionId !== sessionId) {
      return;
    }
    state.pastStatsLoading = true;
    try {
      const stats = await requestQuestionStats(questionIds);
      if (state.sessionId !== sessionId) {
        return;
      }
      state.pastChoiceStats = stats;
      state.pastStatsLoaded = true;
      if (!summaryView.hidden) {
        renderSummary();
      }
    } catch (error) {
      console.error("過去の選択肢別統計を取得できませんでした。", error);
    } finally {
      if (state.sessionId === sessionId) {
        state.pastStatsLoading = false;
      }
    }
  })();
  state.pastStatsPromise = request;
  return request;
}

function createResponseSubmission() {
  if (state.responseSubmission || state.apiAvailabilityStatus === "unavailable") {
    return state.responseSubmission;
  }
  const responses = state.responses
    .filter((response) => response.selectedChoiceId !== null)
    .map((response) => ({ ...response }));
  if (!responses.length) {
    return null;
  }
  const submission = {
    sessionId: state.sessionId,
    questionIds: state.sessionQuestions.map((question) => question.id),
    responses,
    pastStatsPromise: state.pastStatsPromise,
    status: "queued",
    promise: null,
  };
  state.responseSubmission = submission;
  state.pendingResponseSubmissions.push(submission);
  return submission;
}

async function submitResponseSubmission(submission) {
  if (!submission || submission.status === "sent") {
    return;
  }
  if (submission.promise) {
    return submission.promise;
  }
  submission.promise = (async () => {
    const available = await state.apiAvailabilityPromise;
    if (!available) {
      submission.status = "failed";
      return;
    }
    submission.status = "sending";
    try {
      // Keep the initial server snapshot separate from this session's answers.
      await submission.pastStatsPromise;
      await postResults({ responses: submission.responses, outOfScopeReports: [] });
      submission.status = "sent";
      removePendingSubmission(state.pendingResponseSubmissions, submission);
      void replaceWithLatestChoiceStats(submission);
    } catch (error) {
      submission.status = "failed";
      console.error("回答結果を送信できませんでした。後で再送します。", error);
    } finally {
      submission.promise = null;
    }
  })();
  return submission.promise;
}

async function replaceWithLatestChoiceStats(submission) {
  try {
    const latestStats = await requestQuestionStats(submission.questionIds);
    if (state.sessionId !== submission.sessionId) {
      return;
    }
    state.pastChoiceStats = latestStats;
    state.sessionChoiceStats = {};
    state.pastStatsLoaded = true;
    if (!summaryView.hidden) {
      renderSummary();
    }
  } catch (error) {
    console.error("送信後の選択肢別統計を取得できませんでした。", error);
  }
}

function createOutOfScopeSubmission() {
  if (state.outOfScopeSubmission || state.apiAvailabilityStatus === "unavailable") {
    return state.outOfScopeSubmission;
  }
  const outOfScopeReports = Object.entries(state.outOfScopeReports)
    .filter(([, isReported]) => isReported)
    .map(([questionId]) => questionId);
  if (!outOfScopeReports.length) {
    return null;
  }
  const submission = {
    outOfScopeReports,
    status: "queued",
    promise: null,
  };
  state.outOfScopeSubmission = submission;
  state.pendingOutOfScopeSubmissions.push(submission);
  return submission;
}

async function commitOutOfScopeReports() {
  const submission = createOutOfScopeSubmission();
  return submitOutOfScopeSubmission(submission);
}

async function completeSummaryExit() {
  retryButton.disabled = true;
  finishButton.disabled = true;
  await Promise.all([
    submitResponseSubmission(state.responseSubmission),
    commitOutOfScopeReports(),
  ]);
}

function retryPendingSubmissions() {
  for (const submission of state.pendingResponseSubmissions) {
    if (submission.status === "queued" || submission.status === "failed") {
      void submitResponseSubmission(submission);
    }
  }
  for (const submission of state.pendingOutOfScopeSubmissions) {
    if (submission.status === "queued" || submission.status === "failed") {
      void submitOutOfScopeSubmission(submission);
    }
  }
}

async function submitOutOfScopeSubmission(submission) {
  if (!submission || submission.status === "sent") {
    return;
  }
  if (submission.promise) {
    return submission.promise;
  }
  submission.promise = (async () => {
    const available = await state.apiAvailabilityPromise;
    if (!available) {
      submission.status = "failed";
      return;
    }
    submission.status = "sending";
    try {
      await postResults({ responses: [], outOfScopeReports: submission.outOfScopeReports });
      submission.status = "sent";
      removePendingSubmission(state.pendingOutOfScopeSubmissions, submission);
    } catch (error) {
      submission.status = "failed";
      console.error("範囲外報告を送信できませんでした。後で再送します。", error);
    } finally {
      submission.promise = null;
    }
  })();
  return submission.promise;
}

function removePendingSubmission(submissions, submission) {
  const index = submissions.indexOf(submission);
  if (index >= 0) {
    submissions.splice(index, 1);
  }
}

function getDisplayChoiceStats(questionId) {
  return mergeChoiceStats(state.pastChoiceStats[questionId], state.sessionChoiceStats[questionId]);
}

function mergeChoiceStats(pastStats, sessionStats) {
  const stats = [pastStats, sessionStats].filter(Boolean);
  const merged = { attempts: 0, correct: 0, choices: {} };
  for (const source of stats) {
    merged.attempts += Number(source.attempts || 0);
    merged.correct += Number(source.correct || 0);
    for (const [choiceId, count] of Object.entries(source.choices || {})) {
      merged.choices[choiceId] = Number(merged.choices[choiceId] || 0) + Number(count || 0);
    }
  }
  return merged;
}

async function postResults(payload) {
  return callSupabaseRpc("record_quiz_results", {
    p_responses: Array.isArray(payload.responses) ? payload.responses : [],
    p_out_of_scope_reports: Array.isArray(payload.outOfScopeReports) ? payload.outOfScopeReports : [],
  });
}

async function requestQuestionStats(questionIds) {
  if (!questionIds.length) {
    return {};
  }
  const payload = await callSupabaseRpc("get_question_stats", { p_ids: questionIds });
  return payload.questions || {};
}

async function callSupabaseRpc(functionName, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function updateProgressView() {
  const total = state.sessionQuestions.length;
  const answered = state.responses.filter((response) => response.selectedChoiceId !== null).length;
  const displayIndex = Math.min(state.currentIndex + 1, total);
  progressText.textContent = total ? `${displayIndex}/${total}` : "0/0";
  progressFill.style.width = total ? `${Math.round((answered / total) * 100)}%` : "0%";
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatSourceNote(question) {
  const source = normalizeSourceDisplay(question.source_display || question.source_question_ids?.[0] || "");
  if (!source) {
    return "";
  }

  const suffix = getSourceSuffix(question, source);
  return suffix ? `${source}${suffix}` : source;
}

function normalizeSourceDisplay(value) {
  let source = String(value || "").trim();
  if (!source) {
    return "";
  }

  const legacyIpMatch = source.match(/^ip_2011h23_special_all_q(\d{3})$/);
  if (legacyIpMatch) {
    return `ITパスポート試験 H23特別試験 問${Number(legacyIpMatch[1])}`;
  }

  source = source
    .replace(/^ITパスポート(?=[HR])/, "ITパスポート試験 ")
    .replace(/^基本情報技術者(?=[HR])/, "基本情報技術者試験 ")
    .replace(/^応用情報技術者(?=[HR])/, "応用情報技術者試験 ")
    .replace(/^情報セキュリティマネジメント(?=[HR])/, "情報セキュリティマネジメント試験 ")
    .replace(/^共通テスト(?=[HR])/, "大学入学共通テスト ")
    .replace(/([春秋]期)午前/g, "$1 午前")
    .replace(/\s+/g, " ")
    .trim();

  return source;
}

function getSourceSuffix(question, normalizedSource) {
  const isAdapted = question["改題"] === true;
  const isCommonTest = normalizedSource.includes("大学入学共通テスト");
  if (isCommonTest && !isAdapted) {
    return "（抜粋）";
  }
  if (isAdapted) {
    return "（改題）";
  }
  return "";
}

function getChoiceId(question, choice) {
  return String(choice.choice_id || `${question.id}__choice_${choice.label}`);
}

function getAnswerChoiceId(question) {
  if (question.answer_choice_id) {
    return String(question.answer_choice_id);
  }
  const correctChoice = question.choices.find(
    (choice) => choice.is_correct || String(choice.label) === String(question.correct_choice),
  );
  return correctChoice ? getChoiceId(question, correctChoice) : "";
}

function isChoiceCorrect(question, choice, choiceId, answerChoiceId) {
  if (answerChoiceId) {
    return choiceId === answerChoiceId;
  }
  return Boolean(choice.is_correct) || String(choice.label) === String(question.correct_choice);
}

function getCorrectChoice(question) {
  return (
    question.choices.find((choice) => choice.choice_id === question.answer_choice_id) ||
    question.choices.find((choice) => choice.is_correct) ||
    null
  );
}

function findChoice(question, choiceId) {
  if (choiceId === null || choiceId === undefined) {
    return null;
  }
  return question.choices.find((choice) => choice.choice_id === choiceId) || null;
}

function formatChoice(choice) {
  if (!choice) {
    return TEXT.unanswered;
  }
  return `${choice.displayLabel} ${choice.text}`;
}

function buildExplanation(question, selectedChoice, correctChoice) {
  if (shouldShowChoiceReasonList(question)) {
    return buildChoiceReasonListExplanation(question, selectedChoice, correctChoice);
  }

  return buildSimpleExplanation(question, selectedChoice, correctChoice);
}

function buildSimpleExplanation(question, selectedChoice, correctChoice) {
  const general = String(question.explanation || "").trim();
  const parts = [];
  if (general) {
    parts.push(general);
  }

  if (
    selectedChoice &&
    correctChoice &&
    selectedChoice.choice_id !== correctChoice.choice_id &&
    selectedChoice.explanation
  ) {
    parts.push(`${TEXT.selected}: ${String(selectedChoice.explanation).trim()}`);
  }

  const correctExplanation = String(correctChoice?.explanation || "").trim();
  if (correctExplanation && correctExplanation !== general) {
    parts.push(`${TEXT.answer}: ${correctExplanation}`);
  }

  return parts.join("\n\n");
}

function buildChoiceReasonListExplanation(question, selectedChoice, correctChoice) {
  const general = normalizeExplanationText(question.explanation);
  const correctExplanation = normalizeExplanationText(correctChoice?.explanation);
  const correctReason = correctExplanation || general;
  const answerLabel =
    selectedChoice && correctChoice && selectedChoice.choice_id === correctChoice.choice_id
      ? TEXT.correct
      : TEXT.answer;
  const answerLines = [`${answerLabel}: ${formatChoice(correctChoice)}`];
  if (correctReason) {
    answerLines.push(correctReason);
  }
  const parts = [answerLines.join("\n")];
  if (general && general !== correctReason) {
    parts.push(general);
  }

  const wrongChoiceLines = [...question.choices]
    .sort(compareByDisplayLabel)
    .filter((choice) => choice.choice_id !== correctChoice?.choice_id)
    .map((choice) => {
      const selectedMarker =
        selectedChoice?.choice_id === choice.choice_id ? "（あなたの選択）" : "";
      const reason = normalizeExplanationText(choice.explanation) || "この選択肢は正答ではない。";
      return `${choice.displayLabel}：${selectedMarker}${reason}`;
    });

  if (wrongChoiceLines.length) {
    parts.push(["誤りの選択肢", ...wrongChoiceLines].join("\n"));
  }

  return parts.filter(Boolean).join("\n\n");
}

function shouldShowChoiceReasonList(question) {
  return Boolean(question) && question.difficulty !== "calculation_basic";
}

function normalizeExplanationText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function compareByDisplayLabel(a, b) {
  const left = Number(a.displayLabel);
  const right = Number(b.displayLabel);
  if (Number.isFinite(left) && Number.isFinite(right)) {
    return left - right;
  }
  return String(a.displayLabel).localeCompare(String(b.displayLabel), "ja");
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function shuffleArray(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return String(value).replaceAll('"', '\\"');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
