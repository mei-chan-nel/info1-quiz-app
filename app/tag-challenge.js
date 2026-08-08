(() => {
  "use strict";

  const CONTEXT_KEY = "info1TagChallengeContext:v1";
  const SOURCE = "tag-search";
  const VERSION = 1;
  const DEFAULT_RETURN_PATH = "/info1-quiz-app/questions/";

  function normalizeIds(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    const ids = [];
    const seen = new Set();
    for (const item of value) {
      const id = String(item ?? "").trim();
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function normalizeContext(context) {
    if (!context || typeof context !== "object") {
      return null;
    }
    return {
      version: context.version,
      source: context.source,
      candidateQuestionIds: normalizeIds(context.candidateQuestionIds),
      questionCount: Number(context.questionCount),
      currentQuestionIds: normalizeIds(context.currentQuestionIds),
      returnUrl: typeof context.returnUrl === "string" ? context.returnUrl : "",
      createdAt: context.createdAt,
    };
  }

  function isValidContext(context) {
    const normalized = normalizeContext(context);
    if (!normalized || normalized.version !== VERSION || normalized.source !== SOURCE) {
      return false;
    }
    const candidates = new Set(normalized.candidateQuestionIds);
    if (
      !normalized.candidateQuestionIds.length
      || !normalized.currentQuestionIds.length
      || !Number.isInteger(normalized.questionCount)
      || normalized.questionCount < 1
      || normalized.questionCount > normalized.candidateQuestionIds.length
      || normalized.currentQuestionIds.length !== normalized.questionCount
      || normalized.currentQuestionIds.some((id) => !candidates.has(id))
      || !normalized.returnUrl.trim()
    ) {
      return false;
    }
    return typeof normalized.createdAt === "string" || typeof normalized.createdAt === "number";
  }

  function readContext() {
    try {
      const raw = window.sessionStorage?.getItem(CONTEXT_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      return isValidContext(parsed) ? normalizeContext(parsed) : null;
    } catch (error) {
      console.warn("タグ出題用のセッション情報を読み込めませんでした。", error);
      return null;
    }
  }

  function writeContext(context) {
    const normalized = normalizeContext(context);
    if (!isValidContext(normalized)) {
      return false;
    }
    try {
      const storage = window.sessionStorage;
      if (!storage) {
        return false;
      }
      storage.setItem(CONTEXT_KEY, JSON.stringify(normalized));
      return true;
    } catch (error) {
      console.error("タグ出題用のセッション情報を保存できませんでした。", error);
      return false;
    }
  }

  function clearContext() {
    try {
      window.sessionStorage?.removeItem(CONTEXT_KEY);
    } catch (error) {
      console.warn("タグ出題用のセッション情報を削除できませんでした。", error);
    }
  }

  function shuffle(values, random = Math.random) {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomValue = Number(random());
      const normalizedRandom = Number.isFinite(randomValue)
        ? Math.min(Math.max(randomValue, 0), 0.9999999999999999)
        : 0;
      const swapIndex = Math.floor(normalizedRandom * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function sameSet(left, right) {
    const leftIds = normalizeIds(left);
    const rightIds = normalizeIds(right);
    if (leftIds.length !== rightIds.length) {
      return false;
    }
    const rightSet = new Set(rightIds);
    return leftIds.every((id) => rightSet.has(id));
  }

  function getQuestionSearchUrl(locationLike = window.location) {
    const href = typeof locationLike?.href === "string" && locationLike.href
      ? locationLike.href
      : window.location.href;
    try {
      return new URL("../questions/", href);
    } catch {
      const origin = typeof locationLike?.origin === "string" && locationLike.origin !== "null"
        ? locationLike.origin
        : "https://mei-chan-nel.com";
      return new URL(DEFAULT_RETURN_PATH, origin);
    }
  }

  function getSafeReturnUrl(returnUrl, locationLike = window.location) {
    const fallback = getQuestionSearchUrl(locationLike);
    const baseHref = typeof locationLike?.href === "string" && locationLike.href
      ? locationLike.href
      : fallback.href;
    try {
      const candidate = new URL(returnUrl, baseHref);
      if (candidate.origin !== fallback.origin || candidate.pathname !== fallback.pathname) {
        return `${fallback.pathname}${fallback.search}${fallback.hash}`;
      }
      return `${candidate.pathname}${candidate.search}${candidate.hash}`;
    } catch {
      return `${fallback.pathname}${fallback.search}${fallback.hash}`;
    }
  }

  function isTagSearchSource(url = window.location.href) {
    try {
      return new URL(url, window.location.href).searchParams.get("source") === SOURCE;
    } catch {
      return false;
    }
  }

  window.Info1TagChallenge = Object.freeze({
    CONTEXT_KEY,
    SOURCE,
    VERSION,
    DEFAULT_RETURN_PATH,
    normalizeIds,
    isValidContext,
    readContext,
    writeContext,
    clearContext,
    shuffle,
    sameSet,
    getQuestionSearchUrl,
    getSafeReturnUrl,
    isTagSearchSource,
  });
})();
