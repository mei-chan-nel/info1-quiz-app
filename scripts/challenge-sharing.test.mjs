import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
const appHtml = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
const PUBLIC_APP_URL = "https://mei-chan-nel.com/info1-quiz-app/app/";
const X_POST_INTENT_URL = "https://x.com/intent/tweet";
const MAX_SHARED_QUESTIONS = 10;

function extractFunction(name, nextName) {
  const pattern = new RegExp(
    `(?:async )?function ${name}\\([\\s\\S]*?(?=\\r?\\n(?:async )?function ${nextName}\\()`,
  );
  const match = appSource.match(pattern);
  assert.ok(match, `${name} should exist`);
  return match[0].trim();
}

test("challenge parser preserves order and duplicates while trimming and limiting input", () => {
  const functionSource = extractFunction(
    "parseChallengeQuestionIds",
    "resolveChallengeQuestions",
  );
  const parseChallengeQuestionIds = new Function(
    "MAX_SHARED_QUESTIONS",
    `${functionSource}; return parseChallengeQuestionIds;`,
  )(MAX_SHARED_QUESTIONS);

  assert.deepEqual(
    parseChallengeQuestionIds(" A, ,B,A, C ,D,E,F,G,H,I,J,K "),
    ["A", "B", "A", "C", "D", "E", "F", "G", "H", "I"],
  );
  assert.deepEqual(parseChallengeQuestionIds("single"), ["single"]);
  assert.deepEqual(parseChallengeQuestionIds(" , , "), []);
  assert.deepEqual(parseChallengeQuestionIds(null), []);
});

test("challenge resolution preserves requested order and duplicates and drops unknown IDs", () => {
  const functionSource = extractFunction(
    "resolveChallengeQuestions",
    "startChallengeSession",
  );
  const state = {
    allQuestions: [
      { id: "A", stem: "Question A" },
      { id: 2, stem: "Question 2" },
    ],
  };
  const resolveChallengeQuestions = new Function(
    "state",
    `${functionSource}; return resolveChallengeQuestions;`,
  )(state);

  assert.deepEqual(
    resolveChallengeQuestions(["A", "missing", "2", "A"]).map((question) => String(question.id)),
    ["A", "2", "A"],
  );
});

test("cumulative score and shared question IDs use the same answered entries only once", () => {
  const functionSource = extractFunction(
    "recordCumulativeResults",
    "updateSummaryActionVisibility",
  );
  const state = {
    sessionQuestions: [{ id: "A" }, { id: "B" }, { id: "A" }, { id: "missing-response" }],
    responses: [
      { selectedChoiceId: "0", isCorrect: true },
      { selectedChoiceId: null, isCorrect: null },
      { selectedChoiceId: "2", isCorrect: false },
    ],
    cumulativeTotal: 4,
    cumulativeCorrect: 3,
    cumulativeQuestionIds: ["W", "X", "Y", "Z"],
    sessionSummaryRecorded: false,
  };
  const recordCumulativeResults = new Function(
    "state",
    `${functionSource}; return recordCumulativeResults;`,
  )(state);

  recordCumulativeResults();
  assert.equal(state.cumulativeTotal, 6);
  assert.equal(state.cumulativeCorrect, 4);
  assert.deepEqual(state.cumulativeQuestionIds, ["W", "X", "Y", "Z", "A", "A"]);

  recordCumulativeResults();
  assert.equal(state.cumulativeTotal, 6);
  assert.equal(state.cumulativeCorrect, 4);
  assert.deepEqual(state.cumulativeQuestionIds, ["W", "X", "Y", "Z", "A", "A"]);
});

