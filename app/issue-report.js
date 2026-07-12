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
let activeReport = null;
let isSending = false;

const dialog = createIssueReportDialog();
const toast = createIssueReportToast();
const summaryList = document.querySelector("#summaryList");

updateReportButtons();

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

    try {
      openIssueReportDialog(button);
    } catch (error) {
      console.error("報告対象の問題を取得できませんでした。", error);
      showToast("報告対象の問題を取得できませんでした。");
    }
  },
  true,
);

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
      <p class="issue-report-note">選択した内容はすぐに送信されます。</p>
      <div class="issue-report-reasons">
        ${ISSUE_REPORT_REASONS.map(
          (reason) =>
            `<button class="issue-report-reason" type="button" data-reason="${escapeAttribute(reason)}">${escapeHtml(reason)}</button>`,
        ).join("")}
      </div>
      <p class="issue-report-status" aria-live="polite"></p>
      <button class="issue-report-cancel" type="button">キャンセル</button>
    </div>
  `;

  document.body.append(element);

  element.querySelector(".issue-report-close").addEventListener("click", closeIssueReportDialog);
  element.querySelector(".issue-report-cancel").addEventListener("click", closeIssueReportDialog);

  for (const button of element.querySelectorAll(".issue-report-reason")) {
    button.addEventListener("click", () => {
      void submitIssueReport(button.dataset.reason);
    });
  }

  element.addEventListener("cancel", (event) => {
    if (isSending) {
      event.preventDefault();
      return;
    }
    activeReport = null;
  });

  element.addEventListener("click", (event) => {
    if (event.target === element && !isSending) {
      closeIssueReportDialog();
    }
  });

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
    const isReported = reportedQuestionIds.has(questionId);

    const label = isReported ? "報告済み" : "不備を報告";
    if (button.textContent !== label) {
      button.textContent = label;
    }
    button.dataset.issueReported = String(isReported);
    button.disabled = isReported;
    button.classList.toggle("issue-reported", isReported);
  }
}

function openIssueReportDialog(button) {
  activeReport = buildReportData(button);
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
}

function closeIssueReportDialog() {
  if (isSending) {
    return;
  }

  activeReport = null;
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

async function submitIssueReport(reason) {
  if (!activeReport || isSending || !ISSUE_REPORT_REASONS.includes(reason)) {
    return;
  }

  const report = { ...activeReport, reason };
  isSending = true;
  setDialogSendingState(true);
  dialog.querySelector(".issue-report-status").textContent = "送信しています…";

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
    activeReport = null;
    updateReportButtons();

    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }

    showToast("報告を送信しました。ありがとうございます。");
  } catch (error) {
    console.error("不備報告を送信できませんでした。", error);
    dialog.querySelector(".issue-report-status").textContent =
      "送信できませんでした。通信状況を確認して、もう一度お試しください。";
  } finally {
    isSending = false;
    setDialogSendingState(false);
  }
}

function setDialogSendingState(sending) {
  for (const button of dialog.querySelectorAll("button")) {
    button.disabled = sending;
  }
  dialog.classList.toggle("is-sending", sending);
}

function buildReportData(button) {
  const item = button.closest(".summary-item");
  if (!item) {
    throw new Error("報告対象の問題を取得できませんでした。");
  }

  const questionId = String(button.dataset.id || "").trim();
  const stem = item.querySelector(".summary-stem")?.textContent?.trim() || "";
  const explanation =
    item.querySelector(".summary-result-panel .explanation")?.textContent?.trim() || "";
  const choices = Array.from(item.querySelectorAll(".choice-stat"))
    .map(formatChoiceForReport)
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

function formatChoiceForReport(row) {
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
