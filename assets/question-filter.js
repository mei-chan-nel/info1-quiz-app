(() => {
  "use strict";

  const root = document.querySelector("[data-question-filter]");
  if (!root) return;

  const PAGE_SIZE = 10;
  const parameter = root.dataset.filterParam || "tag";
  const searchStateKeys = new Set(["tag", "keyword", "question"]);
  const results = root.querySelector("[data-filter-results]");
  const resultsSection = root.querySelector(".filter-results");
  const heading = root.querySelector("[data-filter-heading]");
  const summary = root.querySelector("[data-filter-summary]");
  const message = root.querySelector("[data-filter-message]");
  const controls = root.querySelector("[data-filter-controls]");
  const loadMore = root.querySelector("[data-filter-load-more]");
  const live = root.querySelector("[data-filter-live]");
  const search = root.querySelector("[data-facet-search]");
  const clear = root.querySelector("[data-facet-clear]");
  const aliases = readAliases();
  const cards = Array.from(root.querySelectorAll("[data-filter-question]")).map((node, index) => ({
    node,
    index,
    id: String(node.dataset.questionId || ""),
    tags: readCardTags(node),
  }));
  let selected = [];
  let focusId = null;
  let visibleCount = PAGE_SIZE;
  let shouldScrollToFocus = false;

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

  function readCardTags(node) {
    try {
      const parsed = JSON.parse(node.dataset.filterTags || "[]");
      return Array.isArray(parsed) ? parsed.map(normalizeTag).filter(Boolean) : [];
    } catch (error) {
      console.warn("問題のタグ情報を読み込めませんでした。", error);
      return [];
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
    return params.getAll(parameter).some((value) => value.trim()) || Boolean(params.get("question")?.trim());
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
      selected: normalizeSelection(params.getAll(parameter)),
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
    return `tags.html${preservedQuerySuffix()}${serializeStateToHash({ selected: values, question: questionId })}`;
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
    focusId = state.question;
    visibleCount = PAGE_SIZE;
    shouldScrollToFocus = scrollToFocus && Boolean(focusId);
    render();
  }

  function applyLocationState() {
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
    };
    const targetKey = stateLocationKey(nextState);
    if (targetKey === locationKey()) return;
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

  function syncFacetLinks() {
    root.querySelectorAll("[data-facet-value]").forEach((link) => {
      const value = normalizeTag(link.dataset.facetValue);
      const active = selected.includes(value);
      link.classList.toggle("is-selected", active);
      link.setAttribute("aria-pressed", String(active));
      link.setAttribute("href", filterHref(toggledSelection(value)));
    });
    if (clear) {
      clear.hidden = selected.length === 0;
      clear.setAttribute("href", filterHref([]));
    }
  }

  function orderCards(matches) {
    const matchSet = new Set(matches);
    const remainder = cards.filter((card) => !matchSet.has(card)).sort((left, right) => left.index - right.index);
    const fragment = document.createDocumentFragment();
    [...matches, ...remainder].forEach((card) => fragment.append(card.node));
    results.append(fragment);
  }

  function resetCards() {
    for (const card of cards) {
      card.node.hidden = true;
      card.node.classList.remove("is-origin-question");
    }
  }

  function render() {
    syncFacetLinks();
    resetCards();
    controls.hidden = true;
    loadMore.hidden = true;
    live.textContent = "";

    if (selected.length === 0) {
      heading.textContent = "タグを選択してください";
      summary.textContent = `${cards.length}問からOR条件で抽出します。`;
      message.textContent = "上のタグ一覧から、学習したい用語や分野を選んでください。";
      message.hidden = false;
      orderCards([]);
      return;
    }

    const matches = cards
      .filter((card) => card.tags.some((tag) => selected.includes(tag)))
      .sort((left, right) => left.index - right.index);
    if (focusId) {
      const originIndex = matches.findIndex((card) => card.id === focusId);
      if (originIndex > 0) matches.unshift(...matches.splice(originIndex, 1));
    }
    orderCards(matches);

    heading.replaceChildren(
      document.createTextNode(`「${selected.join("」「")}」の問題`),
      element("span", "filter-hit-count", `${matches.length}問`),
    );
    summary.textContent = `${selected.length}タグのOR検索で${matches.length}問が見つかりました。`;
    message.hidden = matches.length > 0;

    if (matches.length === 0) {
      message.textContent = "条件に合う問題はありません。タグを選び直してください。";
      return;
    }

    const shown = Math.min(visibleCount, matches.length);
    matches.slice(0, shown).forEach((card) => {
      card.node.hidden = false;
      card.node.classList.toggle("is-origin-question", card.id === focusId);
    });

    const remaining = matches.length - shown;
    controls.hidden = false;
    live.textContent = `${matches.length}問中${shown}問を表示しています。`;
    loadMore.hidden = remaining === 0;
    if (remaining > 0) {
      loadMore.textContent = `さらに${Math.min(PAGE_SIZE, remaining)}問読み込む（残り${remaining}問）`;
    }

    if (shouldScrollToFocus && focusId && matches.some((card) => card.id === focusId)) {
      shouldScrollToFocus = false;
      window.requestAnimationFrame(() => resultsSection.scrollIntoView({ block: "start" }));
    }
  }

  function setSelection(values) {
    navigateToSearchState({ selected: values, question: null });
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
    render();
  });

  if (search) {
    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase("ja");
      root.querySelectorAll(".facet-links > .facet-link").forEach((link) => {
        link.hidden = Boolean(query) && !link.dataset.facetValue.toLocaleLowerCase("ja").includes(query);
      });
      root.querySelectorAll("[data-facet-group]").forEach((group) => {
        const visible = [...group.querySelectorAll(".facet-link")].some((link) => !link.hidden);
        group.hidden = Boolean(query) && !visible;
        if (query && visible) group.open = true;
      });
    });
  }

  window.addEventListener("popstate", applyLocationState);
  window.addEventListener("hashchange", applyLocationState);

  applyLocationState();
})();
