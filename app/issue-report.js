const ISSUE_REPORT_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzO7AIFiuA2_zhxeE0IYHJNMb8g_GhQVkvrZxM7fHw2YwY4UTlsN0VdSBJlS9XCtjBu/exec";

const ISSUE_REPORT_REASONS = [
  "出題範囲外である",
  "問題・選択肢に誤りがある",
  "正解・解説に誤りがある",
  "内容がわかりにくい",
  "表示が崩れている",
];

const reportedQuestionIds = new Set();
const questionCatalogPromise = loadQuestionCatalog();
let activeReport = null;
let activeReportTrigger = null;
let selectedReason = "";
let isSending = false;
let currentQuestionSyncId = 0;

const dialog = createIssueReportDialog();
const toast = createIssueReportToast();
const statusReportButton = createStatusReportButton();
const summaryList = document.querySelector("#summaryList");

updateReportButtons();
observeCurrentQuestion();

if (summaryList) {
  const observer = new MutationObserver(updateReportButtons);
  observer.observe(summaryList, { childList: true, subtree: true });
}

document.addEventListener(
  "click",
  (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest(".scope-report-button");
    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (button.disabled || button.dataset.issueReported === "true") {
      return;
    }

    void openIssueReportDialog(button);
  },
  true,
);

function createStatusReportButton() {
  const progressLabel = document.querySelector(".progress-label");
  const setStatus = document.querySelector("#setStatus");
  if (!progressLabel || !setStatus) {
    return null;
  }

  const actions = document.createElement("span");
  actions.className = "progress-status-actions";
  progressLabel.insertBefore(actions, setStatus);
  actions.append(setStatus);

  const button = document.createElement("button");
  button.className = "scope-report-button status-report-button";
  button.type = "button";
  button.textContent = "不備報告";
  button.hidden = true;
  actions.append(button);

  return button;
}

function observeCurrentQuestion() {
  if (!statusReportButton) {
    return;
  }

  const statusBar = document.querySelector("#statusBar");
  const questionStem = document.querySelector("#questionStem");
  const choices = document.querySelector("#choices");
  const observer = new MutationObserver(syncCurrentQuestionButton);

  if (statusBar) {
    observer.observe(statusBar, { attributes: true, attributeFilter: ["hidden"] });
  }
  if (questionStem) {
    observer.observe(questionStem, { childList: true, characterData: true, subtree: true });
  }
  if (choices) {
    observer.observe(choices, { childList: true, subtree: true });
  }

  syncCurrentQuestionButton();
}

function syncCurrentQuestionButton() {
  if (!statusReportButton) {
    return;
  }

  const statusBar = document.querySelector("#statusBar");
  const stem = document.querySelector("#questionStem")?.textContent?.trim() || "";
  const shouldShow = Boolean(statusBar && !statusBar.hidden && stem);
  const syncId = ++currentQuestionSyncId;

  statusReportButton.hidden = !shouldShow;
  statusReportButton.dataset.id = "";
  statusReportButton.dataset.issueLoading = "false";
  statusReportButton.dataset.issueReported = "false";
  statusReportButton.disabled = false;
  statusReportButton.classList.remove("issue-reported");
  statusReportButton.textContent = "不備報告";

  if (!shouldShow) {
    return;
  }

  void resolveCurrentQuestionRecord().then((question) => {
    const currentStem = document.querySelector("#questionStem")?.textContent?.trim() || "";
    if (syncId !== currentQuestionSyncId || currentStem !== stem || !question?.id) {
      return;
    }
    statusReportButton.dataset.id = String(question.id);
    updateReportButtons();
  });
}

function createIssueReportDialog() {
  const element = document.createElement("dialog");
  element.className = "issue-report-dialog";
  element.setAttribute("aria-labelledby", "issueReportTitle");
  element.innerHTML = `
    <div class="issue-report-card">
      <div class="issue-report-head">
        <div>
          <p class="issue-report-eyebrow">不備報告</p>
          <h2 id="issueReportTitle">報告内容を選んでください</h2>
        </div>
        <button class="issue-report-close" type="button" aria-label="閉じる">×</button>
      </div>
      <p class="issue-report-note">理由を選択し、内容を確認してから「送信する」を押してください。</p>
      <div class="issue-report-reasons" role="group" aria-label="報告理由">
        ${ISSUE_REPORT_REASONS.map(
          (reason) =>
            `<button class="issue-report-reason" type="button" data-reason="${escapeAttribute(reason)}" aria-pressed="false">${escapeHtml(reason)}</button>`,
        ).join("")}
      </div>
      <p class="issue-report-selection" data-selected-reason>理由はまだ選択されていません。</p>
      <p class="issue-report-status" aria-live="polite"></p>
      <div class="issue-report-actions">
        <button class="issue-report-cancel" type="button">キャンセル</button>
        <button class="issue-report-submit" type="button" disabled>送信する</button>
      </div>
    </div>
  `;

  document.body.append(element);

  element.querySelector(".issue-report-close").addEventListener("click", closeIssueReportDialog);
  element.querySelector(".issue-report-cancel").addEventListener("click", closeIssueReportDialog);
  element.querySelector(".issue-report-submit").addEventListener("click", () => {
    void submitIssueReport();
  });

  for (const button of element.querySelectorAll(".issue-report-reason")) {
    button.addEventListener("click", () => {
      selectIssueReportReason(button.dataset.reason);
    });
  }

  element.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (isSending) {
      return;
    }
    closeIssueReportDialog();
  });

  element.addEventListener("click", (event) => {
    if (event.target === element && !isSending) {
      closeIssueReportDialog();
    }
  });
  element.addEventListener("keydown", trapDialogFocus);

  return element;
}

