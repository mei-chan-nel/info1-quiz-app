import {
  QUESTION_SELECTION_CONFIG,
  selectWeightedQuestionSet,
} from "./question-selection.js";

const startView = document.querySelector("#startView");
const statusBar = document.querySelector("#statusBar");
const questionView = document.querySelector("#questionView");
const summaryView = document.querySelector("#summaryView");
const startButton = document.querySelector("#startButton");
const startRecordButton = document.querySelector("#startRecordButton");
const clearFiltersButton = document.querySelector("#clearFiltersButton");
const fieldFilters = document.querySelector("#fieldFilters");
const questionCount = document.querySelector("#questionCount");
const setSizeValue = document.querySelector("#setSizeValue");
const increaseSetSizeButton = document.querySelector("#increaseSetSizeButton");
const decreaseSetSizeButton = document.querySelector("#decreaseSetSizeButton");
const progressText = document.querySelector("#progressText");
const progressFill = document.querySelector("#progressFill");
const setStatus = document.querySelector("#setStatus");
const advancedSettings = document.querySelector("#advancedSettings");
const advancedSettingsLabel = document.querySelector("#advancedSettingsLabel");
const answerMode = document.querySelector("#answerMode");
const calcMode = document.querySelector("#calcMode");
const questionStem = document.querySelector("#questionStem");
const choices = document.querySelector("#choices");
const questionSource = document.querySelector("#questionSource");
const chatgptQuestionButton = document.querySelector("#chatgptQuestionButton");
const interruptButton = document.querySelector("#interruptButton");
const questionCheckButton = document.querySelector("#questionCheckButton");
const nextButton = document.querySelector("#nextButton");
const resultPanel = document.querySelector("#resultPanel");
const resultMark = document.querySelector("#resultMark");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");
const explanation = document.querySelector("#explanation");
const summaryTitle = document.querySelector("#summaryTitle");
const summaryRate = document.querySelector("#summaryRate");
const summaryLifetimeText = document.querySelector("#summaryLifetimeText");
const summaryLifetimeRate = document.querySelector("#summaryLifetimeRate");
const summaryList = document.querySelector("#summaryList");
const summaryShareButton = document.querySelector("#summaryShareButton");
const summaryRecordButton = document.querySelector("#summaryRecordButton");
const retryButton = document.querySelector("#retryButton");
const finishButton = document.querySelector("#finishButton");
const recordView = document.querySelector("#recordView");
const recordBackButton = document.querySelector("#recordBackButton");
const recordBottomBackButton = document.querySelector("#recordBottomBackButton");
const streakMessage = document.querySelector("#streakMessage");
const recordMetrics = document.querySelector("#recordMetrics");
const fieldStats = document.querySelector("#fieldStats");
const wrongQuestionsButton = document.querySelector("#wrongQuestionsButton");
const wrongView = document.querySelector("#wrongView");
const wrongBackButton = document.querySelector("#wrongBackButton");
const wrongQuestionCount = document.querySelector("#wrongQuestionCount");
const wrongQuestionList = document.querySelector("#wrongQuestionList");
const wrongBottomBackButton = document.querySelector("#wrongBottomBackButton");
const wrongPagination = document.querySelector("#wrongPagination");
const wrongPrevButton = document.querySelector("#wrongPrevButton");
const wrongNextButton = document.querySelector("#wrongNextButton");
const wrongPageStatus = document.querySelector("#wrongPageStatus");
const checkedQuestionsButton = document.querySelector("#checkedQuestionsButton");
const clearRecordButton = document.querySelector("#clearRecordButton");
const checkedView = document.querySelector("#checkedView");
const checkedBackButton = document.querySelector("#checkedBackButton");
const checkedQuestionCount = document.querySelector("#checkedQuestionCount");
const checkedQuestionList = document.querySelector("#checkedQuestionList");
const checkedBottomBackButton = document.querySelector("#checkedBottomBackButton");
const checkedPagination = document.querySelector("#checkedPagination");
const checkedPrevButton = document.querySelector("#checkedPrevButton");
const checkedNextButton = document.querySelector("#checkedNextButton");
const checkedPageStatus = document.querySelector("#checkedPageStatus");
const solvedQuestionsButton = document.querySelector("#solvedQuestionsButton");
const solvedView = document.querySelector("#solvedView");
const solvedBackButton = document.querySelector("#solvedBackButton");
const solvedQuestionCount = document.querySelector("#solvedQuestionCount");
const solvedQuestionList = document.querySelector("#solvedQuestionList");
const solvedBottomBackButton = document.querySelector("#solvedBottomBackButton");
const solvedPagination = document.querySelector("#solvedPagination");
const solvedPrevButton = document.querySelector("#solvedPrevButton");
const solvedNextButton = document.querySelector("#solvedNextButton");
const solvedPageStatus = document.querySelector("#solvedPageStatus");
const clearRecordDialog = document.querySelector("#clearRecordDialog");
const confirmClearRecordButton = document.querySelector("#confirmClearRecordButton");
const interruptDialog = document.querySelector("#interruptDialog");
const confirmInterruptButton = document.querySelector("#confirmInterruptButton");
const interruptDialogTitle = document.querySelector("#interruptDialogTitle");
const interruptDialogMessage = document.querySelector("#interruptDialogMessage");
const appMenuButton = document.querySelector("#appMenuButton");
const appMenu = document.querySelector("#appMenu");
const appRecordNavButton = document.querySelector("#appRecordNavButton");
const appBrandLink = document.querySelector(".app-mini-nav__brand");
const tagChallenge = window.Info1TagChallenge;

const DEFAULT_SET_SIZE = 5;
const MIN_SET_SIZE = 1;
const MAX_SET_SIZE = 50;
const RECORD_LIST_PAGE_SIZE = 10;
const MAX_SHARED_QUESTIONS = 10;
const TAG_CHALLENGE_MODE = "tag-search";
const CHATGPT_URL = "https://chatgpt.com/";
const X_POST_INTENT_URL = "https://x.com/intent/tweet";
const PUBLIC_APP_URL = "https://mei-chan-nel.com/info1-quiz-app/app/";
const SUPABASE_URL = "https://yygezzpowsvpzarqdtls.supabase.co";
// Supabase publishable keys are designed for browser clients. Never use a secret or service_role key here.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rQmX7MCx_8W3nz-xWXQBpA_CHzdRQSk";
const learningRecord = window.Info1LearningRecord;

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
  outOfScopeReport: "不備報告",
  you: "あなた",
  statsUnavailable: "公開版では選択率を保存・表示できません。",
};