function createShareHelpers(state) {
  const getSharedQuestionIdsSource = extractFunction(
    "getSharedQuestionIds",
    "buildChallengeUrl",
  );
  const buildChallengeUrlSource = extractFunction(
    "buildChallengeUrl",
    "buildXShareUrl",
  );
  const buildXShareUrlSource = extractFunction(
    "buildXShareUrl",
    "shareResultsToX",
  );
  return new Function(
    "state",
    "MAX_SHARED_QUESTIONS",
    "PUBLIC_APP_URL",
    "X_POST_INTENT_URL",
    `${getSharedQuestionIdsSource}
${buildChallengeUrlSource}
${buildXShareUrlSource}
return { getSharedQuestionIds, buildChallengeUrl, buildXShareUrl };`,
  )(
    state,
    MAX_SHARED_QUESTIONS,
    PUBLIC_APP_URL,
    X_POST_INTENT_URL,
  );
}

function getPostText(intentUrl) {
  return new URL(intentUrl).searchParams.get("text");
}

function getChallengeUrlFromPost(postText) {
  const urlLine = postText
    .split("\n")
    .find((line) => line.startsWith(PUBLIC_APP_URL));
  assert.ok(urlLine, "post should contain the public app URL");
  return new URL(urlLine);
}

test("X post shares every answered question when cumulative total is ten or less", () => {
  const state = {
    cumulativeQuestionIds: ["A", "B", "A"],
  };
  const { getSharedQuestionIds, buildXShareUrl } = createShareHelpers(state);

  assert.deepEqual(getSharedQuestionIds(), ["A", "B", "A"]);
  const postText = getPostText(buildXShareUrl(3, 2, 67));
  assert.match(postText, /今回の結果：3問中2問正解/);
  assert.match(postText, /正答率：67％/);
  assert.match(postText, /\n同じ問題に挑戦しませんか？\n/);
  assert.equal(
    getChallengeUrlFromPost(postText).searchParams.get("challenge"),
    "A,B,A",
  );
});

test("X post shares only the last ten question IDs after eleven or more answers", () => {
  const state = {
    cumulativeQuestionIds: [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "A",
      "G",
      "H",
      "I",
      "J",
      "K",
    ],
  };
  const { getSharedQuestionIds, buildXShareUrl } = createShareHelpers(state);

  assert.deepEqual(
    getSharedQuestionIds(),
    ["C", "D", "E", "F", "A", "G", "H", "I", "J", "K"],
  );
  const postText = getPostText(buildXShareUrl(12, 10, 83));
  assert.match(postText, /今回の結果：12問中10問正解/);
  assert.match(postText, /\n同じ問題（10問）に挑戦しませんか？\n/);
  assert.equal(
    getChallengeUrlFromPost(postText).searchParams.get("challenge"),
    "C,D,E,F,A,G,H,I,J,K",
  );
});

test("challenge startup waits for question data", () => {
  const initSource = extractFunction("init", "loadQuestionData");
  const loadSource = extractFunction("loadQuestionData", "parseChallengeQuestionIds");

  assert.ok(
    initSource.indexOf("parseChallengeQuestionIds") < initSource.indexOf("loadQuestionData"),
    "challenge parameters should be parsed before loading starts",
  );
  assert.ok(
    loadSource.indexOf("state.allQuestions = await response.json()")
      < loadSource.indexOf("startChallengeSession"),
    "challenge questions should be resolved only after question data is loaded",
  );
  assert.match(appSource, /state\.sessionMode === "challenge"/);
  assert.match(appSource, /startChallengeSession\(challengeQuestionIds\)/);
});

test("finishing a challenge clears the shared URL and keeps standard URLs unchanged", () => {
  const functionSource = extractFunction("resetChallengeUrl", "buildXShareUrl");
  const replacedUrls = [];
  const windowStub = {
    location: { href: "https://mei-chan-nel.com/info1-quiz-app/app/?challenge=A,B#summary" },
    history: {
      replaceState(_state, _title, url) {
        replacedUrls.push(url);
      },
    },
  };
  const resetChallengeUrl = new Function(
    "window",
    `${functionSource}; return resetChallengeUrl;`,
  )(windowStub);

  resetChallengeUrl();
  assert.deepEqual(replacedUrls, ["/info1-quiz-app/app/#summary"]);

  windowStub.location.href = "https://mei-chan-nel.com/info1-quiz-app/app/";
  resetChallengeUrl();
  assert.deepEqual(replacedUrls, ["/info1-quiz-app/app/#summary"]);

  const finishHandler = appSource.match(
    /finishButton\.addEventListener\("click", async \(\) => \{[\s\S]*?\r?\n\}\);/,
  );
  assert.ok(finishHandler, "finish click handler should exist");
  assert.match(finishHandler[0], /state\.sessionMode === "challenge"/);
  assert.match(finishHandler[0], /resetChallengeUrl\(\)/);
});

