import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");

function extractFunction(name, nextName) {
  const pattern = new RegExp(
    `(?:async )?function ${name}\\([\\s\\S]*?(?=\\r?\\n(?:async )?function ${nextName}\\()`,
  );
  const match = appSource.match(pattern);
  assert.ok(match, `${name} should exist`);
  return match[0].trim();
}

test("page restoration and background return trigger revalidation", () => {
  const source = extractFunction("bindQuestionDataLifecycle", "isQuestionDataRefreshSafe");
  assert.match(source, /addEventListener\("pageshow"/);
  assert.match(source, /event\.persisted \|\| hasSeenPageShow/);
  assert.match(source, /addEventListener\("visibilitychange"/);
  assert.match(source, /document\.visibilityState === "hidden"/);
  assert.match(source, /refreshQuestionData\(\{ bypassInterval \}\)/);
});

test("question data replacement is deferred during a learning session", async () => {
  const safeSource = extractFunction("isQuestionDataRefreshSafe", "refreshQuestionData");
  const refreshSource = extractFunction("refreshQuestionData", "renderSummary");
  const oldQuestions = [{ id: "old" }];
  const newQuestions = [{ id: "old" }, { id: "new" }];
  const state = {
    allQuestions: oldQuestions,
    questionDataStatus: "ready",
    challengeRequested: false,
    recordPracticeMode: false,
    recordReviewMode: false,
  };
  const questionView = { hidden: false };
  const summaryView = { hidden: true };
  const hiddenView = { hidden: true };
  let refreshCalls = 0;
  let controlUpdates = 0;
  const window = {
    StudyAtlasQuestionData: {
      async refresh() {
        refreshCalls += 1;
        return newQuestions;
      },
    },
  };
  const factory = new Function(
    "state",
    "questionView",
    "summaryView",
    "recordView",
    "wrongView",
    "checkedView",
    "solvedView",
    "window",
    "updateStartControls",
    "renderLearningRecord",
    "renderWrongQuestions",
    "renderCheckedQuestions",
    "renderSolvedQuestions",
    "QUESTION_DATA_REFRESH_INTERVAL_MS",
    `let lastQuestionDataRefreshAt = 0;
let questionDataRefreshPromise = null;
let questionDataRefreshPending = false;
${safeSource}
${refreshSource}
return { refreshQuestionData, isPending: () => questionDataRefreshPending };`,
  );
  const api = factory(
    state,
    questionView,
    summaryView,
    hiddenView,
    hiddenView,
    hiddenView,
    hiddenView,
    window,
    () => { controlUpdates += 1; },
    () => {},
    () => {},
    () => {},
    () => {},
    300000,
  );

  assert.equal(await api.refreshQuestionData({ bypassInterval: true }), null);
  assert.equal(api.isPending(), true);
  assert.equal(refreshCalls, 0);
  assert.equal(state.allQuestions, oldQuestions);

  questionView.hidden = true;
  assert.equal(await api.refreshQuestionData({ bypassInterval: true }), newQuestions);
  assert.equal(refreshCalls, 1);
  assert.equal(controlUpdates, 1);
  assert.equal(state.allQuestions, newQuestions);
});
