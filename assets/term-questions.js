(() => {
  "use strict";

  const QUESTION_DATA_URL = new URL(
    "../data/questions/completed_questions.json",
    new URL("../", window.location.href)
  ).href;

  const FIELD_LABELS = Object.freeze({
    society_security: "社会・セキュリティ",
    digital: "デジタル表現",
    network: "ネットワーク",
    data_db: "データ活用・DB",
    algorithm: "アルゴリズム",
    design: "情報デザイン",
  });

  let questionPromise = null;

  function loadQuestions() {
    if (questionPromise) {
      return questionPromise;
    }
    questionPromise = fetch(QUESTION_DATA_URL, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((questions) => {
        if (!Array.isArray(questions)) {
          throw new TypeError("問題データの形式が正しくありません。");
        }
        return questions;
      })
      .catch((error) => {
        questionPromise = null;
        throw error;
      });
    return questionPromise;
  }

  function createElement(tagName, className = "", text = "") {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== "") {
      element.textContent = text;
    }
    return element;
  }

  function shuffle(values) {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function answerChoice(question) {
    const answerId = String(question.answer_choice_id ?? "");
    return Array.isArray(question.choices)
      ? question.choices.find((choice) => String(choice?.choice_id ?? "") === answerId) ?? null
      : null;
  }

  function sourceLabel(question) {
    let source = String(question.source_display ?? "").trim() || "独自作成";
    if (question["改題"] === true && !source.includes("改題")) {
      source += "（改題）";
    }
    return source;
  }

  function fieldLabel(question) {
    const fieldId = Array.isArray(question.field_ids) ? question.field_ids[0] : "";
    return FIELD_LABELS[fieldId] ?? "情報Ⅰ";
  }

  function renderQuestion(question, index) {
    const correct = answerChoice(question);
    if (!correct) {
      return null;
    }

    const article = createElement("article", "question-card");

    const meta = createElement("div", "question-meta");
    meta.append(createElement("span", "", `${fieldLabel(question)} · RELATED ${String(index + 1).padStart(2, "0")}`));
    if (question.id) {
      const idLink = createElement("a", "", `#${question.id}`);
      const questionUrl = new URL("../questions/", new URL("../", window.location.href));
      questionUrl.hash = `question=${encodeURIComponent(String(question.id))}`;
      idLink.href = questionUrl.href;
      idLink.setAttribute("aria-label", "問題検索ページでこの問題を開く");
      meta.append(idLink);
    }
    article.append(meta);

    article.append(createElement("h3", "", String(question.stem ?? "")));

    const choices = createElement("ol", "choice-list");
    for (const choice of question.choices ?? []) {
      const item = createElement("li");
      item.append(createElement("span", "", String(choice.label ?? "")));
      item.append(createElement("p", "", String(choice.text ?? "")));
      choices.append(item);
    }
    article.append(choices);

    const details = createElement("details", "answer-panel");
    const summary = createElement("summary");
    summary.append(createElement("span", "", "正答と解説を確認"));
    const icon = createElement("span", "detail-icon");
    icon.setAttribute("aria-hidden", "true");
    summary.append(icon);
    details.append(summary);

    const answerContent = createElement("div", "answer-content");
    const correctRow = createElement("p", "correct-answer");
    correctRow.append(createElement("span", "", "正答"));
    correctRow.append(createElement("strong", "", `${correct.label ?? ""}. ${correct.text ?? ""}`));
    answerContent.append(correctRow);

    const explanation = createElement("div", "explanation");
    explanation.append(createElement("h3", "", "解説"));
    explanation.append(createElement("p", "", String(question.explanation ?? "")));
    answerContent.append(explanation);

    const source = createElement("dl", "term-question-source");
    source.append(createElement("dt", "", "出典"));
    source.append(createElement("dd", "", sourceLabel(question)));
    answerContent.append(source);

    details.append(answerContent);
    article.append(details);
    return article;
  }

  function setChallengeLink(link, selected) {
    if (!link || !selected.length) {
      if (link) {
        link.hidden = true;
      }
      return;
    }
    const ids = selected.map((question) => String(question.id ?? "").trim()).filter(Boolean);
    if (!ids.length) {
      link.hidden = true;
      return;
    }
    const appUrl = new URL("../app/", new URL("../", window.location.href));
    appUrl.searchParams.set("challenge", ids.join(","));
    link.href = appUrl.href;
    link.textContent = `${ids.length}問をアプリで解く`;
    link.hidden = false;
  }

  function initializeSection(section, questions) {
    const tag = String(section.dataset.tag ?? "").trim();
    const excludeStem = String(section.dataset.excludeStem ?? "").trim();
    const requestedLimit = Number.parseInt(section.dataset.limit ?? "5", 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 5;
    const list = section.querySelector("[data-term-list]");
    const status = section.querySelector("[data-term-status]");
    const refresh = section.querySelector("[data-term-refresh]");
    const challenge = section.querySelector("[data-term-challenge]");

    if (!tag || !list) {
      return;
    }

    const candidates = questions.filter((question) => {
      const tags = Array.isArray(question.tags) ? question.tags.map((value) => String(value).trim()) : [];
      if (!tags.includes(tag)) {
        return false;
      }
      if (excludeStem && String(question.stem ?? "").trim() === excludeStem) {
        return false;
      }
      return true;
    });

    function renderSelection() {
      list.replaceChildren();
      const selected = shuffle(candidates).slice(0, Math.min(limit, candidates.length));

      if (!selected.length) {
        const message = createElement("p", "term-related-message", "この用語に関連する問題はまだありません。");
        list.append(message);
        if (status) {
          status.textContent = "関連問題 0問";
        }
        if (refresh) {
          refresh.hidden = true;
        }
        setChallengeLink(challenge, []);
        return;
      }

      for (const [index, question] of selected.entries()) {
        const card = renderQuestion(question, index);
        if (card) {
          list.append(card);
        }
      }

      if (status) {
        const suffix = candidates.length <= limit ? "すべて表示" : "ランダム表示";
        status.textContent = `${selected.length}問を${suffix}（${tag}タグの関連問題 ${candidates.length}問）`;
      }
      if (refresh) {
        refresh.hidden = candidates.length <= limit;
      }
      setChallengeLink(challenge, selected);
    }

    refresh?.addEventListener("click", renderSelection);
    renderSelection();
  }

  function showLoadError(section) {
    const list = section.querySelector("[data-term-list]");
    const status = section.querySelector("[data-term-status]");
    const refresh = section.querySelector("[data-term-refresh]");
    const challenge = section.querySelector("[data-term-challenge]");
    const tag = String(section.dataset.tag ?? "").trim();

    if (status) {
      status.textContent = "関連問題を読み込めませんでした";
    }
    if (refresh) {
      refresh.hidden = true;
    }
    if (challenge) {
      challenge.hidden = true;
    }
    if (!list) {
      return;
    }

    list.replaceChildren();
    const message = createElement("p", "term-related-message");
    message.append("関連問題を読み込めませんでした。 ");
    const link = createElement("a", "", "問題検索ページで確認する");
    const searchUrl = new URL("../questions/", new URL("../", window.location.href));
    if (tag) {
      searchUrl.hash = `tag=${encodeURIComponent(tag)}`;
    }
    link.href = searchUrl.href;
    message.append(link);
    list.append(message);
  }

  const sections = [...document.querySelectorAll("[data-term-questions]")];
  if (!sections.length) {
    return;
  }

  loadQuestions()
    .then((questions) => {
      for (const section of sections) {
        initializeSection(section, questions);
      }
    })
    .catch((error) => {
      console.error("用語ページの関連問題を読み込めませんでした。", error);
      for (const section of sections) {
        showLoadError(section);
      }
    });
})();