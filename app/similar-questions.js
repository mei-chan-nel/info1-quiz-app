import { weightedPickOne } from "./question-selection.js";

export const SIMILAR_SESSION_MODE = "similar";
export const SIMILAR_RETURN_CONTEXT_KEY = "info1SimilarChallengeReturn:v1";
export const SIMILAR_RETURN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const SIMILAR_QUESTION_COUNT = 5;

export const SIMILAR_SOURCE_TYPES = Object.freeze({
  RESULT_LIST: "result-list",
  SAVED_QUESTION_DETAIL: "saved-question-detail",
  HISTORY_QUESTION_DETAIL: "history-question-detail",
  INCORRECT_QUESTION_ANSWER: "incorrect-question-answer",
});

export const SIMILAR_SOURCE_SCREENS = Object.freeze({
  [SIMILAR_SOURCE_TYPES.RESULT_LIST]: "result_list",
  [SIMILAR_SOURCE_TYPES.SAVED_QUESTION_DETAIL]: "saved_question_detail",
  [SIMILAR_SOURCE_TYPES.HISTORY_QUESTION_DETAIL]: "history_question_detail",
  [SIMILAR_SOURCE_TYPES.INCORRECT_QUESTION_ANSWER]: "incorrect_question_answer",
});

const VALID_SOURCE_TYPES = new Set(Object.values(SIMILAR_SOURCE_TYPES));