function createIssueReportToast() {
  const element = document.createElement("p");
  element.className = "issue-report-toast";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.hidden = true;
  document.body.append(element);
  return element;
}

function updateReportButtons() {
  for (const button of document.querySelectorAll(".scope-report-button")) {
    const questionId = String(button.dataset.id || "");
    const isReported = Boolean(questionId && reportedQuestionIds.has(questionId));
    const isLoading = button.dataset.issueLoading === "true";
    const label = isReported ? "報告済み" : "不備報告";

    if (button.textContent !== label) {
      button.textContent = label;
    }
    button.dataset.issueReported = String(isReported);
    button.disabled = isLoading;
    button.setAttribute("aria-disabled", String(isReported || isLoading));
    button.classList.toggle("issue-reported", isReported);
  }
}

async function openIssueReportDialog(button) {
  activeReportTrigger = button;
  button.dataset.issueLoading = "true";
  updateReportButtons();

  try {
    activeReport = await buildReportData(button);
    button.dataset.id = activeReport.questionId;

    if (reportedQuestionIds.has(activeReport.questionId)) {
      activeReport = null;
      showToast("この問題は報告済みです。");
      restoreReportButtonFocus();
      return;
    }

    resetIssueReportForm();
    setDialogSendingState(false);
    dialog.querySelector(".issue-report-status").textContent = "";

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute("open", "");
    }

    dialog.querySelector(".issue-report-reason")?.focus();
  } catch (error) {
    console.error("報告対象の問題を取得できませんでした。", error);
    showToast("報告対象の問題を取得できませんでした。");
    activeReport = null;
    restoreReportButtonFocus();
  } finally {
    button.dataset.issueLoading = "false";
    updateReportButtons();
  }
}

function closeIssueReportDialog() {
  if (isSending) {
    return;
  }

  activeReport = null;
  resetIssueReportForm();
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
  restoreReportButtonFocus();
}

function selectIssueReportReason(reason) {
  if (isSending || !ISSUE_REPORT_REASONS.includes(reason)) {
    return;
  }

  selectedReason = reason;
  for (const button of dialog.querySelectorAll(".issue-report-reason")) {
    const selected = button.dataset.reason === reason;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("is-selected", selected);
  }
  dialog.querySelector("[data-selected-reason]").textContent = `選択中：${reason}`;
  dialog.querySelector(".issue-report-status").textContent = "";
  dialog.querySelector(".issue-report-submit").disabled = false;
}

function resetIssueReportForm() {
  selectedReason = "";
  for (const button of dialog.querySelectorAll(".issue-report-reason")) {
    button.setAttribute("aria-pressed", "false");
    button.classList.remove("is-selected");
  }
  dialog.querySelector("[data-selected-reason]").textContent = "理由はまだ選択されていません。";
  dialog.querySelector(".issue-report-submit").disabled = true;
}

async function submitIssueReport() {
  if (!activeReport || isSending || !ISSUE_REPORT_REASONS.includes(selectedReason)) {
    return;
  }

  const report = { ...activeReport, reason: selectedReason };
  isSending = true;
  setDialogSendingState(true);
  dialog.querySelector(".issue-report-status").textContent = "送信しています…";
  let sent = false;

  try {
    await fetch(ISSUE_REPORT_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: JSON.stringify(report),
      keepalive: true,
      referrerPolicy: "no-referrer",
    });

    reportedQuestionIds.add(report.questionId);
    updateReportButtons();
    sent = true;
  } catch (error) {
    console.error("不備報告を送信できませんでした。", error);
    dialog.querySelector(".issue-report-status").textContent =
      "送信できませんでした。通信状況を確認して、もう一度お試しください。";
  } finally {
    isSending = false;
    setDialogSendingState(false);
    if (sent) {
      closeIssueReportDialog();
      showToast("報告を送信しました。ありがとうございます。");
    }
  }
}

function setDialogSendingState(sending) {
  for (const button of dialog.querySelectorAll("button")) {
    button.disabled = sending;
  }
  if (!sending) {
    dialog.querySelector(".issue-report-submit").disabled = !selectedReason;
  }
  dialog.classList.toggle("is-sending", sending);
}