const FIELD_DEFINITIONS = [
  {
    id: "society_security",
    label: "社会・セキュリティ",
  },
  {
    id: "digital",
    label: "デジタル表現",
  },
  {
    id: "network",
    label: "ネットワーク",
  },
  {
    id: "data_db",
    label: "データ活用・DB",
  },
  {
    id: "algorithm",
    label: "アルゴリズム",
  },
  {
    id: "design",
    label: "情報デザイン",
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
  setSize: DEFAULT_SET_SIZE,
  questionDataStatus: "loading",
  apiAvailable: false,
  apiAvailabilityStatus: "checking",
  apiAvailabilityPromise: Promise.resolve(false),
  questionAttemptCounts: new Map(),
  questionAttemptStatsStatus: "not_started",
  questionAttemptStatsPromise: Promise.resolve(null),
  sessionId: 0,
  pastStatsPromise: Promise.resolve(),
  pastStatsLoading: false,
  pastStatsLoaded: false,
  responseSubmission: null,
  pendingResponseSubmissions: [],
  outOfScopeSubmission: null,
  pendingOutOfScopeSubmissions: [],
  cumulativeTotal: 0,
  cumulativeCorrect: 0,
  cumulativeQuestionIds: [],
  sessionSummaryRecorded: false,
  sessionMode: "standard",
  tagChallengeMode: false,
  tagChallengeContext: null,
  pendingChallengeQuestionIds: [],
  challengeRequested: false,
  recordReturnView: "start",
  recordPracticeMode: false,
  recordReviewMode: false,
  recordListReturnView: "wrong",
  recordListSnapshot: null,
  recordWrongPage: 0,
  recordCheckedPage: 0,
  recordSolvedPage: 0,
  recordListScrollTop: 0,
  pendingNavigation: null,
  allowNavigation: false,
};

function trackAnalyticsEvent(eventName, parameters = {}) {
  if (typeof window.gtag !== "function") {
    return;
  }
  try {
    window.gtag("event", eventName, parameters);
  } catch {
    // Analytics must never interrupt the learning flow.
  }
}

function openExternalWindow(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function getLearningContext() {
  if (state.recordPracticeMode) {
    return "wrong_review";
  }
  if (state.recordReviewMode) {
    if (state.recordListReturnView === "checked") {
      return "saved_review";
    }
    if (state.recordListReturnView === "solved") {
      return "solved_review";
    }
    return "wrong_review";
  }
  return "standard";
}

function getQuestionField(question) {
  const questionFieldIds = getQuestionFieldIds(question);
  return FIELD_DEFINITIONS.find((definition) => questionFieldIds.has(definition.id))?.id || "unknown";
}

function getQuizAnalyticsParameters(question) {
  const isWrongReview = state.recordPracticeMode;
  return {
    learning_context: isWrongReview ? "wrong_review" : "standard",
    question_field: getQuestionField(question),
    answer_mode: isWrongReview ? "not_applicable" : getAnswerModeValue(),
    calc_mode: isWrongReview ? "not_applicable" : getCalcModeValue(),
    session_target: isWrongReview ? 1 : state.sessionQuestions.length,
    question_position: isWrongReview ? 1 : state.currentIndex + 1,
  };
}

init();

function init() {
  if (!learningRecord) {
    throw new Error("学習記録モジュールを読み込めませんでした。");
  }
  renderFieldFilters();
  bindStartControls();
  bindAppNavigation();
  const searchParams = new URLSearchParams(window.location.search);
  const requestedView = searchParams.get("view");
  state.challengeRequested = searchParams.has("challenge");
  const savedTagChallengeContext = tagChallenge?.readContext?.() || null;
  state.tagChallengeMode = Boolean(
    state.challengeRequested
    && savedTagChallengeContext
    && tagChallenge?.isTagSearchSource?.(window.location.href),
  );
  state.tagChallengeContext = state.tagChallengeMode ? savedTagChallengeContext : null;
  state.pendingChallengeQuestionIds = parseChallengeQuestionIds(
    searchParams.get("challenge"),
    state.tagChallengeMode ? Number.POSITIVE_INFINITY : MAX_SHARED_QUESTIONS,
  );
  if (state.challengeRequested) {
    startView.hidden = true;
  } else if (requestedView === "record") {
    state.recordReturnView = "start";
    trackAnalyticsEvent("learning_record_view", {
      entry_point: "direct",
    });
    showLearningRecord();
  } else {
    showStart();
  }
  void loadQuestionData();
  state.apiAvailabilityPromise = initializeApiAvailability();
}

async function loadQuestionData() {
  try {
    state.allQuestions = await window.StudyAtlasQuestionData.load();
    state.questionDataStatus = "ready";
    void loadQuestionAttemptCounts();
    updateStartControls();
    if (state.challengeRequested) {
      const challengeQuestionIds = state.pendingChallengeQuestionIds;
      state.challengeRequested = false;
      state.pendingChallengeQuestionIds = [];
      if (!startChallengeSession(challengeQuestionIds)) {
        showStart();
      }
      return;
    }
    if (!recordView.hidden) renderLearningRecord();
  } catch (error) {
    state.questionDataStatus = "error";
    if (state.challengeRequested) {
      if (state.tagChallengeMode && state.tagChallengeContext) {
        state.challengeRequested = false;
        void returnToTagSearchPage(state.tagChallengeContext);
      } else {
        showStart();
      }
    } else {
      updateStartControls();
    }
    console.error(error);
  }
}

function parseChallengeQuestionIds(value, maxQuestions = MAX_SHARED_QUESTIONS) {
  if (typeof value !== "string") {
    return [];
  }
  const limit = Number.isFinite(maxQuestions) ? Math.max(0, maxQuestions) : undefined;
  const questionIds = value
    .split(",")
    .map((questionId) => questionId.trim())
    .filter(Boolean);
  return limit === undefined ? questionIds : questionIds.slice(0, limit);
}

function resolveChallengeQuestions(questionIds) {
  const questionById = new Map(
    state.allQuestions.map((question) => [String(question.id), question]),
  );
  return questionIds
    .map((questionId) => questionById.get(String(questionId)))
    .filter(Boolean);
}

function startChallengeSession(questionIds) {
  if (state.tagChallengeMode) {
    return startTagChallengeSession(questionIds);
  }
  const selectedQuestions = resolveChallengeQuestions(questionIds);
  if (selectedQuestions.length !== questionIds.length) {
    console.warn("共有URLに存在しない問題IDが含まれていたため、有効な問題だけで開始します。");
  }
  if (!selectedQuestions.length) {
    console.warn("共有URLに有効な問題IDがないため、通常の開始画面を表示します。");
    return false;
  }
  return beginSession(selectedQuestions, { sessionMode: "challenge" });
}

function selectTagChallengeQuestionIds(candidateQuestionIds, questionCount, previousQuestionIds = []) {
  const candidates = tagChallenge?.normalizeIds?.(candidateQuestionIds) || [];
  const count = Math.min(Math.max(Number(questionCount) || 0, 0), candidates.length);
  if (!count) {
    return [];
  }
  let selected = [];
  const previous = tagChallenge?.normalizeIds?.(previousQuestionIds) || [];
  const shouldAvoidPreviousSet = candidates.length > count && previous.length === count;
  for (let attempt = 0; attempt < (shouldAvoidPreviousSet ? 6 : 1); attempt += 1) {
    selected = tagChallenge.shuffle(candidates).slice(0, count);
    if (!shouldAvoidPreviousSet || !tagChallenge.sameSet(selected, previous)) {
      break;
    }
  }
  return selected;
}

function writeTagChallengeContext(context) {
  if (!tagChallenge?.writeContext?.(context)) {
    console.error("タグ出題用のセッション情報を更新できませんでした。");
    return false;
  }
  state.tagChallengeContext = tagChallenge.readContext?.() || context;
  return true;
}

function updateTagChallengeUrl(questionIds) {
  const url = new URL(window.location.href);
  url.searchParams.set("challenge", questionIds.join(","));
  url.searchParams.set("source", TAG_CHALLENGE_MODE);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function startTagChallengeSession(questionIds) {
  if (!tagChallenge || !state.tagChallengeContext) {
    return false;
  }
  const context = state.tagChallengeContext;
  const validCandidateQuestions = resolveChallengeQuestions(context.candidateQuestionIds);
  const validCandidateIds = tagChallenge.normalizeIds(
    validCandidateQuestions.map((question) => question.id),
  );
  if (!validCandidateIds.length) {
    void returnToTagSearchPage(context);
    return false;
  }

  const questionCount = Math.min(context.questionCount, validCandidateIds.length);
  const validCandidateIdSet = new Set(validCandidateIds);
  const requestedIds = tagChallenge
    .normalizeIds(questionIds)
    .filter((questionId) => validCandidateIdSet.has(questionId));
  const currentQuestionIds = requestedIds.length >= questionCount
    ? requestedIds.slice(0, questionCount)
    : [
        ...requestedIds,
        ...selectTagChallengeQuestionIds(
          validCandidateIds.filter((questionId) => !requestedIds.includes(questionId)),
          questionCount - requestedIds.length,
        ),
      ];
  if (!currentQuestionIds.length) {
    void returnToTagSearchPage(context);
    return false;
  }

  const updatedContext = {
    ...context,
    questionCount,
    currentQuestionIds,
    createdAt: new Date().toISOString(),
  };
  if (!writeTagChallengeContext(updatedContext)) {
    return false;
  }
  updateTagChallengeUrl(currentQuestionIds);
  const selectedQuestions = resolveChallengeQuestions(currentQuestionIds);
  if (!selectedQuestions.length) {
    void returnToTagSearchPage(updatedContext);
    return false;
  }
  return beginSession(selectedQuestions, { sessionMode: TAG_CHALLENGE_MODE });
}

function retryTagChallengeSession() {
  if (!tagChallenge || !state.tagChallengeContext) {
    return false;
  }
  const context = state.tagChallengeContext;
  const validCandidateQuestions = resolveChallengeQuestions(context.candidateQuestionIds);
  const validCandidateIds = tagChallenge.normalizeIds(
    validCandidateQuestions.map((question) => question.id),
  );
  if (!validCandidateIds.length) {
    void returnToTagSearchPage(context);
    return false;
  }

  const questionCount = Math.min(context.questionCount, validCandidateIds.length);
  const currentQuestionIds = selectTagChallengeQuestionIds(
    validCandidateIds,
    questionCount,
    context.currentQuestionIds,
  );
  if (!currentQuestionIds.length) {
    void returnToTagSearchPage(context);
    return false;
  }
  const updatedContext = {
    ...context,
    questionCount,
    currentQuestionIds,
    createdAt: new Date().toISOString(),
  };
  if (!writeTagChallengeContext(updatedContext)) {
    return false;
  }
  updateTagChallengeUrl(currentQuestionIds);
  const selectedQuestions = resolveChallengeQuestions(currentQuestionIds);
  return beginSession(selectedQuestions, { sessionMode: TAG_CHALLENGE_MODE });
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

function loadQuestionAttemptCounts() {
  if (state.questionAttemptStatsStatus !== "not_started") {
    return state.questionAttemptStatsPromise;
  }
  state.questionAttemptStatsStatus = "loading";
  const questionIds = state.allQuestions.map((question) => String(question.id));
  const request = (async () => {
    const available = await state.apiAvailabilityPromise;
    if (!available) {
      state.questionAttemptStatsStatus = "unavailable";
      return null;
    }
    try {
      const attemptCounts = await requestAllQuestionAttemptCounts(questionIds);
      state.questionAttemptCounts = attemptCounts;
      state.questionAttemptStatsStatus = "success";
      return attemptCounts;
    } catch (error) {
      state.questionAttemptCounts = new Map();
      state.questionAttemptStatsStatus = "unavailable";
      console.error("問題ごとの全体回答回数を取得できませんでした。回答回数補正を使わずに出題します。", error);
      return null;
    }
  })();
  state.questionAttemptStatsPromise = request;
  return request;
}

async function requestAllQuestionAttemptCounts(questionIds) {
  const receivedAttemptCounts = new Map();
  const batchSize = QUESTION_SELECTION_CONFIG.QUESTION_STATS_BATCH_SIZE;
  for (let start = 0; start < questionIds.length; start += batchSize) {
    const batchIds = questionIds.slice(start, start + batchSize);
    const batchIdSet = new Set(batchIds);
    const stats = await requestQuestionStats(batchIds);
    for (const [questionId, record] of Object.entries(stats)) {
      if (!batchIdSet.has(questionId)) {
        continue;
      }
      const attempts = record?.attempts;
      if (typeof attempts !== "number" || !Number.isFinite(attempts) || attempts < 0) {
        throw new Error(`Invalid attempts for question ${questionId}`);
      }
      receivedAttemptCounts.set(questionId, attempts);
    }
  }
  const attemptCounts = new Map(questionIds.map((questionId) => [questionId, 0]));
  for (const [questionId, attempts] of receivedAttemptCounts) {
    attemptCounts.set(questionId, attempts);
  }
  return attemptCounts;
}

function isChallengeActive() {
  return !questionView.hidden && summaryView.hidden;
}

function isTagChallengeSession() {
  return state.sessionMode === TAG_CHALLENGE_MODE;
}

function closeAppMenu(restoreFocus = false) {
  appMenu.hidden = true;
  appMenuButton.setAttribute("aria-expanded", "false");
  if (restoreFocus) appMenuButton.focus();
}

function bindAppNavigation() {
  appMenuButton.addEventListener("click", () => {
    const opening = appMenu.hidden;
    appMenu.hidden = !opening;
    appMenuButton.setAttribute("aria-expanded", String(opening));
    if (opening) appMenu.querySelector("a, button")?.focus();
  });
  appMenu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeAppMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (!appMenu.hidden && !event.target.closest(".app-mini-nav")) closeAppMenu();
  });
  appMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!isChallengeActive()) return;
      event.preventDefault();
      closeAppMenu();
      requestNavigationConfirmation({ type: "href", href: link.href, trigger: appMenuButton });
    });
  });
  appBrandLink.addEventListener("click", (event) => {
    if (!isChallengeActive()) return;
    event.preventDefault();
    requestNavigationConfirmation({ type: "href", href: appBrandLink.href, trigger: appBrandLink });
  });
  appRecordNavButton.addEventListener("click", () => {
    closeAppMenu();
    if (isChallengeActive()) {
      requestNavigationConfirmation({ type: "record", trigger: appMenuButton });
      return;
    }
    openLearningRecord(summaryView.hidden ? "start" : "summary", "menu");
  });
  window.addEventListener("beforeunload", (event) => {
    if (!isChallengeActive() || state.allowNavigation) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

function requestNavigationConfirmation(pending) {
  state.pendingNavigation = pending;
  if (isTagChallengeSession() && pending.type !== "record") {
    interruptDialogTitle.textContent = "元のページに戻りますか？";
    interruptDialogMessage.textContent = "解答途中ですが、元のページに戻りますか？";
    confirmInterruptButton.textContent = "元のページに戻る";
  } else {
    interruptDialogTitle.textContent = pending.type === "record" ? "学習記録へ移動しますか？" : "このページを離れますか？";
    interruptDialogMessage.textContent = "挑戦中です。回答済みの学習履歴は保存されていますが、現在の挑戦は終了します。";
    confirmInterruptButton.textContent = pending.type === "record" ? "学習記録へ移動" : "移動する";
  }
  openInterruptDialog();
}

function resetInterruptDialog() {
  if (isTagChallengeSession()) {
    interruptDialogTitle.textContent = "元のページに戻りますか？";
    interruptDialogMessage.textContent = "解答途中ですが、元のページに戻りますか？";
    confirmInterruptButton.textContent = "元のページに戻る";
    return;
  }
  interruptDialogTitle.textContent = "挑戦を中断しますか？";
  interruptDialogMessage.textContent = "回答済みの問題だけで結果を表示します。";
  confirmInterruptButton.textContent = "中断する";
}

async function saveTagChallengeProgress() {
  if (!isTagChallengeSession()) {
    return;
  }
  const answeredEntries = state.sessionQuestions
    .map((question, index) => ({ question, response: state.responses[index] }))
    .filter(({ response }) => response && response.selectedChoiceId !== null);
  if (answeredEntries.length) {
    state.sessionQuestions = answeredEntries.map(({ question }) => question);
    state.responses = answeredEntries.map(({ response }) => response);
    state.currentIndex = Math.max(0, state.sessionQuestions.length - 1);
    state.selectedChoiceId = null;
    recordCumulativeResults();
    const responseSubmission = createResponseSubmission();
    await submitResponseSubmission(responseSubmission);
  }
  await commitOutOfScopeReports();
}

async function returnToTagSearchPage(context = state.tagChallengeContext || tagChallenge?.readContext?.()) {
  await saveTagChallengeProgress();
  const returnUrl = tagChallenge?.getSafeReturnUrl?.(context?.returnUrl, window.location)
    || "/info1-quiz-app/questions/tags.html";
  tagChallenge?.clearContext?.();
  state.allowNavigation = true;
  window.location.assign(returnUrl);
}

async function openRecordAfterChallenge() {
  if (state.recordPracticeMode || state.recordReviewMode) {
    state.recordPracticeMode = false;
    state.recordReviewMode = false;
    statusBar.hidden = true;
    questionView.hidden = true;
    openLearningRecord("start", "menu");
    return;
  }
  const hasAnswered = state.responses.some((response) => response?.selectedChoiceId !== null);
  if (hasAnswered) {
    await interruptSession();
    openLearningRecord("summary", "menu");
  } else {
    showStart();
    openLearningRecord("start", "menu");
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

  answerMode.addEventListener("change", () => {
    updateStartControls();
  });

  advancedSettings.addEventListener("toggle", () => {
    advancedSettingsLabel.textContent = advancedSettings.open ? "− 詳細な設定" : "＋ 詳細な設定";
  });

  fieldFilters.addEventListener("change", () => {
    updateStartControls();
  });

  startRecordButton.addEventListener("click", () => openLearningRecord("start", "start"));
  summaryRecordButton.addEventListener("click", () => openLearningRecord("summary", "summary"));
  recordBackButton.addEventListener("click", returnFromLearningRecord);
  recordBottomBackButton.addEventListener("click", returnFromLearningRecord);
  wrongQuestionsButton.addEventListener("click", () => openReviewList("wrong"));
  wrongBackButton.addEventListener("click", showLearningRecord);
  wrongBottomBackButton.addEventListener("click", showLearningRecord);
  wrongPrevButton.addEventListener("click", () => changeRecordListPage("wrong", -1));
  wrongNextButton.addEventListener("click", () => changeRecordListPage("wrong", 1));
  checkedQuestionsButton.addEventListener("click", () => openReviewList("saved"));
  checkedBackButton.addEventListener("click", showLearningRecord);
  checkedBottomBackButton.addEventListener("click", showLearningRecord);
  checkedPrevButton.addEventListener("click", () => changeRecordListPage("checked", -1));
  checkedNextButton.addEventListener("click", () => changeRecordListPage("checked", 1));
  solvedQuestionsButton.addEventListener("click", () => openReviewList("solved"));
  solvedBackButton.addEventListener("click", showLearningRecord);
  solvedBottomBackButton.addEventListener("click", showLearningRecord);
  solvedPrevButton.addEventListener("click", () => changeSolvedPage(-1));
  solvedNextButton.addEventListener("click", () => changeSolvedPage(1));
  clearRecordButton.addEventListener("click", openClearRecordDialog);
  confirmClearRecordButton.addEventListener("click", (event) => {
    event.preventDefault();
    learningRecord.clear();
    clearRecordDialog.close();
    updateStartControls();
    renderLearningRecord();
    renderSummaryLifetime();
  });

  questionCheckButton.addEventListener("click", () => {
    const question = currentQuestion();
    if (question) {
      toggleQuestionCheck(question.id, "question");
    }
  });
  chatgptQuestionButton.addEventListener("click", openCurrentQuestionInChatGPT);
  summaryShareButton.addEventListener("click", shareResultsToX);
  interruptButton.addEventListener("click", openInterruptDialog);
  confirmInterruptButton.addEventListener("click", (event) => {
    event.preventDefault();
    const pending = state.pendingNavigation;
    state.pendingNavigation = null;
    interruptDialog.close();
    resetInterruptDialog();
    if (!pending) {
      if (isTagChallengeSession()) {
        void returnToTagSearchPage();
      } else {
        void interruptSession();
      }
      return;
    }
    if (pending.type === "record") {
      void openRecordAfterChallenge();
      return;
    }
    if (isTagChallengeSession()) {
      tagChallenge?.clearContext?.();
    }
    state.allowNavigation = true;
    window.location.assign(pending.href);
  });
  interruptDialog.addEventListener("close", () => {
    const pending = state.pendingNavigation;
    state.pendingNavigation = null;
    resetInterruptDialog();
    pending?.trigger?.focus();
  });
}

nextButton.addEventListener("click", async () => {
  if (state.recordReviewMode) {
    finishRecordReview();
    return;
  }
  if (state.recordPracticeMode) {
    finishRecordPractice();
    return;
  }
  if (state.currentIndex >= state.sessionQuestions.length - 1) {
    await showSummary();
    return;
  }
  state.currentIndex += 1;
  renderQuestion();
  scrollToTop();
});

retryButton.addEventListener("click", async () => {
  if (state.sessionMode === "tag-search") {
    await completeSummaryExit();
    if (!retryTagChallengeSession()) {
      showStart();
    }
    return;
  }
  if (state.sessionMode !== "standard") {
    return;
  }
  await completeSummaryExit();
  if (!startSession()) {
    showStart();
  }
});

finishButton.addEventListener("click", async () => {
  const isTagSession = isTagChallengeSession();
  const isChallengeSession = state.sessionMode === "challenge";
  await completeSummaryExit();
  if (isTagSession) {
    await returnToTagSearchPage();
    return;
  }
  if (isChallengeSession) {
    resetChallengeUrl();
  }
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
  recordView.hidden = true;
  wrongView.hidden = true;
  checkedView.hidden = true;
  solvedView.hidden = true;
  setStatus.textContent = TEXT.notStarted;
  progressFill.style.width = "0%";
  updateStartControls();
  progressText.textContent = `0/${state.setSize}`;
  scrollToTop();
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
  state.sessionSummaryRecorded = false;
  state.sessionMode = "standard";
  state.tagChallengeMode = false;
  state.tagChallengeContext = null;
  state.pendingChallengeQuestionIds = [];
  state.challengeRequested = false;
  state.recordPracticeMode = false;
  state.recordReviewMode = false;
  state.recordListSnapshot = null;
  state.recordWrongPage = 0;
  state.recordCheckedPage = 0;
  state.recordSolvedPage = 0;
  state.recordListScrollTop = 0;
  state.responseSubmission = null;
  state.outOfScopeSubmission = null;
  state.allowNavigation = false;
  retryButton.disabled = false;
  finishButton.disabled = false;
  finishButton.textContent = TEXT.finish;
  summaryView.querySelector(".end-message")?.remove();
}

function startSession() {
  const pool = getQuestionPool();
  if (!pool.length) {
    updateStartControls();
    return false;
  }
  updateSetSizeControls(pool.length);
  const selectionCount = Math.min(state.setSize, pool.length);
  let selectedQuestions;
  try {
    selectedQuestions = selectWeightedQuestionSet({
      questions: pool,
      count: selectionCount,
      selectedFieldIds: getSelectedFields().map((definition) => definition.id),
      fieldOrder: FIELD_DEFINITIONS.map((definition) => definition.id),
      attemptCounts: state.questionAttemptCounts,
      attemptStatsAvailable: state.questionAttemptStatsStatus === "success",
      getAnsweredAt: (question) => learningRecord.getQuestion(question.id).answeredAt,
      onWarning: (message) => console.warn(message),
    });
    if (selectedQuestions.length !== selectionCount) {
      throw new Error(`Selected ${selectedQuestions.length} of ${selectionCount} requested questions`);
    }
  } catch (error) {
    console.error("重み付き抽選に失敗したため、単純ランダム抽選へ戻します。", error);
    selectedQuestions = pickRandomSet(pool, selectionCount);
  }
  return beginSession(selectedQuestions, { sessionMode: "standard" });
}

function initializeSessionQuestions(selectedQuestions) {
  state.sessionId += 1;
  const sessionId = state.sessionId;
  state.sessionQuestions = selectedQuestions.map(prepareSessionQuestion);
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
  state.sessionSummaryRecorded = false;
  state.responseSubmission = null;
  state.outOfScopeSubmission = null;
  return sessionId;
}

function beginSession(selectedQuestions, { sessionMode = "standard" } = {}) {
  if (!selectedQuestions.length) {
    return false;
  }
  state.recordPracticeMode = false;
  state.recordReviewMode = false;
  const sessionId = initializeSessionQuestions(selectedQuestions);
  state.sessionMode = sessionMode;
  state.tagChallengeMode = sessionMode === TAG_CHALLENGE_MODE;

  startView.hidden = true;
  statusBar.hidden = false;
  questionView.hidden = false;
  summaryView.hidden = true;
  recordView.hidden = true;
  wrongView.hidden = true;
  checkedView.hidden = true;
  solvedView.hidden = true;
  setStatus.textContent = TEXT.running;
  retryButton.disabled = false;
  finishButton.disabled = false;
  updateFinishButtonLabel();
  summaryView.querySelector(".end-message")?.remove();
  renderQuestion();
  scrollToTop();
  loadPastChoiceStats(sessionId, state.sessionQuestions.map((question) => question.id));
  retryPendingSubmissions();
  return true;
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
  state.cumulativeQuestionIds = [];
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
    if (!matchesAnswerMode(question)) {
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

  const fieldIds = Array.isArray(question.field_ids)
    ? question.field_ids.filter((fieldId) => FIELD_ID_SET.has(fieldId))
    : [];
  question.__fieldIds = new Set(fieldIds);
  return question.__fieldIds;
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
  const isRecordListQuestion = state.recordPracticeMode || state.recordReviewMode;

  state.selectedChoiceId = null;
  resultPanel.hidden = true;
  nextButton.hidden = true;
  nextButton.disabled = false;
  interruptButton.hidden = isRecordListQuestion;
  interruptButton.textContent = isTagChallengeSession() ? "元のページに戻る" : "挑戦を中断する";
  nextButton.textContent = isRecordListQuestion
    ? "一覧に戻る"
    : state.currentIndex >= total - 1
      ? TEXT.summary
      : TEXT.next;

  if (!question) {
    chatgptQuestionButton.textContent = "ChatGPTのヒント";
    chatgptQuestionButton.disabled = true;
    renderEmptyState();
    return;
  }

  questionStem.textContent = question.stem;
  updateChatGPTQuestionButton(question, state.recordReviewMode || currentResponse()?.selectedChoiceId !== null);
  updateQuestionCheckButton(question.id);
  renderChoices(question);
  renderSourceNote(question);
  updateProgressView();
  if (state.recordPracticeMode) {
    nextButton.hidden = false;
  }
  if (state.recordReviewMode) {
    renderRecordReview(question);
  }
}

function renderRecordReview(question) {
  const correctChoice = getCorrectChoice(question);
  for (const button of choices.querySelectorAll(".choice-button")) {
    button.disabled = true;
  }

  resultPanel.hidden = false;
  resultMark.textContent = "✓";
  resultMark.className = "result-mark right";
  resultTitle.textContent = "正答と解説";
  resultText.hidden = shouldShowChoiceReasonList(question);
  resultText.textContent = resultText.hidden ? "" : `${TEXT.answer}: ${formatChoice(correctChoice)}`;
  explanation.textContent = buildExplanation(question, null, correctChoice);
  updateChatGPTQuestionButton(question, true);
  nextButton.hidden = false;
  progressFill.style.width = "100%";
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
  trackAnalyticsEvent("quiz_answer", getQuizAnalyticsParameters(question));
  learningRecord.recordAnswer(question.id, isCorrect);
  incrementLocalQuestionAttemptCount(question.id);
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
  updateChatGPTQuestionButton(question, true);

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
  const submission = createResponseSubmission();
  if (submission) {
    void submitResponseSubmission(submission);
  }
}

function updateChatGPTQuestionButton(question, isAnswered) {
  const answered = Boolean(isAnswered);
  chatgptQuestionButton.disabled = false;
  chatgptQuestionButton.textContent = answered ? "ChatGPTの解説" : "ChatGPTのヒント";
}

function openCurrentQuestionInChatGPT() {
  const question = currentQuestion();
  if (!question) {
    return;
  }
  const helpType = state.recordReviewMode || currentResponse()?.selectedChoiceId !== null
    ? "explanation"
    : "hint";
  trackAnalyticsEvent("ai_help_click", {
    help_type: helpType,
    surface: "question",
    learning_context: getLearningContext(),
    question_field: getQuestionField(question),
  });
  openExternalWindow(buildChatGPTQuestionUrl(question, helpType));
}

function buildChatGPTQuestionUrl(question, promptType = "explanation") {
  const choiceLines = question.choices
    .map((choice, index) => `${index}．${choice.text}`)
    .join("\n");
  const instruction = promptType === "hint"
    ? "次の問題を解くヒントだけをください。問題を解くために注目すべき条件、使う知識、考える順序を、段階的に説明してください。それを聞いて答えを自分で考えます。答えそのものは教えないでください。"
    : "次の問題を解説してください。";
  const prompt = `${instruction}\n\n${question.stem}\n\n${choiceLines}`;
  return `${CHATGPT_URL}?q=${encodeURIComponent(prompt)}`;
}

function getAnswerModeValue() {
  return answerMode.querySelector("input[name='answerMode']:checked")?.value || "all";
}

function matchesAnswerMode(question) {
  const record = learningRecord.getQuestion(question.id);
  const mode = getAnswerModeValue();
  if (mode === "unanswered" && record.attempts > 0) {
    return false;
  }
  if (mode === "wrong" && record.lastCorrect !== false) {
    return false;
  }
  if (mode === "exclude_mastered" && learningRecord.hasThreeCorrectInARow(question.id)) {
    return false;
  }
  return true;
}

function recordCumulativeResults() {
  if (state.sessionSummaryRecorded) {
    return;
  }
  const answeredEntries = state.sessionQuestions
    .map((question, index) => ({ question, response: state.responses[index] }))
    .filter(({ response }) => response && response.selectedChoiceId !== null);
  state.cumulativeTotal += answeredEntries.length;
  state.cumulativeCorrect += answeredEntries.filter(({ response }) => response.isCorrect).length;
  state.cumulativeQuestionIds.push(
    ...answeredEntries.map(({ question }) => String(question.id)),
  );
  state.sessionSummaryRecorded = true;
}

function updateSummaryActionVisibility() {
  retryButton.hidden = state.sessionMode === "challenge";
}

function renderSummary() {
  updateSummaryActionVisibility();
  updateFinishButtonLabel();
  const correct = state.cumulativeCorrect;
  const total = state.cumulativeTotal;
  const rate = total ? Math.round((correct / total) * 100) : 0;

  summaryTitle.textContent = `${total}問中 ${correct}問正解`;
  summaryRate.textContent = `${rate}%`;
  renderSummaryLifetime();

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
          ${renderQuestionCheckButton(question.id)}
          ${renderChatGPTExplanationAction()}
          ${renderOutOfScopeReportAction(question)}
        </div>
        <div class="summary-body">
          <p class="summary-stem">${escapeHtml(question.stem)}</p>
          ${renderChoiceStats(question, selectedChoice, correctChoice)}
          ${renderSummaryExplanation(question, selectedChoice, correctChoice)}
          ${renderSummarySourceNote(question)}
        </div>
      `;
      item.querySelector("[data-check-question]")?.addEventListener("click", () => {
        toggleQuestionCheck(question.id, "summary");
      });
      item.querySelector("[data-summary-chatgpt]")?.addEventListener("click", () => {
        trackAnalyticsEvent("ai_help_click", {
          help_type: "explanation",
          surface: "summary",
          learning_context: getLearningContext(),
          question_field: getQuestionField(question),
        });
        openExternalWindow(buildChatGPTQuestionUrl(question, "explanation"));
      });
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

function updateFinishButtonLabel() {
  finishButton.textContent = isTagChallengeSession() ? "元のページに戻る" : TEXT.finish;
}

function renderSummaryExplanation(question, selectedChoice, correctChoice) {
  const answer = shouldShowChoiceReasonList(question)
    ? ""
    : `<p>${TEXT.answer}: ${escapeHtml(formatChoice(correctChoice))}</p>`;
  return `
    <section class="result-panel summary-result-panel">
      ${answer}
      <p class="explanation">${escapeHtml(buildExplanation(question, selectedChoice, correctChoice))}</p>
      ${renderQuestionLearningHistory(question.id)}
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

function renderChatGPTExplanationAction() {
  return `
    <button class="summary-chatgpt-link" type="button" data-summary-chatgpt>ChatGPTの解説</button>
  `;
}

function renderSummaryLifetime() {
  const summary = learningRecord.summarize(state.allQuestions, FIELD_DEFINITIONS);
  summaryLifetimeText.textContent = `${summary.attempts}問中 ${summary.correct}問正解`;
  summaryLifetimeRate.textContent = `${summary.rate}%`;
}

function renderQuestionCheckButton(questionId) {
  const checked = learningRecord.isChecked(questionId);
  return `
    <button class="check-question-button compact ${checked ? "checked" : ""}" type="button"
      data-check-question="${escapeHtml(questionId)}" aria-pressed="${checked}">
      ${checked ? "保存済み" : "保存"}
    </button>
  `;
}

function renderQuestionLearningHistory(questionId) {
  const record = learningRecord.getQuestion(questionId);
  if (!record.history) {
    return "";
  }
  const recent = record.history.slice(-12);
  const marks = [...recent]
    .map((value) => `<span class="${value === "1" ? "right" : "wrong"}">${value === "1" ? "○" : "×"}</span>`)
    .join("");
  const omitted = record.history.length > recent.length ? `<span class="history-ellipsis">…</span>` : "";
  return `
    <div class="question-learning-history" aria-label="この問題の回答履歴">
      <span>これまで ${record.correct}/${record.attempts}</span>
      <span class="history-marks">${omitted}${marks}</span>
    </div>
  `;
}

function updateQuestionCheckButton(questionId) {
  const checked = learningRecord.isChecked(questionId);
  questionCheckButton.classList.toggle("checked", checked);
  questionCheckButton.setAttribute("aria-pressed", String(checked));
  questionCheckButton.textContent = checked ? "保存済み" : "保存";
}

function toggleQuestionCheck(questionId, surface) {
  const checked = learningRecord.toggleChecked(questionId);
  trackAnalyticsEvent("question_bookmark", {
    bookmark_action: checked ? "add" : "remove",
    surface,
  });
  for (const button of document.querySelectorAll(`[data-check-question="${cssEscape(questionId)}"]`)) {
    button.classList.toggle("checked", checked);
    button.setAttribute("aria-pressed", String(checked));
    button.textContent = checked ? "保存済み" : "保存";
  }
  if (currentQuestion()?.id === questionId) {
    updateQuestionCheckButton(questionId);
  }
  if (!recordView.hidden) {
    renderLearningRecord();
  }
  if (!wrongView.hidden) {
    renderWrongQuestions();
  }
  if (!checkedView.hidden) {
    renderCheckedQuestions();
  }
  if (!solvedView.hidden) {
    renderSolvedQuestions();
  }
}

async function interruptSession() {
  if (questionView.hidden || state.recordPracticeMode || state.recordReviewMode) {
    return;
  }

  interruptButton.disabled = true;
  const answeredEntries = state.sessionQuestions
    .map((question, index) => ({ question, response: state.responses[index] }))
    .filter(({ response }) => response && response.selectedChoiceId !== null);
  state.sessionQuestions = answeredEntries.map(({ question }) => question);
  state.responses = answeredEntries.map(({ response }) => response);
  state.currentIndex = Math.max(0, state.sessionQuestions.length - 1);
  state.selectedChoiceId = null;
  await showSummary();
  interruptButton.disabled = false;
}

function openLearningRecord(returnView, entryPoint) {
  trackAnalyticsEvent("learning_record_view", {
    entry_point: entryPoint,
  });
  state.recordReturnView = returnView;
  showLearningRecord();
}

function showLearningRecord() {
  startView.hidden = true;
  statusBar.hidden = true;
  questionView.hidden = true;
  summaryView.hidden = true;
  wrongView.hidden = true;
  checkedView.hidden = true;
  solvedView.hidden = true;
  recordView.hidden = false;
  renderLearningRecord();
  scrollToTop();
}

function returnFromLearningRecord() {
  recordView.hidden = true;
  wrongView.hidden = true;
  checkedView.hidden = true;
  solvedView.hidden = true;
  if (state.recordListSnapshot) {
    restoreRecordListSnapshot();
  }
  if (state.recordReturnView === "summary" && state.sessionSummaryRecorded) {
    summaryView.hidden = false;
    renderSummary();
    scrollToTop();
    return;
  }
  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.get("view") === "record") {
    currentUrl.searchParams.delete("view");
    window.history.replaceState(null, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }
  showStart();
}

function renderLearningRecord() {
  const summary = learningRecord.summarize(state.allQuestions, FIELD_DEFINITIONS);
  streakMessage.textContent = summary.streak > 0 ? `${summary.streak}日連続学習中` : "学習を始めると連続日数が記録されます";
  recordMetrics.innerHTML = [
    ["累計回答数", `${summary.attempts}回`],
    ["累計正解数", `${summary.correct}回`],
    ["累計正答率", `${summary.rate}%`],
    ["解いた問題", `${summary.solved}/${summary.totalQuestions}`],
  ]
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  fieldStats.replaceChildren(
    ...summary.fields.map((field) => {
      const item = document.createElement("div");
      const isUnanswered = field.attempts === 0;
      const statusText = isUnanswered ? "未回答" : `${field.correct}/${field.attempts}・${field.rate}%`;
      const progressLabel = isUnanswered ? `${field.label}：未回答` : `${field.label}：正答率${field.rate}%`;
      item.className = `field-stat${isUnanswered ? " is-unanswered" : ""}`;
      item.innerHTML = `
        <div><strong>${escapeHtml(field.label)}</strong><span>${statusText}</span></div>
        <div class="field-stat-track" role="img" aria-label="${escapeHtml(progressLabel)}"><span style="width:${field.rate}%"></span></div>
      `;
      return item;
    }),
  );

  wrongQuestionsButton.textContent = `間違えたままの問題（${summary.wrongQuestionIds.length}）`;
  checkedQuestionsButton.textContent = `保存した問題（${summary.checkedQuestionIds.length}）`;
  solvedQuestionsButton.textContent = `解いた問題（${summary.solvedQuestionIds.length}）`;
}

function openReviewList(listType) {
  trackAnalyticsEvent("review_list_view", {
    list_type: listType,
  });
  if (listType === "wrong") {
    showWrongQuestions();
  } else if (listType === "saved") {
    showCheckedQuestions();
  } else {
    showSolvedQuestions();
  }
}

function showWrongQuestions({ resetPage = true, preserveScroll = false } = {}) {
  recordView.hidden = true;
  checkedView.hidden = true;
  solvedView.hidden = true;
  wrongView.hidden = false;
  if (resetPage) {
    state.recordWrongPage = 0;
  }
  renderWrongQuestions();
  restoreRecordListScroll(preserveScroll);
}

function renderWrongQuestions() {
  const summary = learningRecord.summarize(state.allQuestions, FIELD_DEFINITIONS);
  const totalPages = Math.max(1, Math.ceil(summary.wrongQuestionIds.length / RECORD_LIST_PAGE_SIZE));
  state.recordWrongPage = Math.min(Math.max(0, state.recordWrongPage), totalPages - 1);
  const start = state.recordWrongPage * RECORD_LIST_PAGE_SIZE;
  wrongQuestionCount.textContent = `${summary.wrongQuestionIds.length}問を復習できます`;
  renderRecordQuestionList(
    wrongQuestionList,
    summary.wrongQuestionIds.slice(start, start + RECORD_LIST_PAGE_SIZE),
    "間違えたままの問題はありません。",
    "wrong",
  );
  const hasPagination = summary.wrongQuestionIds.length > RECORD_LIST_PAGE_SIZE;
  wrongPagination.hidden = !hasPagination;
  wrongPageStatus.textContent = hasPagination ? `${state.recordWrongPage + 1} / ${totalPages}` : "";
  wrongPrevButton.disabled = state.recordWrongPage <= 0;
  wrongNextButton.disabled = state.recordWrongPage >= totalPages - 1;
}

function getSharedQuestionIds() {
  return state.cumulativeQuestionIds.slice(-MAX_SHARED_QUESTIONS);
}

function buildChallengeUrl(questionIds = getSharedQuestionIds()) {
  const url = new URL(PUBLIC_APP_URL);
  url.searchParams.set("challenge", questionIds.join(","));
  return url.toString();
}

function resetChallengeUrl() {
  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.has("challenge")) {
    return;
  }
  window.history.replaceState(null, "", `${currentUrl.pathname}${currentUrl.hash}`);
}

function buildXShareUrl(total, correct, rate) {
  const sharedQuestionIds = getSharedQuestionIds();
  const hasSharedQuestions = sharedQuestionIds.length > 0;
  const invitation = !hasSharedQuestions
    ? "あなたも挑戦しませんか？"
    : total > MAX_SHARED_QUESTIONS
      ? `同じ問題（${MAX_SHARED_QUESTIONS}問）に挑戦しませんか？`
      : "同じ問題に挑戦しませんか？";
  const shareUrl = hasSharedQuestions
    ? buildChallengeUrl(sharedQuestionIds)
    : PUBLIC_APP_URL;
  const postText = `共通テスト「情報Ⅰ」の問題に挑戦しました！

今回の結果：${total}問中${correct}問正解
正答率：${rate}％

${invitation}

${shareUrl}
#情報I #共通テスト #情報IStudyAtlas`;
  return `${X_POST_INTENT_URL}?text=${encodeURIComponent(postText)}`;
}

function shareResultsToX() {
  const correct = state.cumulativeCorrect;
  const total = state.cumulativeTotal;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  trackAnalyticsEvent("result_share_click", {
    share_target: "x",
  });
  openExternalWindow(buildXShareUrl(total, correct, rate));
}

function showCheckedQuestions({ resetPage = true, preserveScroll = false } = {}) {
  recordView.hidden = true;
  wrongView.hidden = true;
  solvedView.hidden = true;
  checkedView.hidden = false;
  if (resetPage) {
    state.recordCheckedPage = 0;
  }
  renderCheckedQuestions();
  restoreRecordListScroll(preserveScroll);
}

function renderCheckedQuestions() {
  const summary = learningRecord.summarize(state.allQuestions, FIELD_DEFINITIONS);
  const totalPages = Math.max(1, Math.ceil(summary.checkedQuestionIds.length / RECORD_LIST_PAGE_SIZE));
  state.recordCheckedPage = Math.min(Math.max(0, state.recordCheckedPage), totalPages - 1);
  const start = state.recordCheckedPage * RECORD_LIST_PAGE_SIZE;
  checkedQuestionCount.textContent = `${summary.checkedQuestionIds.length}問を保存中`;
  renderRecordQuestionList(
    checkedQuestionList,
    summary.checkedQuestionIds.slice(start, start + RECORD_LIST_PAGE_SIZE),
    "保存した問題はありません。",
    "checked",
  );
  const hasPagination = summary.checkedQuestionIds.length > RECORD_LIST_PAGE_SIZE;
  checkedPagination.hidden = !hasPagination;
  checkedPageStatus.textContent = hasPagination ? `${state.recordCheckedPage + 1} / ${totalPages}` : "";
  checkedPrevButton.disabled = state.recordCheckedPage <= 0;
  checkedNextButton.disabled = state.recordCheckedPage >= totalPages - 1;
}

function changeRecordListPage(view, delta) {
  const summary = learningRecord.summarize(state.allQuestions, FIELD_DEFINITIONS);
  const questionIds = view === "wrong" ? summary.wrongQuestionIds : summary.checkedQuestionIds;
  const currentPage = view === "wrong" ? state.recordWrongPage : state.recordCheckedPage;
  const totalPages = Math.max(1, Math.ceil(questionIds.length / RECORD_LIST_PAGE_SIZE));
  const nextPage = Math.min(Math.max(0, currentPage + delta), totalPages - 1);
  if (nextPage === currentPage) {
    return;
  }
  if (view === "wrong") {
    state.recordWrongPage = nextPage;
    renderWrongQuestions();
  } else {
    state.recordCheckedPage = nextPage;
    renderCheckedQuestions();
  }
  scrollToTop();
}

function showSolvedQuestions({ resetPage = true, preserveScroll = false } = {}) {
  recordView.hidden = true;
  wrongView.hidden = true;
  checkedView.hidden = true;
  solvedView.hidden = false;
  if (resetPage) {
    state.recordSolvedPage = 0;
  }
  renderSolvedQuestions();
  restoreRecordListScroll(preserveScroll);
}

function renderSolvedQuestions() {
  const summary = learningRecord.summarize(state.allQuestions, FIELD_DEFINITIONS);
  const groups = groupSolvedQuestionIds(summary.solvedQuestionIds);
  const totalPages = Math.max(1, groups.length);
  state.recordSolvedPage = Math.min(Math.max(0, state.recordSolvedPage), totalPages - 1);
  const page = groups[state.recordSolvedPage];
  solvedQuestionCount.textContent = page
    ? `全部で${summary.solvedQuestionIds.length}問解きました。${page.dateLabel}は${page.questionIds.length}問です。`
    : `全部で${summary.solvedQuestionIds.length}問解きました。`;
  renderRecordQuestionList(
    solvedQuestionList,
    page?.questionIds || [],
    "まだ解いた問題はありません。",
    "solved",
  );
  const hasPagination = groups.length > 1;
  solvedPagination.hidden = !hasPagination;
  solvedPageStatus.textContent = hasPagination ? `${state.recordSolvedPage + 1} / ${totalPages}` : "";
  solvedPrevButton.disabled = state.recordSolvedPage <= 0;
  solvedNextButton.disabled = state.recordSolvedPage >= totalPages - 1;
}

function changeSolvedPage(delta) {
  const summary = learningRecord.summarize(state.allQuestions, FIELD_DEFINITIONS);
  const totalPages = Math.max(1, groupSolvedQuestionIds(summary.solvedQuestionIds).length);
  const nextPage = Math.min(Math.max(0, state.recordSolvedPage + delta), totalPages - 1);
  if (nextPage === state.recordSolvedPage) {
    return;
  }
  state.recordSolvedPage = nextPage;
  renderSolvedQuestions();
  scrollToTop();
}

function groupSolvedQuestionIds(questionIds) {
  const groups = [];
  const groupsByDate = new Map();
  for (const questionId of questionIds) {
    const answeredAt = learningRecord.getQuestion(questionId).answeredAt;
    const dateLabel = answeredAt ? formatAnswerDateOnly(answeredAt) : "日付不明";
    let group = groupsByDate.get(dateLabel);
    if (!group) {
      group = { dateLabel, questionIds: [] };
      groupsByDate.set(dateLabel, group);
      groups.push(group);
    }
    group.questionIds.push(questionId);
  }
  return groups;
}

function renderRecordQuestionList(container, questionIds, emptyMessage, returnView) {
  const questionById = new Map(state.allQuestions.map((question) => [String(question.id), question]));
  if (!questionIds.length) {
    container.innerHTML = `<p class="record-empty">${escapeHtml(emptyMessage)}</p>`;
    return;
  }
  container.replaceChildren(
    ...questionIds.map((questionId) => {
      const question = questionById.get(questionId);
      const record = learningRecord.getQuestion(questionId);
      const item = document.createElement("article");
      item.className = "record-question-item";
      const lastLabel = record.lastCorrect === null ? "未回答" : record.lastCorrect ? "最後は正解" : "最後は不正解";
      const rate = record.attempts ? Math.round((record.correct / record.attempts) * 100) : 0;
      item.innerHTML = `
        <button class="record-question-open" type="button">
          <p>${escapeHtml(question?.stem || questionId)}</p>
          <span>${record.correct}/${record.attempts}（${rate}%）・${lastLabel}${record.answeredAt ? `・${escapeHtml(formatAnswerDate(record.answeredAt))}` : ""}</span>
        </button>
        ${renderQuestionCheckButton(questionId)}
      `;
      item.addEventListener("click", (event) => {
        if (event.target.closest("[data-check-question]")) {
          return;
        }
        const listType = returnView === "checked" ? "saved" : returnView;
        const reviewMode = returnView === "wrong" ? "practice" : "explanation";
        trackAnalyticsEvent("review_question_open", {
          list_type: listType,
          review_mode: reviewMode,
        });
        if (returnView === "wrong") {
          startRecordPractice(questionId, returnView);
        } else {
          startRecordReview(questionId, returnView);
        }
      });
      item.querySelector("[data-check-question]")?.addEventListener("click", () => {
        toggleQuestionCheck(questionId, "record_list");
      });
      return item;
    }),
  );
}

function startRecordPractice(questionId, returnView) {
  startRecordListQuestion(questionId, returnView, "practice");
}

function startRecordReview(questionId, returnView) {
  startRecordListQuestion(questionId, returnView, "review");
}

function startRecordListQuestion(questionId, returnView, mode) {
  const question = state.allQuestions.find((item) => String(item.id) === String(questionId));
  if (!question) {
    return;
  }
  state.recordListScrollTop = window.scrollY;
  if (state.recordReturnView === "summary" && !state.recordListSnapshot) {
    state.recordListSnapshot = captureRecordListSnapshot();
  }

  state.recordPracticeMode = mode === "practice";
  state.recordReviewMode = mode === "review";
  state.recordListReturnView = returnView;
  const sessionId = initializeSessionQuestions([question]);

  startView.hidden = true;
  summaryView.hidden = true;
  recordView.hidden = true;
  wrongView.hidden = true;
  checkedView.hidden = true;
  solvedView.hidden = true;
  statusBar.hidden = false;
  questionView.hidden = false;
  setStatus.textContent = state.recordPracticeMode ? "復習中" : "解説閲覧中";
  renderQuestion();
  scrollToTop({ instant: true });
  if (state.recordPracticeMode) {
    loadPastChoiceStats(sessionId, [question.id]);
    retryPendingSubmissions();
  }
}

function finishRecordPractice() {
  const submission = createResponseSubmission();
  if (submission) {
    void submitResponseSubmission(submission);
  }
  state.recordPracticeMode = false;
  returnToRecordQuestionList();
  retryPendingSubmissions();
}

function finishRecordReview() {
  state.recordReviewMode = false;
  returnToRecordQuestionList();
}

function returnToRecordQuestionList() {
  statusBar.hidden = true;
  questionView.hidden = true;
  if (state.recordListReturnView === "checked") {
    showCheckedQuestions({ resetPage: false, preserveScroll: true });
  } else if (state.recordListReturnView === "solved") {
    showSolvedQuestions({ resetPage: false, preserveScroll: true });
  } else {
    showWrongQuestions({ resetPage: false, preserveScroll: true });
  }
}

function restoreRecordListScroll(preserveScroll) {
  if (!preserveScroll) {
    scrollToTop();
    return;
  }
  window.scrollTo({ top: Math.max(0, state.recordListScrollTop), behavior: "auto" });
}

function captureRecordListSnapshot() {
  return {
    sessionQuestions: state.sessionQuestions,
    responses: state.responses,
    outOfScopeReports: state.outOfScopeReports,
    pastChoiceStats: state.pastChoiceStats,
    sessionChoiceStats: state.sessionChoiceStats,
    currentIndex: state.currentIndex,
    selectedChoiceId: state.selectedChoiceId,
    pastStatsPromise: state.pastStatsPromise,
    pastStatsLoading: state.pastStatsLoading,
    pastStatsLoaded: state.pastStatsLoaded,
    sessionSummaryRecorded: state.sessionSummaryRecorded,
    responseSubmission: state.responseSubmission,
    outOfScopeSubmission: state.outOfScopeSubmission,
  };
}

function restoreRecordListSnapshot() {
  const snapshot = state.recordListSnapshot;
  const nextSessionId = state.sessionId + 1;
  Object.assign(state, snapshot);
  state.sessionId = nextSessionId;
  state.recordPracticeMode = false;
  state.recordReviewMode = false;
  state.recordListSnapshot = null;
}

function openClearRecordDialog() {
  if (typeof clearRecordDialog.showModal === "function") {
    clearRecordDialog.showModal();
    return;
  }
  if (window.confirm("これまでの学習記録をすべて削除します。この操作は元に戻せません。")) {
    learningRecord.clear();
    updateStartControls();
    renderLearningRecord();
    renderSummaryLifetime();
  }
}

function openInterruptDialog() {
  if (typeof interruptDialog.showModal === "function") {
    if (!state.pendingNavigation) {
      resetInterruptDialog();
    }
    interruptDialog.showModal();
    return;
  }
  const pending = state.pendingNavigation;
  if (!pending) {
    resetInterruptDialog();
  }
  const message = interruptDialogMessage.textContent;
  if (!window.confirm(message)) {
    state.pendingNavigation = null;
    resetInterruptDialog();
    pending?.trigger?.focus();
    return;
  }
  state.pendingNavigation = null;
  resetInterruptDialog();
  if (!pending && isTagChallengeSession()) void returnToTagSearchPage();
  else if (!pending) void interruptSession();
  else if (pending.type === "record") void openRecordAfterChallenge();
  else {
    state.allowNavigation = true;
    window.location.assign(pending.href);
  }
}

function formatAnswerDate(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatAnswerDateOnly(timestamp) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}/${parts.month}/${parts.day}`;
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

function incrementLocalQuestionAttemptCount(questionId) {
  if (state.questionAttemptStatsStatus !== "success" || state.recordReviewMode) {
    return;
  }
  const id = String(questionId);
  const current = Number(state.questionAttemptCounts.get(id));
  if (!Number.isFinite(current) || current < 0) {
    return;
  }
  state.questionAttemptCounts.set(id, current + 1);
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
    mergeLatestQuestionAttemptCounts(latestStats);
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

function mergeLatestQuestionAttemptCounts(stats) {
  if (state.questionAttemptStatsStatus !== "success") {
    return;
  }
  for (const [questionId, record] of Object.entries(stats || {})) {
    const serverAttempts = record?.attempts;
    const localAttempts = Number(state.questionAttemptCounts.get(questionId));
    if (
      typeof serverAttempts !== "number" ||
      !Number.isFinite(serverAttempts) ||
      serverAttempts < 0 ||
      !Number.isFinite(localAttempts) ||
      localAttempts < 0
    ) {
      console.warn(`問題 ${questionId} の最新回答回数が不正なため、ローカル値を維持します。`);
      continue;
    }
    state.questionAttemptCounts.set(questionId, Math.max(localAttempts, serverAttempts));
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
  if (!payload?.questions || typeof payload.questions !== "object" || Array.isArray(payload.questions)) {
    throw new Error("Invalid question stats response");
  }
  return payload.questions;
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

function scrollToTop({ instant = false } = {}) {
  window.scrollTo({ top: 0, behavior: instant ? "auto" : "smooth" });
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
