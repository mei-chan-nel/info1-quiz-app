(() => {
  "use strict";

  const root = document.querySelector("[data-question-filter]");
  if (!root) return;

  const PAGE_SIZE = 10;
  const parameter = root.dataset.filterParam || "tag";
  const searchStateKeys = new Set(["tag", "question", "q", "fields"]);
  const results = root.querySelector("[data-filter-results]");
  const resultsSection = root.querySelector(".filter-results");
  const heading = root.querySelector("[data-filter-heading]");
  const summary = root.querySelector("[data-filter-summary]");
  const message = root.querySelector("[data-filter-message]");
  const controls = root.querySelector("[data-filter-controls]");
  const loadMore = root.querySelector("[data-filter-load-more]");
  const live = root.querySelector("[data-filter-live]");
  const clear = root.querySelector("[data-facet-clear]");
  const tagChallengeControls = root.querySelector("[data-tag-challenge-controls]");
  const tagChallengeCount = root.querySelector("[data-tag-challenge-count]");
  const tagChallengeIncrease = root.querySelector("[data-tag-challenge-increase]");
  const tagChallengeDecrease = root.querySelector("[data-tag-challenge-decrease]");
  const tagChallengeStart = root.querySelector("[data-tag-challenge-start]");
  const tagChallenge = window.Info1TagChallenge;
  const aliases = readAliases();
  const keywordInput = root.querySelector("[data-keyword-input]");
  const keywordPanel = root.querySelector("[data-keyword-panel]");
  const tagPanel = root.querySelector(".facet-panel:not([data-keyword-panel])");
  const fieldInputs = [...root.querySelectorAll("[data-search-field]")];
  const defaultFields = ["stem", "choices"];
  let keyword = "";
  let fields = [...defaultFields];
  let cards = [];
  let dataPromise = null;
  let renderVersion = 0;
  let currentMatches = [];
  let renderedCount = 0;
  let facetKey = null;
  let composing = false;
  let searchTimer;

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(root.dataset.filterData)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((data) => {
          cards = data.questions.map((question) => ({
            ...question,
            search: {
              stem: normalizeText(question.stem),
              choices: normalizeText(question.choices.map((choice) => choice.text).join("\n")),
              explanation: normalizeText([question.explanation, ...question.choices.map((choice) => choice.explanation)].join("\n")),
            },
          }));
        })
        .catch((error) => { dataPromise = null; throw error; });
    }
    return dataPromise;
  }

  function normalizeText(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase("ja").replace(/\s+/gu, " ").trim();
  }

  function searchTerms() {
    return normalizeText(keyword).split(/\s+/u).filter(Boolean);
  }

  function hasConditions() {
    return selected.length > 0 || (searchTerms().length > 0 && fields.length > 0);
  }

  let selected = [];
  let focusId = null;
  let visibleCount = PAGE_SIZE;
  let shouldScrollToFocus = false;
  let tagChallengeQuestionCount = 0;
  let tagChallengeSelectionKey = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function readAliases() {
    try {
      const parsed = JSON.parse(root.dataset.tagAliases || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.warn("タグ表記の互換情報を読み込めませんでした。", error);
      return {};
    }
  }

  function normalizeTag(value) {
    const tag = String(value || "").trim();
    return aliases[tag] || tag;
  }

  function normalizeSelection(values) {
    return [...new Set(values.map(normalizeTag).filter(Boolean))];
  }

  let lastAppliedLocation = null;

  function hasStateParameter(params) {
    return params.getAll(parameter).some((value) => value.trim()) || Boolean(params.get("question")?.trim()) || Boolean(params.get("q")?.trim());
  }

  function hasRecognizedStateParameter(params) {
    for (const key of params.keys()) {
      if (searchStateKeys.has(key)) return true;
    }
    return false;
  }

  function queryWithoutSearchState(url = new URL(window.location.href)) {
    const params = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      if (!searchStateKeys.has(key)) params.append(key, value);
    }
    return params;
  }

  function preservedQuerySuffix() {
    const query = queryWithoutSearchState().toString();
    return query ? `?${query}` : "";
  }

  function parseStateFromParams(params) {
    return {
      selected: params.get("q")?.trim() ? [] : normalizeSelection(params.getAll(parameter)),
      keyword: params.get("q") || "",
      fields: params.has("fields") ? params.get("fields").split(",").filter((field) => defaultFields.includes(field) || field === "explanation") : [...defaultFields],
      question: params.get("question") || null,
    };
  }

  function parseStateFromLocation() {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
    const useHash = hasStateParameter(hashParams);
    const params = useHash ? hashParams : url.searchParams;
    return {
      state: parseStateFromParams(params),
      hasHashState: useHash,
      hasQueryState: hasStateParameter(url.searchParams),
    };
  }

  function serializeStateToHash(state) {
    const params = new URLSearchParams();
    if (state.keyword?.trim()) {
      params.set("q", state.keyword.trim());
      params.set("fields", (state.fields || defaultFields).join(","));
    }
    normalizeSelection(state.selected).forEach((value) => params.append(parameter, value));
    if (state.question) params.set("question", state.question);
    const serialized = params.toString();
    return serialized ? `#${serialized}` : "";
  }

  function locationKey(url = new URL(window.location.href)) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function stateLocationKey(state) {
    const url = new URL(window.location.href);
    url.search = queryWithoutSearchState(url).toString();
    url.hash = serializeStateToHash(state);
    return locationKey(url);
  }

  function filterHref(values, questionId = null) {
    return `./${preservedQuerySuffix()}${serializeStateToHash({ selected: values, question: questionId })}`;
  }

  function synchronizeLocation(state) {
    const current = new URL(window.location.href);
    const target = new URL(current);
    target.search = queryWithoutSearchState(current).toString();
    target.hash = serializeStateToHash(state);
    const hashParams = new URLSearchParams(current.hash.slice(1));
    const targetKey = locationKey(target);
    if ((hasRecognizedStateParameter(current.searchParams) || hasRecognizedStateParameter(hashParams)) && locationKey(current) !== targetKey) {
      window.history.replaceState(window.history.state, "", `${target.pathname}${target.search}${target.hash}`);
    }
    return targetKey;
  }

  function applySearchState(state, { scrollToFocus = false } = {}) {
    selected = normalizeSelection(state.selected);
    keyword = state.keyword || "";
    fields = state.fields || [...defaultFields];
    keywordInput.value = keyword;
    fieldInputs.forEach((input) => { input.checked = fields.includes(input.value); });
    if (keyword.trim()) { keywordPanel.open = true; tagPanel.open = false; }
    else if (selected.length) { keywordPanel.open = false; tagPanel.open = true; }
    focusId = state.question;
    visibleCount = PAGE_SIZE;
    shouldScrollToFocus = scrollToFocus && Boolean(focusId);
    void render();
  }

  function applyLocationState() {
    clearTimeout(searchTimer);
    const parsed = parseStateFromLocation();
    const targetKey = synchronizeLocation(parsed.state);
    if (targetKey === lastAppliedLocation) return;
    applySearchState(parsed.state, { scrollToFocus: Boolean(parsed.state.question) });
    lastAppliedLocation = targetKey;
  }

  function navigateToSearchState(state) {
    const nextState = {
      selected: normalizeSelection(state.selected),
      question: state.question || null,
      keyword: state.keyword || "",
      fields: state.fields || fields,
    };
    const targetKey = stateLocationKey(nextState);
    if (targetKey === locationKey()) { applySearchState(nextState); return; }
    const url = new URL(window.location.href);
    url.search = queryWithoutSearchState(url).toString();
    url.hash = serializeStateToHash(nextState);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    applySearchState(nextState);
    lastAppliedLocation = targetKey;
  }

  function toggledSelection(value) {
    const normalizedValue = normalizeTag(value);
    const values = new Set(selected);
    if (values.has(normalizedValue)) values.delete(normalizedValue);
    else values.add(normalizedValue);
    return [...values];
  }

  function matchesSelection(card, values) {
    return values.every((value) => card.tags.includes(value));
  }

  function sortFacetLinks() {
    const selectedOrder = new Map(selected.map((value, index) => [value, index]));
    root.querySelectorAll("[data-facet-links], [data-facet-list]").forEach((container) => {
      const links = Array.from(container.children)
        .filter((child) => child.matches("[data-facet-value]"))
        .map((link, index) => ({
          link,
          index,
          value: normalizeTag(link.dataset.facetValue),
          matchCount: Number(link.dataset.filterMatchCount),
        }));

      links.sort((left, right) => {
        const leftSelected = selectedOrder.has(left.value);
        const rightSelected = selectedOrder.has(right.value);
        if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
        if (leftSelected && rightSelected) {
          return selectedOrder.get(left.value) - selectedOrder.get(right.value) || left.index - right.index;
        }
        const leftCount = Number.isFinite(left.matchCount) ? left.matchCount : -1;
        const rightCount = Number.isFinite(right.matchCount) ? right.matchCount : -1;
        return rightCount - leftCount || left.index - right.index;
      });

      links.forEach(({ link }) => container.append(link));
    });
  }

  function matchingCards() {
    const terms = searchTerms();
    return cards.filter((card) => {
      if (selected.length) return matchesSelection(card, selected);
      const text = fields.map((field) => card.search[field]).join("\n");
      return terms.every((term) => text.includes(term));
    });
  }

  function tagChallengeKey() {
    return JSON.stringify([selected, keyword.trim(), fields]);
  }

  function syncTagChallengeControls(candidateCards) {
    if (!tagChallengeControls || !tagChallengeCount || !tagChallengeStart) {
      return;
    }
    const selectionKey = tagChallengeKey();
    if (selectionKey !== tagChallengeSelectionKey) {
      tagChallengeQuestionCount = Math.min(5, candidateCards.length);
      tagChallengeSelectionKey = selectionKey;
    }
    const candidateCount = candidateCards.length;
    const max = candidateCount;
    tagChallengeQuestionCount = Math.min(
      Math.max(tagChallengeQuestionCount, candidateCount > 0 ? 1 : 0),
      max,
    );
    const hasSelection = hasConditions();
    const canStart = Boolean(tagChallenge) && hasSelection && tagChallengeQuestionCount > 0;
    tagChallengeControls.hidden = !hasSelection;
    tagChallengeCount.textContent = `${tagChallengeQuestionCount}問`;
    tagChallengeIncrease.disabled = !canStart || tagChallengeQuestionCount >= max;
    tagChallengeDecrease.disabled = !canStart || tagChallengeQuestionCount <= 1;
    tagChallengeStart.disabled = !canStart;
    tagChallengeStart.textContent = canStart
      ? "検索結果をアプリで出題"
      : "アプリで出題できません";
  }

  function changeTagChallengeQuestionCount(delta) {
    const candidateCards = matchingCards();
    if (!candidateCards.length) {
      syncTagChallengeControls(candidateCards);
      return;
    }
    tagChallengeQuestionCount = Math.min(
      Math.max(tagChallengeQuestionCount + delta, 1),
      candidateCards.length,
    );
    syncTagChallengeControls(candidateCards);
  }

  function startTagChallenge() {
    if (!tagChallenge) {
      return;
    }
    const candidateQuestionIds = tagChallenge.normalizeIds(
      matchingCards().map((card) => card.id),
    );
    const questionCount = Math.min(tagChallengeQuestionCount, candidateQuestionIds.length);
    if (!candidateQuestionIds.length || questionCount < 1) {
      syncTagChallengeControls(matchingCards());
      return;
    }
    const currentQuestionIds = tagChallenge.shuffle(candidateQuestionIds).slice(0, questionCount);
    const context = {
      version: tagChallenge.VERSION,
      source: tagChallenge.SOURCE,
      candidateQuestionIds,
      questionCount,
      currentQuestionIds,
      returnUrl: window.location.href,
      createdAt: new Date().toISOString(),
    };
    if (!tagChallenge.writeContext(context)) {
      if (live) {
        live.textContent = "セッション情報を保存できないため、アプリを開始できません。";
      }
      return;
    }
    const appUrl = new URL("../app/", window.location.href);
    appUrl.searchParams.set("challenge", currentQuestionIds.join(","));
    appUrl.searchParams.set("source", tagChallenge.SOURCE);
    window.location.assign(appUrl.toString());
  }

  function syncFacetVisibility() {
    root.querySelectorAll("[data-facet-value]").forEach((link) => {
      const hasResults = link.dataset.filterZero !== "true";
      link.hidden = !hasResults;
    });
    root.querySelectorAll("[data-facet-group]").forEach((group) => {
      const visible = [...group.querySelectorAll(".facet-link")].some((link) => !link.hidden);
      group.hidden = !visible;
    });
  }

  function syncFacetLinks() {
    const key = selected.join("\u0000");
    if (key === facetKey) return;
    facetKey = key;
    const counts = new Map();
    cards.filter((card) => matchesSelection(card, selected)).forEach((card) => {
      card.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    root.querySelectorAll("[data-facet-value]").forEach((link) => {
      const value = normalizeTag(link.dataset.facetValue);
      const active = selected.includes(value);
      link.classList.toggle("is-selected", active);
      link.setAttribute("aria-pressed", String(active));
      link.setAttribute("href", filterHref(toggledSelection(value)));
      const count = link.querySelector("[data-facet-count]");
      if (count) {
        if (active) {
          count.hidden = true;
          link.dataset.filterZero = "false";
        } else {
          const matches = (counts.get(value) || 0);
          count.textContent = `${matches}問`;
          count.hidden = false;
          link.dataset.filterMatchCount = String(matches);
          link.dataset.filterZero = String(matches === 0);
        }
      }
    });
    if (clear) {
      clear.hidden = selected.length === 0;
      clear.setAttribute("href", filterHref([]));
    }
    sortFacetLinks();
    syncFacetVisibility();
  }

  function createCard(card) {
    const shell = element("div", "filtered-question-shell");
    shell.dataset.filterQuestion = "";
    shell.dataset.questionId = card.id;
    shell.classList.toggle("is-origin-question", card.id === focusId);
    const article = element("article", "question-card filtered-question-card");
    const meta = element("div", "question-meta");
    meta.append(element("span", "", `${card.field_label} · QUESTION ${String(card.field_number).padStart(3, "0")}`));
    const choices = element("ol", "choice-list");
    card.choices.forEach((choice) => {
      const item = element("li");
      const button = element("button", "search-choice");
      button.type = "button";
      button.dataset.choiceId = choice.choice_id;
      button.setAttribute("aria-pressed", "false");
      button.append(element("span", "choice-label", choice.label), element("span", "choice-text", choice.text));
      item.append(button);
      choices.append(item);
    });
    const feedback = element("p", "search-answer-feedback", "\u00a0");
    feedback.setAttribute("aria-live", "polite");
    const details = element("details", "answer-panel");
    const toggle = element("summary");
    const icon = element("span", "detail-icon");
    icon.setAttribute("aria-hidden", "true");
    toggle.append(element("span", "", "正答と解説を確認"), icon);
    details.append(toggle);
    // Build explanation DOM only when requested, without affecting search coverage.
    details.addEventListener("toggle", () => {
      if (!details.open || details.querySelector(".answer-content")) return;
      const content = element("div", "answer-content");
      const correct = element("p", "correct-answer");
      correct.append(element("span", "", "正答"), element("strong", "", `${card.correct.label}. ${card.correct.text}`));
      const explanation = element("div", "explanation");
      explanation.append(element("h3", "", "解説"), element("p", "", card.explanation));
      const reasons = element("div", "choice-reasons");
      card.choices.forEach((choice) => {
        reasons.append(element("h4", "", `${choice.label}：${choice.choice_id === card.answer_choice_id ? "正答" : "誤答"}`), element("p", "", choice.explanation || (choice.choice_id === card.answer_choice_id ? card.explanation : "この選択肢は正答ではない。")));
      });
      explanation.append(reasons);
      const source = element("dl", "source-row");
      source.append(element("dt", "", "出典"), element("dd", "", card.source));
      content.append(correct, explanation, source);
      if (card.tags.length) {
        const tagRow = element("div", "tag-row");
        const tags = element("ul");
        card.tags.forEach((tag) => tags.append(element("li", "search-tag", tag)));
        tagRow.append(element("span", "", "タグ"), tags);
        content.append(tagRow);
      }
      details.append(content);
    });
    choices.addEventListener("click", (event) => {
      const button = event.target.closest("[data-choice-id]");
      if (!button) return;
      choices.querySelectorAll("button").forEach((choiceButton) => {
        const correct = choiceButton.dataset.choiceId === card.answer_choice_id;
        const selected = choiceButton === button;
        choiceButton.classList.toggle("correct", correct);
        choiceButton.classList.toggle("incorrect", selected && !correct);
        choiceButton.setAttribute("aria-pressed", String(selected));
      });
      feedback.textContent = button.dataset.choiceId === card.answer_choice_id
        ? "正解です。" : `不正解です。正答は ${card.correct.label} です。`;
    });
    article.append(meta, element("h3", "", card.stem), choices, feedback, details);
    shell.append(article);
    return shell;
  }

  function appendResults() {
    const shown = Math.min(visibleCount, currentMatches.length);
    const fragment = document.createDocumentFragment();
    currentMatches.slice(renderedCount, shown).forEach((card) => fragment.append(createCard(card)));
    results.append(fragment);
    renderedCount = shown;
    const remaining = currentMatches.length - shown;
    controls.hidden = currentMatches.length === 0;
    live.textContent = `${currentMatches.length}問中${shown}問を表示しています。`;
    loadMore.hidden = remaining === 0;
    if (remaining) loadMore.textContent = `さらに${Math.min(PAGE_SIZE, remaining)}問読み込む（残り${remaining}問）`;
  }

  async function render() {
    const version = ++renderVersion;
    results.replaceChildren();
    renderedCount = 0;
    currentMatches = [];
    controls.hidden = true;
    loadMore.hidden = true;
    message.hidden = true;
    live.textContent = "";
    const active = hasConditions();
    resultsSection.hidden = !active;
    if (!active) {
      root.removeAttribute("aria-busy");
      syncTagChallengeControls([]);
      // Restore tag facets after clearing keyword/tag conditions, if loaded.
      if (cards.length) syncFacetLinks();
      return;
    }
    heading.textContent = "検索結果";
    summary.textContent = "";
    tagChallengeControls.hidden = true;
    root.setAttribute("aria-busy", "true");
    try {
      await loadData();
      if (version !== renderVersion) return;
      syncFacetLinks();
      const matches = matchingCards();
      if (focusId) {
        const originIndex = matches.findIndex((card) => card.id === focusId);
        if (originIndex > 0) matches.unshift(...matches.splice(originIndex, 1));
      }
      currentMatches = matches;
      syncTagChallengeControls(matches);
      heading.replaceChildren(document.createTextNode("検索結果"), element("span", "filter-hit-count", `${matches.length}問`));
      summary.textContent = selected.length
        ? `「${selected.join("」「")}」のAND検索で${matches.length}問が見つかりました。`
        : `「${keyword.trim()}」のAND検索で${matches.length}問が見つかりました。`;
      message.hidden = matches.length > 0;
      if (!matches.length) message.textContent = "条件に合う問題はありません。検索条件を変更してください。";
      appendResults();
      if (shouldScrollToFocus && matches.some((card) => card.id === focusId)) {
        shouldScrollToFocus = false;
        window.requestAnimationFrame(() => resultsSection.scrollIntoView({ block: "start" }));
      }
    } catch (error) {
      if (version !== renderVersion) return;
      summary.textContent = "";
      message.textContent = "検索データを読み込めませんでした。もう一度検索してください。";
      message.hidden = false;
      console.error("問題検索データの読み込みに失敗しました。", error);
    } finally {
      if (version === renderVersion) root.removeAttribute("aria-busy");
    }
  }

  function setSelection(values) {
    clearTimeout(searchTimer);
    keywordInput.value = "";
    navigateToSearchState({ selected: values, question: null, fields: defaultFields });
  }

  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const facet = event.target.closest("[data-facet-value]");
    if (facet && root.contains(facet)) {
      event.preventDefault();
      setSelection(toggledSelection(facet.dataset.facetValue));
      return;
    }
    const clearLink = event.target.closest("[data-facet-clear]");
    if (clearLink) {
      event.preventDefault();
      setSelection([]);
    }
  });

  loadMore.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    appendResults();
  });

  tagChallengeIncrease?.addEventListener("click", () => changeTagChallengeQuestionCount(1));
  tagChallengeDecrease?.addEventListener("click", () => changeTagChallengeQuestionCount(-1));
  tagChallengeStart?.addEventListener("click", startTagChallenge);

  function submitKeyword() {
    clearTimeout(searchTimer);
    if (composing) return;
    navigateToSearchState({ selected: [], keyword: keywordInput.value,
      fields: fieldInputs.filter((input) => input.checked).map((input) => input.value), question: null });
  }

  root.querySelector("[data-keyword-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    submitKeyword();
  });
  keywordInput.addEventListener("compositionstart", () => { composing = true; clearTimeout(searchTimer); });
  keywordInput.addEventListener("compositionend", () => {
    composing = false;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(submitKeyword, 250);
  });
  keywordInput.addEventListener("input", (event) => {
    clearTimeout(searchTimer);
    if (!composing && !event.isComposing) searchTimer = setTimeout(submitKeyword, 250);
  });
  fieldInputs.forEach((input) => input.addEventListener("change", submitKeyword));

  window.addEventListener("popstate", applyLocationState);
  window.addEventListener("hashchange", applyLocationState);

  applyLocationState();
})();