function trapDialogFocus(event) {
  if (event.key !== "Tab" || !dialog.open) {
    return;
  }

  const focusable = Array.from(dialog.querySelectorAll("button:not([disabled])")).filter(
    (button) => !button.hidden,
  );
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function restoreReportButtonFocus() {
  const trigger = activeReportTrigger;
  activeReportTrigger = null;
  if (!trigger?.isConnected) {
    return;
  }
  window.requestAnimationFrame(() => trigger.focus());
}

async function buildReportData(button) {
  const item = button.closest(".summary-item");
  if (item) {
    return buildSummaryReportData(button, item);
  }
  if (button.classList.contains("status-report-button")) {
    return buildCurrentQuestionReportData(button);
  }
  throw new Error("報告対象の問題を取得できませんでした。");
}

function buildSummaryReportData(button, item) {
  const questionId = String(button.dataset.id || "").trim();
  const stem = item.querySelector(".summary-stem")?.textContent?.trim() || "";
  const explanation =
    item.querySelector(".summary-result-panel .explanation")?.textContent?.trim() || "";
  const choices = Array.from(item.querySelectorAll(".choice-stat"))
    .map(formatSummaryChoiceForReport)
    .filter(Boolean)
    .join("\n");

  if (!questionId || !stem) {
    throw new Error("報告に必要な問題情報を取得できませんでした。");
  }

  return {
    questionId,
    reason: "",
    stem,
    choices,
    explanation,
  };
}

async function buildCurrentQuestionReportData(button) {
  const stem = document.querySelector("#questionStem")?.textContent?.trim() || "";
  const question = await resolveCurrentQuestionRecord();
  const questionId = String(question?.id || button.dataset.id || "").trim();
  const correctChoiceId = getCorrectChoiceId(question);
  const choices = Array.from(document.querySelectorAll("#choices .choice-button"))
    .map((choiceButton) => formatCurrentChoiceForReport(choiceButton, correctChoiceId))
    .filter(Boolean)
    .join("\n");
  const displayedExplanation =
    document.querySelector("#resultPanel:not([hidden]) #explanation")?.textContent?.trim() || "";
  const explanation = displayedExplanation || normalizeText(question?.explanation);

  if (!questionId || !stem) {
    throw new Error("報告に必要な問題情報を取得できませんでした。");
  }

  button.dataset.id = questionId;
  return {
    questionId,
    reason: "",
    stem,
    choices,
    explanation,
  };
}

function formatSummaryChoiceForReport(row) {
  const label = row.querySelector(".choice-stat-label")?.textContent?.trim() || "";
  const textElement = row.querySelector(".choice-stat-text");
  if (!textElement) {
    return "";
  }

  const textClone = textElement.cloneNode(true);
  textClone.querySelector(".choice-review-marker")?.remove();
  const text = textClone.textContent?.trim() || "";
  const correctMarker = row.classList.contains("correct") ? "（正解）" : "";

  return `${label}. ${text}${correctMarker}`.trim();
}

function formatCurrentChoiceForReport(button, correctChoiceId) {
  const label = button.querySelector(".choice-label")?.textContent?.trim() || "";
  const text = button.querySelector(".choice-text")?.textContent?.trim() || "";
  const choiceId = String(button.dataset.choiceId || "");
  const correctMarker = correctChoiceId && choiceId === correctChoiceId ? "（正解）" : "";
  return `${label}. ${text}${correctMarker}`.trim();
}

async function resolveCurrentQuestionRecord() {
  const stem = document.querySelector("#questionStem")?.textContent?.trim() || "";
  if (!stem) {
    return null;
  }

  const catalog = await questionCatalogPromise;
  const candidates = catalog.filter(
    (question) => normalizeComparableText(question?.stem) === normalizeComparableText(stem),
  );
  if (candidates.length <= 1) {
    return candidates[0] || null;
  }

  const currentSignature = getCurrentChoiceSignature();
  return (
    candidates.find((question) => getCatalogChoiceSignature(question) === currentSignature) || candidates[0]
  );
}

async function loadQuestionCatalog() {
  try {
    const response = await fetch("../data/questions/completed_questions.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("不備報告用の問題データを読み込めませんでした。", error);
    return [];
  }
}

function getCurrentChoiceSignature() {
  return Array.from(document.querySelectorAll("#choices .choice-text"))
    .map((element) => normalizeComparableText(element.textContent))
    .sort()
    .join("\u241f");
}

function getCatalogChoiceSignature(question) {
  return (Array.isArray(question?.choices) ? question.choices : [])
    .map((choice) => normalizeComparableText(choice?.text))
    .sort()
    .join("\u241f");
}

function getCorrectChoiceId(question) {
  if (!question) {
    return "";
  }
  if (question.answer_choice_id) {
    return String(question.answer_choice_id);
  }

  const correctChoice = (Array.isArray(question.choices) ? question.choices : []).find(
    (choice) => choice?.is_correct || String(choice?.label) === String(question.correct_choice),
  );
  if (!correctChoice) {
    return "";
  }
  return String(correctChoice.choice_id || `${question.id}__choice_${correctChoice.label}`);
}

function normalizeComparableText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

let toastTimer = null;

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("is-visible"));

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, 4000);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
