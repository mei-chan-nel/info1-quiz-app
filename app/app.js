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
const cumulativeRate = document.querySelector("#cumulativeRate");
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
const DEFAULT_SET_SIZE = 10;
const MIN_SET_SIZE = 1;
const MAX_SET_SIZE = 50;

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
  rating: "問題評価",
  good: "良問",
  bad: "悪問",
  outOfScope: "範囲外",
  you: "あなた",
  noStats: "まだ集計なし",
  statsUnavailable: "公開版では選択率を保存・表示できません。",
  ratingUnavailable: "公開版では問題評価を送信できません",
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
  ratings: {},
  choiceStats: {},
  currentIndex: 0,
  selectedChoiceId: null,
  history: loadHistory(),
  setSize: DEFAULT_SET_SIZE,
  apiAvailable: false,
  sessionCommitted: false,
  ratingsCommitted: false,
};

init();

async function init() {
  try {
    const response = await fetch("../data/questions/completed_questions.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.allQuestions = await response.json();
    state.apiAvailable = await detectApiAvailability();
    renderFieldFilters();
    bindStartControls();
    showStart();
  } catch (error) {
    showStart();
    startButton.disabled = true;
    startButton.textContent = TEXT.loadError;
    console.error(error);
  }
}

async function detectApiAvailability() {
  try {
    const response = await fetch("/api/stats", { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

function bindStartControls() {
  startButton.addEventListener("click", () => {
    startSession();
  });

  clearFiltersButton.addEventListener("click", () => {
    for (const input of fieldFilters.querySelectorAll("input[type='checkbox']")) {
      input.checked = false;
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
});

retryButton.addEventListener("click", async () => {
  await commitRatings();
  startSession();
});

finishButton.addEventListener("click", async () => {
  await commitRatings();
  showStart();
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
  cumulativeRate.textContent = "0/0 (-)";
  updateStartControls();
  progressText.textContent = `0/${state.setSize}`;
}

function resetSessionState() {
  state.sessionQuestions = [];
  state.responses = [];
  state.ratings = {};
  state.choiceStats = {};
  state.currentIndex = 0;
  state.selectedChoiceId = null;
  state.sessionCommitted = false;
  state.ratingsCommitted = false;
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
  updateSetSizeControls(pool.length);
  state.sessionQuestions = pickRandomSet(pool, Math.min(state.setSize, pool.length)).map(prepareSessionQuestion);
  state.responses = state.sessionQuestions.map((question) => ({
    questionId: question.id,
    selectedChoiceId: null,
    isCorrect: null,
  }));
  state.ratings = {};
  state.choiceStats = {};
  state.currentIndex = 0;
  state.selectedChoiceId = null;
  state.sessionCommitted = false;
  state.ratingsCommitted = false;

  startView.hidden = true;
  statusBar.hidden = false;
  questionView.hidden = false;
  summaryView.hidden = true;
  setStatus.textContent = TEXT.running;
  finishButton.disabled = false;
  finishButton.textContent = TEXT.finish;
  summaryView.querySelector(".end-message")?.remove();
  renderQuestion();
  updateSessionRate();
}

function renderFieldFilters() {
  fieldFilters.replaceChildren(
    ...FIELD_DEFINITIONS.map((definition) => {
      const label = document.createElement("label");
      label.className = "field-chip";
      label.innerHTML = `
        <input type="checkbox" value="${escapeHtml(definition.id)}" />
        <span>${escapeHtml(definition.label)}</span>
      `;
      return label;
    }),
  );
}

function updateStartControls() {
  if (!state.allQuestions.length) {
    questionCount.textContent = "-";
    updateSetSizeControls(0);
    return;
  }

  const pool = getQuestionPool();
  questionCount.textContent = `${pool.length}問`;
  updateSetSizeControls(pool.length);
  startButton.disabled = pool.length === 0;
  startButton.textContent = pool.length === 0 ? TEXT.empty : "挑戦を開始";
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
  return state.allQuestions.filter((question) => {
    if (!matchesCalcMode(question)) {
      return false;
    }
    if (!selectedFields.length) {
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
  resultText.textContent = `${TEXT.answer}: ${formatChoice(correctChoice)}`;
  explanation.textContent = buildExplanation(question, selectedChoice, correctChoice);

  nextButton.hidden = false;
  updateProgressView();
  updateSessionRate();
}

async function showSummary() {
  nextButton.disabled = true;
  setStatus.textContent = TEXT.saving;
  await commitResponses();
  questionView.hidden = true;
  summaryView.hidden = false;
  setStatus.textContent = TEXT.result;
  renderSummary();
  updateProgressView();
  updateSessionRate();
}

function renderSummary() {
  const answered = state.responses.filter((response) => response.selectedChoiceId !== null);
  const correct = answered.filter((response) => response.isCorrect).length;
  const total = state.sessionQuestions.length;
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
          ${renderRatingActions(question)}
        </div>
        <div class="summary-body">
          <p>${escapeHtml(question.stem)}</p>
          ${renderChoiceStats(question, selectedChoice, correctChoice)}
          <p class="summary-explanation">${escapeHtml(buildExplanation(question, selectedChoice, correctChoice))}</p>
          ${renderSummarySourceNote(question)}
        </div>
      `;
      if (state.apiAvailable) {
        for (const button of item.querySelectorAll(".rate-button")) {
          button.addEventListener("click", () => rateQuestion(button.dataset.id, button.dataset.rating));
        }
        refreshRatingButtons(item, question.id);
      }
      return item;
    }),
  );
}

function renderRatingActions(question) {
  if (!state.apiAvailable) {
    return `<span class="rating-disabled">${TEXT.ratingUnavailable}</span>`;
  }
  return `
    <div class="rating-actions" aria-label="${TEXT.rating}">
      <button class="rate-button" type="button" data-rating="good" data-id="${escapeHtml(question.id)}">${TEXT.good}</button>
      <button class="rate-button" type="button" data-rating="bad" data-id="${escapeHtml(question.id)}">${TEXT.bad}</button>
      <button class="rate-button" type="button" data-rating="out_of_scope" data-id="${escapeHtml(question.id)}">${TEXT.outOfScope}</button>
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
  const stats = state.choiceStats[question.id];
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
      const detail = attempts ? `${count}/${attempts}` : TEXT.noStats;
      const sharedStatsColumns = showSharedStats
        ? `
          <span class="choice-stat-rate">${escapeHtml(rate)}</span>
          <span class="choice-stat-count">${escapeHtml(detail)}</span>
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

function rateQuestion(questionId, rating) {
  state.ratings[questionId] = state.ratings[questionId] === rating ? null : rating;
  state.ratingsCommitted = false;
  const item = summaryList.querySelector(`[data-id="${cssEscape(questionId)}"]`)?.closest(".summary-item");
  if (item) {
    refreshRatingButtons(item, questionId);
  }
}

function refreshRatingButtons(item, questionId) {
  const rating = state.ratings[questionId] ?? null;
  for (const button of item.querySelectorAll(".rate-button")) {
    button.classList.toggle("active-good", button.dataset.rating === "good" && rating === "good");
    button.classList.toggle("active-bad", button.dataset.rating === "bad" && rating === "bad");
    button.classList.toggle(
      "active-scope",
      button.dataset.rating === "out_of_scope" && rating === "out_of_scope",
    );
  }
}

async function commitResponses() {
  if (state.sessionCommitted) {
    return;
  }

  const responses = [];
  for (const [index, question] of state.sessionQuestions.entries()) {
    const response = state.responses[index];
    if (response.selectedChoiceId === null) {
      continue;
    }
    responses.push({
      questionId: question.id,
      selectedChoiceId: response.selectedChoiceId,
      isCorrect: response.isCorrect,
    });

    const item = state.history[question.id] ?? { attempts: 0, correct: 0, good: 0, bad: 0, out_of_scope: 0 };
    item.good ??= 0;
    item.bad ??= 0;
    item.out_of_scope ??= 0;
    item.attempts += 1;
    item.correct += response.isCorrect ? 1 : 0;
    state.history[question.id] = item;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  state.sessionCommitted = true;

  if (!state.apiAvailable) {
    state.choiceStats = {};
    return;
  }

  try {
    await postResults({ responses, ratings: {} });
  } catch {
    state.apiAvailable = false;
    state.choiceStats = {};
    return;
  }
  state.choiceStats = await fetchStatsForSession();
}

async function commitRatings() {
  if (state.ratingsCommitted) {
    return;
  }
  if (!state.apiAvailable) {
    state.ratingsCommitted = true;
    return;
  }
  const ratings = Object.fromEntries(Object.entries(state.ratings).filter(([, rating]) => rating));
  if (!Object.keys(ratings).length) {
    state.ratingsCommitted = true;
    return;
  }
  try {
    await postResults({ responses: [], ratings });
    state.ratingsCommitted = true;
  } catch {
    state.apiAvailable = false;
    state.ratingsCommitted = true;
  }
}

async function postResults(payload) {
  const response = await fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchStatsForSession() {
  const ids = state.sessionQuestions.map((question) => question.id);
  if (!state.apiAvailable || !ids.length) {
    return {};
  }
  try {
    const response = await fetch(`/api/stats?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    return payload.questions || {};
  } catch {
    state.apiAvailable = false;
    return {};
  }
}

function buildSessionOnlyStats() {
  const stats = {};
  for (const [index, question] of state.sessionQuestions.entries()) {
    const response = state.responses[index];
    if (!response.selectedChoiceId) {
      continue;
    }
    stats[question.id] = {
      attempts: 1,
      correct: response.isCorrect ? 1 : 0,
      choices: { [response.selectedChoiceId]: 1 },
      ratings: { good: 0, bad: 0, out_of_scope: 0 },
    };
  }
  return stats;
}

function updateProgressView() {
  const total = state.sessionQuestions.length;
  const answered = state.responses.filter((response) => response.selectedChoiceId !== null).length;
  const displayIndex = Math.min(state.currentIndex + 1, total);
  progressText.textContent = total ? `${displayIndex}/${total}` : "0/0";
  progressFill.style.width = total ? `${Math.round((answered / total) * 100)}%` : "0%";
}

function updateSessionRate() {
  const result = state.responses.reduce(
    (acc, response) => {
      if (response.selectedChoiceId === null) {
        return acc;
      }
      acc.attempts += 1;
      acc.correct += response.isCorrect ? 1 : 0;
      return acc;
    },
    { attempts: 0, correct: 0 },
  );
  const rate = result.attempts ? `${Math.round((result.correct / result.attempts) * 100)}%` : "-";
  cumulativeRate.textContent = `${result.correct}/${result.attempts} (${rate})`;
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