export function createSimilarQuestionsLoader({
  url,
  fetchImpl,
  cache = "no-store",
}) {
  if (!url || typeof fetchImpl !== "function") {
    throw new TypeError("類題データのURLとfetch関数が必要です。");
  }

  let cachedData = null;
  let pendingRequest = null;

  function load() {
    if (cachedData) {
      return Promise.resolve(cachedData);
    }
    if (pendingRequest) {
      return pendingRequest;
    }

    pendingRequest = fetchImpl(url, { cache })
      .then((response) => {
        if (!response?.ok) {
          throw new Error(`HTTP ${response?.status ?? "unknown"}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new TypeError("類題データの形式が正しくありません。");
        }
        cachedData = data;
        pendingRequest = null;
        return cachedData;
      })
      .catch((error) => {
        pendingRequest = null;
        throw error;
      });

    return pendingRequest;
  }

  return Object.freeze({
    load,
    getCachedData: () => cachedData,
    getPendingRequest: () => pendingRequest,
    url: String(url),
  });
}

export function buildSimilarCandidates({
  sourceQuestionId,
  similarEntry,
  validQuestionIds,
  onMissing = (candidateId) => console.warn(
    `類題候補 ${candidateId} は問題データに存在しないため除外しました`,
  ),
}) {
  const sourceId = String(sourceQuestionId || "").trim();
  const validIds = new Set(Array.from(validQuestionIds || [], String));
  const candidates = [];
  const seenIds = new Set();

  appendCandidates(similarEntry?.top5, 3);
  appendCandidates(similarEntry?.additional, 1);
  return candidates;

  function appendCandidates(values, weight) {
    if (!Array.isArray(values)) {
      return;
    }
    for (const value of values) {
      if (typeof value !== "string") {
        continue;
      }
      const candidateId = value.trim();
      if (!candidateId || candidateId === sourceId || seenIds.has(candidateId)) {
        continue;
      }
      seenIds.add(candidateId);
      if (!validIds.has(candidateId)) {
        onMissing(candidateId);
        continue;
      }
      candidates.push({ id: candidateId, weight });
    }
  }
}

export function weightedSampleWithoutReplacement(
  candidates,
  count,
  random = Math.random,
) {
  const pool = Array.from(candidates || [], (candidate) => ({ ...candidate }));
  const targetCount = Math.min(
    Math.max(0, Math.floor(Number(count) || 0)),
    pool.length,
  );
  const selected = [];

  while (selected.length < targetCount && pool.length > 0) {
    const picked = weightedPickOne(pool, {
      getWeight: (candidate) => candidate.weight,
      random,
    });
    if (!picked) {
      break;
    }
    selected.push(picked.id);
    pool.splice(pool.indexOf(picked), 1);
  }
  return selected;
}

export function shuffleQuestionIds(questionIds, random = Math.random) {
  const shuffled = [...questionIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = normalizeRandomValue(random());
    const swapIndex = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function selectSimilarQuestionIds({
  candidates,
  count = SIMILAR_QUESTION_COUNT,
  random = Math.random,
}) {
  const pool = Array.from(candidates || []);
  const selectionCount = Math.min(
    Math.max(0, Math.floor(Number(count) || 0)),
    pool.length,
  );
  const selected = pool.length <= selectionCount
    ? pool.map((candidate) => candidate.id)
    : weightedSampleWithoutReplacement(pool, selectionCount, random);
  return shuffleQuestionIds(selected, random);
}

export function createSimilarReturnContext({
  sourceType,
  sourceQuestionId,
  returnUrl,
  scrollY,
  viewState,
  createdAt = Date.now(),
}) {
  return {
    version: 1,
    createdAt: Number(createdAt),
    sourceType,
    sourceQuestionId: String(sourceQuestionId || "").trim(),
    returnUrl: String(returnUrl || ""),
    scrollY: Math.max(0, Number(scrollY) || 0),
    viewState: viewState && typeof viewState === "object" ? viewState : {},
  };
}

export function writeSimilarReturnContext(
  context,
  { storage = getSessionStorage(), locationLike = getLocation() } = {},
) {
  clearSimilarReturnContext({ storage });
  const normalized = normalizeSimilarReturnContext(context, locationLike);
  if (!storage || !normalized) {
    return false;
  }
  try {
    storage.setItem(SIMILAR_RETURN_CONTEXT_KEY, JSON.stringify(normalized));
    return true;
  } catch (error) {
    console.error("類題出題の復元情報を保存できませんでした。", error);
    return false;
  }
}

export function readSimilarReturnContext({
  storage = getSessionStorage(),
  locationLike = getLocation(),
  now = Date.now(),
} = {}) {
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(SIMILAR_RETURN_CONTEXT_KEY);
    if (!raw) {
      return null;
    }
    const normalized = normalizeSimilarReturnContext(JSON.parse(raw), locationLike);
    const age = Number(now) - Number(normalized?.createdAt);
    if (
      !normalized
      || !Number.isFinite(age)
      || age < 0
      || age >= SIMILAR_RETURN_MAX_AGE_MS
    ) {
      clearSimilarReturnContext({ storage });
      return null;
    }
    return normalized;
  } catch (error) {
    console.warn("類題出題の復元情報を読み込めませんでした。", error);
    clearSimilarReturnContext({ storage });
    return null;
  }
}

export function clearSimilarReturnContext({ storage = getSessionStorage() } = {}) {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(SIMILAR_RETURN_CONTEXT_KEY);
  } catch (error) {
    console.warn("類題出題の復元情報を削除できませんでした。", error);
  }
}

export function getSafeSimilarReturnUrl(returnUrl, locationLike = getLocation()) {
  if (!locationLike?.href || !locationLike?.origin || !locationLike?.pathname) {
    return "";
  }
  try {
    const candidate = new URL(returnUrl, locationLike.href);
    if (
      candidate.origin !== locationLike.origin
      || candidate.pathname !== locationLike.pathname
    ) {
      return `${locationLike.pathname}${locationLike.search || ""}${locationLike.hash || ""}`;
    }
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return `${locationLike.pathname}${locationLike.search || ""}${locationLike.hash || ""}`;
  }
}

function normalizeSimilarReturnContext(context, locationLike) {
  if (!context || typeof context !== "object" || context.version !== 1) {
    return null;
  }
  const sourceQuestionId = typeof context.sourceQuestionId === "string"
    ? context.sourceQuestionId.trim()
    : "";
  const createdAt = Number(context.createdAt);
  if (
    !VALID_SOURCE_TYPES.has(context.sourceType)
    || !sourceQuestionId
    || !Number.isFinite(createdAt)
    || !context.viewState
    || typeof context.viewState !== "object"
    || Array.isArray(context.viewState)
  ) {
    return null;
  }
  const returnUrl = getSafeSimilarReturnUrl(context.returnUrl, locationLike);
  if (!returnUrl) {
    return null;
  }
  return createSimilarReturnContext({
    sourceType: context.sourceType,
    sourceQuestionId,
    returnUrl,
    scrollY: context.scrollY,
    viewState: context.viewState,
    createdAt,
  });
}

function normalizeRandomValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  return Math.min(number, 1 - Number.EPSILON);
}

function getSessionStorage() {
  try {
    return globalThis.window?.sessionStorage || null;
  } catch {
    return null;
  }
}

function getLocation() {
  return globalThis.window?.location || null;
}
