(() => {
  "use strict";

  const root = document.querySelector("[data-question-filter]");
  if (!root) return;

  const parameter = root.dataset.filterParam || "tag";
  const dataUrl = root.dataset.filterData;
  const results = root.querySelector("[data-filter-results]");
  const resultsSection = root.querySelector(".filter-results");
  const heading = root.querySelector("[data-filter-heading]");
  const summary = root.querySelector("[data-filter-summary]");
  const search = root.querySelector("[data-facet-search]");
  const clear = root.querySelector("[data-facet-clear]");
  let payload = null;
  let selected = [];
  let focusId = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const readSelection = () => {
    const params = new URL(window.location.href).searchParams;
    return [...new Set(params.getAll(parameter).map((value) => value.trim()).filter(Boolean))];
  };

  const readFocus = () => new URL(window.location.href).searchParams.get("question");

  const filterHref = (values, questionId = null) => {
    const params = new URLSearchParams();
    values.forEach((value) => params.append(parameter, value));
    if (questionId) params.set("question", questionId);
    const query = params.toString();
    return `tags.html${query ? `?${query}` : ""}${questionId ? "#filter-results-heading" : ""}`;
  };

  const toggledSelection = (value) => {
    const values = new Set(selected);
    if (values.has(value)) values.delete(value);
    else values.add(value);
    return [...values];
  };

  const syncFacetLinks = () => {
    root.querySelectorAll("[data-facet-value]").forEach((link) => {
      const value = link.dataset.facetValue;
      const active = selected.includes(value);
      link.classList.toggle("is-selected", active);
      link.setAttribute("aria-pressed", String(active));
      link.href = filterHref(toggledSelection(value));
    });
    if (clear) {
      clear.hidden = selected.length === 0;
      clear.href = filterHref([]);
    }
  };

  const appendTags = (container, tags, questionId) => {
    tags.forEach((tag) => {
      const item = element("li");
      const link = element("a", "tag-link", tag);
      link.href = filterHref([tag], questionId);
      item.append(link);
      container.append(item);
    });
  };

  const renderQuestion = (question) => {
    const article = element("article", "question-card filtered-question-card");
    article.id = `filtered-q-${question.id}`;
    if (focusId === question.id) article.classList.add("is-origin-question");

    const meta = element("div", "question-meta");
    meta.append(element("span", "", `${question.field_label} · QUESTION ${String(question.field_number).padStart(3, "0")}`));
    const sourceLink = element("a", "", "通常ページで開く");
    sourceLink.href = question.source_href;
    meta.append(sourceLink);
    article.append(meta, element("h2", "", question.stem));

    const choices = element("ol", "choice-list");
    question.choices.forEach((choice) => {
      const item = element("li");
      item.append(element("span", "", choice.label), element("p", "", choice.text));
      choices.append(item);
    });
    article.append(choices);

    const details = element("details", "answer-panel");
    const detailsSummary = element("summary");
    detailsSummary.append(element("span", "", "正答と解説を確認"), element("span", "detail-icon"));
    detailsSummary.lastElementChild.setAttribute("aria-hidden", "true");

    const content = element("div", "answer-content");
    const correct = element("p", "correct-answer");
    correct.append(element("span", "", "正答"), element("strong", "", `${question.correct.label}. ${question.correct.text}`));

    const explanation = element("div", "explanation");
    explanation.append(element("h3", "", "解説"), element("p", "", question.explanation));

    const source = element("dl", "source-row");
    source.append(element("dt", "", "出典"), element("dd", "", question.source));

    const tagRow = element("div", "tag-row");
    tagRow.append(element("span", "", "タグ"));
    const tags = element("ul");
    appendTags(tags, question.tags, question.id);
    tagRow.append(tags);

    content.append(correct, explanation, source, tagRow);
    details.append(detailsSummary, content);
    article.append(details);
    return article;
  };

  const render = () => {
    syncFacetLinks();
    results.replaceChildren();
    if (!payload) return;

    if (selected.length === 0) {
      heading.textContent = "タグを選択してください";
      summary.textContent = `${payload.question_count}問からOR条件で抽出します。`;
      results.append(element("p", "filter-message", "上のタグ一覧から、学習したい用語や分野を選んでください。"));
      return;
    }

    const matches = payload.questions.filter((question) => question.tags.some((tag) => selected.includes(tag)));
    if (focusId) {
      const originIndex = matches.findIndex((question) => question.id === focusId);
      if (originIndex > 0) matches.unshift(...matches.splice(originIndex, 1));
    }
    heading.textContent = `「${selected.join("」「")}」の問題`;
    summary.textContent = `${selected.length}タグのOR検索で${matches.length}問が見つかりました。`;
    if (matches.length === 0) {
      results.append(element("p", "filter-message", "条件に合う問題はありません。タグを選び直してください。"));
      return;
    }
    const fragment = document.createDocumentFragment();
    matches.forEach((question) => fragment.append(renderQuestion(question)));
    results.append(fragment);
    syncFacetLinks();
    if (focusId && matches.some((question) => question.id === focusId)) {
      window.requestAnimationFrame(() => resultsSection.scrollIntoView({ block: "start" }));
    }
  };

  const setSelection = (values, push = true) => {
    selected = [...new Set(values)];
    focusId = null;
    if (push) window.history.pushState({}, "", filterHref(selected));
    render();
  };

  root.addEventListener("click", (event) => {
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

  window.addEventListener("popstate", () => {
    selected = readSelection();
    focusId = readFocus();
    render();
  });

  selected = readSelection();
  focusId = readFocus();
  syncFacetLinks();
  fetch(dataUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      payload = data;
      render();
    })
    .catch(() => {
      heading.textContent = "問題データを読み込めませんでした";
      summary.textContent = "時間をおいて再読み込みしてください。";
      results.replaceChildren(element("p", "filter-message", "通常の問題一覧は引き続き利用できます。"));
    });
})();
