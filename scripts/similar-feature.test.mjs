import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
const helperSource = readFileSync(
  new URL("../app/similar-questions.js", import.meta.url),
  "utf8",
);
const htmlSource = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/styles.css", import.meta.url), "utf8");

function extractFunction(name, nextName) {
  const pattern = new RegExp(
    `function ${name}\\([\\s\\S]*?(?=\\n(?:async )?function ${nextName}\\()`,
  );
  const match = appSource.match(pattern);
  assert.ok(match, `${name} should exist`);
  return match[0];
}

test("similar data loading begins after the first question is rendered", () => {
  const beginSession = extractFunction("beginSession", "renderFieldFilters");
  assert.ok(beginSession.indexOf("renderQuestion();") >= 0);
  assert.ok(
    beginSession.indexOf("scheduleSimilarQuestionsBackgroundLoad();")
      > beginSession.indexOf("renderQuestion();"),
  );

  const recordDetail = extractFunction("startRecordListQuestion", "finishRecordPractice");
  assert.ok(
    recordDetail.indexOf("scheduleSimilarQuestionsBackgroundLoad();")
      > recordDetail.indexOf("renderQuestion();"),
  );
  assert.match(appSource, /renderSummary\(\);\s*\n\s*scrollToTop\(\);\s*\n\s*scheduleSimilarQuestionsBackgroundLoad\(\);/);
});