test("summary retry visibility follows the current mode on every render", () => {
  const functionSource = extractFunction(
    "updateSummaryActionVisibility",
    "renderSummary",
  );
  const state = { sessionMode: "standard" };
  const retryButton = { hidden: true };
  const updateSummaryActionVisibility = new Function(
    "state",
    "retryButton",
    `${functionSource}; return updateSummaryActionVisibility;`,
  )(state, retryButton);

  updateSummaryActionVisibility();
  assert.equal(retryButton.hidden, false, "standard mode should show retry");

  state.sessionMode = "challenge";
  updateSummaryActionVisibility();
  assert.equal(retryButton.hidden, true, "challenge mode should hide retry");

  state.sessionMode = "standard";
  updateSummaryActionVisibility();
  assert.equal(
    retryButton.hidden,
    false,
    "standard mode after a challenge should show retry again",
  );

  assert.match(
    appSource,
    /function renderSummary\(\)\s*\{\s*updateSummaryActionVisibility\(\);/,
    "the visibility should be refreshed whenever the summary is rendered",
  );
});

test("interrupted challenge uses the same summary visibility path", () => {
  const interruptSource = extractFunction("interruptSession", "openLearningRecord");
  const showSummarySource = extractFunction("showSummary", "updateChatGPTQuestionButton");

  assert.match(interruptSource, /await showSummary\(\);/);
  assert.match(showSummarySource, /renderSummary\(\);/);
});

test("challenge summary keeps the X share and finish controls", () => {
  assert.match(
    appHtml,
    /<button[^>]*id="summaryShareButton"[^>]*>Xへ投稿<\/button>/,
  );
  assert.match(
    appHtml,
    /<button[^>]*id="finishButton"[^>]*>[\s\S]*?<\/button>/,
  );

  const visibilitySource = extractFunction(
    "updateSummaryActionVisibility",
    "renderSummary",
  );
  assert.doesNotMatch(visibilitySource, /summaryShareButton|finishButton/);
});

test("retry remains standard-only and keeps the existing standard session flow", async () => {
  const handlerMatch = appSource.match(
    /retryButton\.addEventListener\("click", async \(\) => \{[\s\S]*?\r?\n\}\);\r?\n\r?\n(?=finishButton\.addEventListener)/,
  );
  assert.ok(handlerMatch, "retry click handler should exist");

  let retryHandler = null;
  const retryButton = {
    addEventListener(type, handler) {
      assert.equal(type, "click");
      retryHandler = handler;
    },
  };
  const state = { sessionMode: "challenge" };
  let summaryExitCount = 0;
  let standardStartCount = 0;
  let showStartCount = 0;
  new Function(
    "retryButton",
    "state",
    "completeSummaryExit",
    "startSession",
    "showStart",
    handlerMatch[0],
  )(
    retryButton,
    state,
    async () => {
      summaryExitCount += 1;
    },
    () => {
      standardStartCount += 1;
      return true;
    },
    () => {
      showStartCount += 1;
    },
  );

  await retryHandler();
  assert.equal(summaryExitCount, 0, "challenge mode must not retry");
  assert.equal(standardStartCount, 0, "challenge mode must not start random questions");

  state.sessionMode = "standard";
  await retryHandler();
  assert.equal(summaryExitCount, 1);
  assert.equal(standardStartCount, 1);
  assert.equal(showStartCount, 0);

  assert.doesNotMatch(handlerMatch[0], /startChallengeSession|challengeQuestionIds/);
  assert.doesNotMatch(appSource, /state\.challengeQuestionIds/);
});
