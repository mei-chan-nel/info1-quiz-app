(() => {
  "use strict";

  const CONTEXT_KEY = "info1TagChallengeContext:v1";
  const SOURCE = "tag-search";
  const VERSION = 1;
  const DEFAULT_RETURN_PATH = "/info1-quiz-app/questions/";
  const TERM_GUIDES_URL = "/assets/term-guides.js?v=2026090601";
  const REMOVED_FACET_HELP = "タグは主に関連する分野へ整理しています。この一覧では複数選択のAND検索、各問題に付くタグからはそのタグだけの検索になります。";

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

  function installTermGuideStyles() {
    if (document.querySelector("[data-term-guide-action-styles]")) {
      return;
    }
    const style = document.createElement("style");
    style.dataset.termGuideActionStyles = "";
    style.textContent = `
      .tag-challenge-controls.tag-learning-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .tag-challenge-controls.tag-learning-actions[hidden] {
        display: none;
      }
      .tag-learning-actions .tag-challenge-count-control {
        display: none !important;
      }
      .tag-learning-actions .tag-challenge-start,
      .tag-learning-actions .tag-term-guide-link {
        width: 100%;
        min-width: 0;
        min-height: 54px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        text-align: center;
        font-size: .82rem;
        font-weight: 800;
        line-height: 1.4;
      }
      .tag-term-guide-link {
        border: 1px solid var(--ink);
        border-radius: 999px;
        color: var(--ink);
        background: var(--white);
        text-decoration: none;
      }
      .tag-term-guide-link[hidden] {
        display: none !important;
      }
      .tag-term-guide-link:hover,
      .tag-term-guide-link:focus-visible {
        border-color: var(--coral);
        background: #f9e8e2;
      }
      .tag-term-summary {
        margin: 16px 0 0;
        padding: 16px 18px;
        border-left: 3px solid var(--coral);
        color: var(--ink-soft);
        background: var(--white);
        font-size: .82rem;
        line-height: 1.8;
      }
      .tag-term-summary[hidden] {
        display: none;
      }
      @media (max-width: 680px) {
        .tag-challenge-controls.tag-learning-actions {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.append(style);
  }

  function removeObsoleteFacetHelp(root) {
    root.querySelectorAll(".facet-panel-body > p").forEach((paragraph) => {
      if (paragraph.textContent.trim() === REMOVED_FACET_HELP) {
        paragraph.remove();
      }
    });
  }

  function loadTermGuides() {
    if (window.StudyAtlasTermGuides && typeof window.StudyAtlasTermGuides === "object") {
      return Promise.resolve(window.StudyAtlasTermGuides);
    }
    return new Promise((resolve) => {
      const existing = document.querySelector(`script[src^="${TERM_GUIDES_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.StudyAtlasTermGuides || {}), { once: true });
        existing.addEventListener("error", () => resolve({}), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = TERM_GUIDES_URL;
      script.defer = true;
      script.addEventListener("load", () => resolve(window.StudyAtlasTermGuides || {}), { once: true });
      script.addEventListener("error", () => resolve({}), { once: true });
      document.head.append(script);
    });
  }

  function initializeTagSearchTermGuideUi() {
    const root = document.querySelector("[data-question-filter]");
    const controls = root?.querySelector("[data-tag-challenge-controls]");
    const startButton = root?.querySelector("[data-tag-challenge-start]");
    if (!root || !controls || !startButton) {
      return;
    }

    installTermGuideStyles();
    removeObsoleteFacetHelp(root);
    controls.classList.add("tag-learning-actions");

    const summaryElements = new Map(
      [...root.querySelectorAll("[data-tag-summary]")].map((element) => [
        String(element.dataset.tagSummary || "").trim(),
        element,
      ]),
    );

    const guideLink = document.createElement("a");
    guideLink.className = "tag-term-guide-link";
    guideLink.textContent = "詳しい解説を読む";
    guideLink.hidden = true;
    controls.append(guideLink);

    let termGuides = window.StudyAtlasTermGuides || {};

    const update = () => {
      const selectedLinks = [...root.querySelectorAll("[data-facet-value].is-selected")];
      const selectedTags = selectedLinks
        .map((link) => String(link.dataset.facetValue || "").trim())
        .filter(Boolean);
      const summaryElement = selectedTags.length === 1 ? summaryElements.get(selectedTags[0]) : null;
      const guide = selectedTags.length === 1 ? termGuides[selectedTags[0]] : null;
      const hasDescription = Boolean(summaryElement);
      const hasGuideLink = Boolean(guide?.url);

      controls.classList.toggle("has-term-guide", hasGuideLink);
      guideLink.hidden = !hasGuideLink;
      for (const element of summaryElements.values()) {
        element.hidden = element !== summaryElement || !hasDescription;
      }

      if (!startButton.disabled) {
        startButton.textContent = "アプリでランダムに出題する";
      }

      if (hasGuideLink) {
        guideLink.href = guide.url;
      } else {
        guideLink.removeAttribute("href");
      }
    };

    const observer = new MutationObserver(update);
    observer.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-pressed", "disabled"],
    });

    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);

    update();
    void loadTermGuides().then((guides) => {
      termGuides = guides;
      update();
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeTagSearchTermGuideUi, { once: true });
    } else {
      initializeTagSearchTermGuideUi();
    }
  }
})();