test("the loader shares cached data and the in-flight Promise and clears failures", () => {
  assert.match(helperSource, /let cachedData = null;/);
  assert.match(helperSource, /let pendingRequest = null;/);
  assert.match(helperSource, /if \(cachedData\)/);
  assert.match(helperSource, /if \(pendingRequest\)/);
  assert.match(helperSource, /\.catch\(\(error\) => \{\s*pendingRequest = null;/);
});

test("result cards render the required two-by-two action order", () => {
  assert.match(
    appSource,
    /<div class="summary-action-grid">\s*\$\{renderChatGPTExplanationAction\(\)\}\s*\$\{renderQuestionCheckButton\(question\.id\)\}\s*\$\{renderSummarySimilarAction\(question\.id\)\}\s*\$\{renderOutOfScopeReportAction\(question\)\}/,
  );
  assert.match(cssSource, /\.summary-action-grid \[data-summary-chatgpt\][\s\S]*?grid-column: 1;[\s\S]*?grid-row: 1;/);
  assert.match(cssSource, /\.summary-action-grid \.check-question-button[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1;/);
  assert.match(cssSource, /\.summary-action-grid \[data-summary-similar\][\s\S]*?grid-column: 1;[\s\S]*?grid-row: 2;/);
  assert.match(cssSource, /\.summary-action-grid \.scope-report-action[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 2;/);
});

test("the detail similar button follows ChatGPT and starts hidden", () => {
  assert.match(
    htmlSource,
    /id="chatgptQuestionButton"[\s\S]*?id="similarQuestionButton"[^>]*hidden[^>]*>類題5問に挑戦<\/button>/,
  );
  assert.match(htmlSource, /class="[^"]*similar-action-button[^"]*"[^>]*id="similarQuestionButton"/);
  assert.match(appSource, /similarQuestionButton\.hidden = !state\.recordReviewMode;/);
  const answeredRenderer = extractFunction("renderAnsweredQuestion", "showSummary");
  assert.match(answeredRenderer, /similarQuestionButton\.hidden = !state\.recordPracticeMode;/);
});

test("all similar buttons share the pale-green action class", () => {
  assert.match(appSource, /summary-similar-button similar-action-button/);
  assert.match(cssSource, /\.similar-action-button[\s\S]*?background: var\(--right-soft\)/);
  assert.match(cssSource, /\.similar-action-button:disabled[\s\S]*?background: #eef7ef/);
});

test("load failure, missing settings, and retry labels are distinct", () => {
  assert.match(
    appSource,
    /similar_questions_compact\.json の読み込みに失敗しました/,
  );
  assert.match(
    appSource,
    /類題データを読み込めませんでした。\\n通信状況を確認して、もう一度お試しください。/,
  );
  assert.match(appSource, /showSimilarMessage\("類題が設定されていません"\)/);
  assert.match(appSource, /const SIMILAR_LOADING_LABEL = "読み込み中…";/);
  assert.match(appSource, /button\.disabled = true;/);
  assert.match(appSource, /state\.similarChallengeStarting/);
});

test("similar sessions reuse the existing question-ID and quiz engine", () => {
  assert.match(appSource, /const selectedQuestions = resolveChallengeQuestions\(selectedQuestionIds\);/);
  assert.match(
    appSource,
    /beginSession\(selectedQuestions, \{ sessionMode: SIMILAR_SESSION_MODE \}\)/,
  );
  assert.match(appSource, /learningRecord\.recordAnswer\(question\.id, isCorrect\);/);
  assert.doesNotMatch(helperSource, /recordAnswer|grade\(|renderQuestion\(/);
});

test("incorrect-answer restoration preserves choice order without recording again", () => {
  const restoreDetail = extractFunction(
    "restoreRecordDetailFromSimilar",
    "restoreSimilarScrollPosition",
  );
  assert.match(restoreDetail, /preferredChoiceOrder: detail\.choiceIds/);
  assert.match(restoreDetail, /renderAnsweredQuestion\(currentQuestion\(\), response\);/);
  assert.doesNotMatch(restoreDetail, /learningRecord\.recordAnswer|grade\(/);
});

test("similar completion exposes matching upper and lower return and finish actions", () => {
  const visibility = extractFunction("updateSummaryActionVisibility", "renderSummary");
  assert.match(visibility, /summaryMiddleActions\.hidden = false/);
  assert.match(visibility, /"元のページに戻る"/);
  assert.match(visibility, /summaryMiddleRetryButton\.hidden = isChallengeSession/);
  assert.match(visibility, /summaryMiddleFinishButton\.hidden = false/);
  assert.match(visibility, /summaryMiddleRetryButton\.textContent = retryLabel/);
  assert.match(appSource, /if \(state\.sessionMode === "similar"\)[\s\S]*?returnToSimilarSource\(\{ fromSummary: true \}\)/);
  assert.match(appSource, /summaryMiddleRetryButton\.addEventListener\("click", \(\) => retryButton\.click\(\)\)/);
  assert.match(appSource, /summaryMiddleFinishButton\.addEventListener\("click", \(\) => finishButton\.click\(\)\)/);
  const htmlIds = Array.from(htmlSource.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
  assert.equal(new Set(htmlIds).size, htmlIds.length, "HTML ids must remain unique");
});

test("return context uses the required key, sources, lifetime, and view snapshots", () => {
  assert.match(helperSource, /info1SimilarChallengeReturn:v1/);
  for (const sourceType of [
    "result-list",
    "saved-question-detail",
    "history-question-detail",
    "incorrect-question-answer",
  ]) {
    assert.match(helperSource, new RegExp(sourceType));
  }
  assert.match(helperSource, /24 \* 60 \* 60 \* 1000/);
  assert.match(appSource, /captureSerializableSessionState\(\)/);
  assert.match(appSource, /selectedChoiceId: response\?\.selectedChoiceId/);
  assert.match(appSource, /restoreSessionSnapshot\(returnContext\.viewState\?\.session\)/);
  assert.match(appSource, /clearSimilarReturnContext\(\)/);
});

test("mobile result actions remain constrained to the card width", () => {
  assert.match(
    cssSource,
    /@media[\s\S]*?\.summary-item-head \{[\s\S]*?display: flex;[\s\S]*?flex-wrap: wrap;/,
  );
  assert.match(cssSource, /@media[\s\S]*?\.summary-action-grid \{[\s\S]*?grid-template-columns: max-content max-content;[\s\S]*?width: max-content;[\s\S]*?max-width: 100%;/);
  assert.match(cssSource, /\.summary-action-grid \.summary-chatgpt-link \{[\s\S]*?width: 100%;[\s\S]*?box-sizing: border-box;/);
});
