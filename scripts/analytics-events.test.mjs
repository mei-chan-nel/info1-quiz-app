import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");

function extractFunction(name, nextName) {
  const pattern = new RegExp(
    `function ${name}\\([\\s\\S]*?(?=\\nfunction ${nextName}\\()`,
  );
  const match = appSource.match(pattern);
  assert.ok(match, `${name} should exist`);
  return match[0].trim();
}

test("analytics helper is a no-op without gtag and isolates analytics errors", () => {
  const functionSource = extractFunction("trackAnalyticsEvent", "openExternalWindow");
  const createTracker = new Function(
    "window",
    `${functionSource}; return trackAnalyticsEvent;`,
  );

  assert.doesNotThrow(() => createTracker({})("quiz_answer", {}));
  assert.doesNotThrow(() =>
    createTracker({
      gtag() {
        throw new Error("analytics unavailable");
      },
    })("quiz_answer", {}),
  );

  const calls = [];
  createTracker({
    gtag(...args) {
      calls.push(args);
    },
  })("result_share_click", { share_target: "x" });
  assert.deepEqual(calls, [
    ["event", "result_share_click", { share_target: "x" }],
  ]);
});

test("all required custom event names are implemented", () => {
  for (const eventName of [
    "quiz_answer",
    "ai_help_click",
    "learning_record_view",
    "review_list_view",
    "review_question_open",
    "question_bookmark",
    "result_share_click",
  ]) {
    assert.match(appSource, new RegExp(`trackAnalyticsEvent\\("${eventName}"`));
  }
});

test("quiz answer parameters distinguish standard sessions and wrong-answer review", () => {
  const functionSource = extractFunction("getQuizAnalyticsParameters", "init")
    .replace(/\n\ninit\(\);$/, "");
  const state = {
    recordPracticeMode: false,
    sessionQuestions: [{}, {}, {}],
    currentIndex: 1,
  };
  const createParameters = new Function(
    "state",
    "getQuestionField",
    "getAnswerModeValue",
    "getCalcModeValue",
    `${functionSource}; return getQuizAnalyticsParameters;`,
  )(
    state,
    () => "network",
    () => "unanswered",
    () => "without",
  );

  assert.deepEqual(createParameters({}), {
    learning_context: "standard",
    question_field: "network",
    answer_mode: "unanswered",
    calc_mode: "without",
    session_target: 3,
    question_position: 2,
  });

  state.recordPracticeMode = true;
  assert.deepEqual(createParameters({}), {
    learning_context: "wrong_review",
    question_field: "network",
    answer_mode: "not_applicable",
    calc_mode: "not_applicable",
    session_target: 1,
    question_position: 1,
  });
});

test("learning contexts cover standard, wrong, saved, and solved views", () => {
  const functionSource = extractFunction("getLearningContext", "getQuestionField");
  const state = {
    recordPracticeMode: false,
    recordReviewMode: false,
    recordListReturnView: "wrong",
  };
  const getContext = new Function(
    "state",
    `${functionSource}; return getLearningContext;`,
  )(state);

  assert.equal(getContext(), "standard");
  state.recordPracticeMode = true;
  assert.equal(getContext(), "wrong_review");
  state.recordPracticeMode = false;
  state.recordReviewMode = true;
  state.recordListReturnView = "checked";
  assert.equal(getContext(), "saved_review");
  state.recordListReturnView = "solved";
  assert.equal(getContext(), "solved_review");
});

test("ChatGPT and X actions do not expose generated outbound URLs in the DOM", () => {
  assert.match(
    htmlSource,
    /<button[^>]+id="chatgptQuestionButton"[^>]*type="button"[^>]*>/,
  );
  assert.match(
    htmlSource,
    /<button[^>]+id="summaryShareButton"[^>]*type="button"[^>]*>/,
  );
  assert.doesNotMatch(
    htmlSource,
    /<(?:a|button)[^>]+id="(?:chatgptQuestionButton|summaryShareButton)"[^>]+href=/,
  );
  assert.doesNotMatch(appSource, /chatgptQuestionButton\.href\s*=/);
  assert.doesNotMatch(appSource, /summaryShareButton\.href\s*=/);

  const summaryAction = extractFunction(
    "renderChatGPTExplanationAction",
    "renderSummaryLifetime",
  );
  assert.doesNotMatch(summaryAction, /<a\b|href=|buildChatGPTQuestionUrl/);
  assert.match(summaryAction, /<button\b/);
});

test("analytics payload construction omits sensitive answer and question details", () => {
  const analyticsSections = [
    extractFunction("getQuizAnalyticsParameters", "init"),
    ...Array.from(
      appSource.matchAll(
        /trackAnalyticsEvent\("[a-z0-9_]+",\s*\{[\s\S]*?\n\s*\}\);/g,
      ),
      (match) => match[0],
    ),
  ].join("\n");

  for (const forbiddenParameter of [
    "question_id",
    "question_text",
    "selected_answer",
    "correct_answer",
    "is_correct",
    "score",
    "accuracy",
    "prompt",
    "url",
  ]) {
    assert.doesNotMatch(
      analyticsSections,
      new RegExp(`\\b${forbiddenParameter}\\s*:`),
    );
  }
});
