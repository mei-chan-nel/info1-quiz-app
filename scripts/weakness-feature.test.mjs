import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildWeaknessWeights, isWeaknessUnlocked, selectWeaknessQuestionSet } from "../app/weakness-selection.js";

const appSource = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
const extract = (name) => {
  const match = appSource.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?(?=\\n(?:async )?function |$)`));
  assert.ok(match, name);
  return match[0];
};
const questions = JSON.parse(readFileSync(new URL("../data/questions/completed_questions.json", import.meta.url)));
const similarData = JSON.parse(readFileSync(new URL("../data/questions/similar_questions_compact.json", import.meta.url)));
const fieldIds = ["society_security", "digital", "network", "data_db", "algorithm", "design"];

test("availability resets only the question mode, while summary values follow every selection", () => {
  let selected = "weakness";
  let saved = 0;
  let wrongIds = [];
  const weaknessInput = { value: "weakness", disabled: true };
  const standardInput = { value: "standard", set checked(value) { if (value) selected = "standard"; } };
  const questionMode = { querySelector: (query) => query.includes(":checked")
    ? { value: selected } : query.includes("'weakness'") ? weaknessInput : standardInput };
  const label = {};
  const questionSummary = {};
  const answerSummary = {};
  const calcSummary = {};
  let answer = "unanswered";
  let calc = "without";
  const api = new Function("questionMode", "weaknessModeLabel", "questionModeSummary", "answerModeSummary",
    "calcModeSummary", "learningRecord", "isWeaknessUnlocked", "saveQuizPreferences", "getAnswerModeValue", "getCalcModeValue",
    `${extract("getQuestionModeValue")}\n${extract("setCheckedRadioValue")}\n${extract("updateQuestionModeAvailability")}\n${extract("updateAdvancedSettingsSummary")}\nreturn {updateQuestionModeAvailability, updateAdvancedSettingsSummary};`)(
    questionMode, label, questionSummary, answerSummary, calcSummary,
    { getEverWrongQuestionIds: () => wrongIds }, isWeaknessUnlocked,
    () => { saved += 1; }, () => answer, () => calc,
  );
  api.updateQuestionModeAvailability();
  assert.equal(weaknessInput.disabled, true);
  assert.equal(selected, "standard");
  assert.equal(saved, 1);
  assert.equal(label.textContent, "🔒 苦手重点出題（誤答5題以上で解放）");
  wrongIds = ["a", "b", "c", "d", "e"];
  api.updateQuestionModeAvailability();
  assert.equal(weaknessInput.disabled, false);
  assert.equal(label.textContent, "苦手重点出題");
  selected = "weakness";
  api.updateAdvancedSettingsSummary();
  assert.equal(questionSummary.textContent, "出題方法：苦手重点出題");
  assert.equal(answerSummary.textContent, "回答状況：未解答のみ");
  assert.equal(calcSummary.textContent, "計算問題：除く");
  answer = "exclude_mastered";
  calc = "only";
  api.updateAdvancedSettingsSummary();
  assert.equal(answerSummary.textContent, "回答状況：3回連続正答の問題を除く");
  assert.equal(calcSummary.textContent, "計算問題：計算だけ");
  wrongIds = [];
  api.updateQuestionModeAvailability();
  api.updateAdvancedSettingsSummary();
  assert.equal(questionSummary.textContent, "出題方法：通常出題");
  assert.equal(answer, "exclude_mastered");
  assert.equal(calc, "only");
});

test("question methods live first inside details and all three summary lines hide when open", () => {
  const html = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/styles.css", import.meta.url), "utf8");
  const details = html.match(/<details class="advanced-settings"[\s\S]*?<\/details>/)[0];
  assert.ok(details.indexOf('id="questionModeHeading"') < details.indexOf('id="answerModeHeading"'));
  assert.ok(details.indexOf('id="answerModeHeading"') < details.indexOf('id="calcHeading"'));
  assert.ok(details.indexOf('id="calcHeading"') < details.indexOf('id="startRecordButton"'));
  for (const id of ["questionModeSummary", "answerModeSummary", "calcModeSummary"]) assert.ok(details.includes(`id="${id}"`));
  assert.match(css, /\.advanced-settings\[open\] \.advanced-settings-summary\s*\{\s*display: none;/);
});

test("all six fields, four answer filters and three calculation filters also govern fallback", () => {
  const records = new Map(questions.map((question, index) => [question.id,
    index % 4 === 0 ? { attempts: 1, correct: 0, lastCorrect: false, history: "0" }
      : index % 4 === 1 ? { attempts: 2, correct: 1, lastCorrect: true, history: "01" }
        : index % 4 === 2 ? { attempts: 3, correct: 3, lastCorrect: true, history: "111" }
          : { attempts: 0, correct: 0, lastCorrect: null, history: "" },
  ]));
  const learningRecord = {
    getQuestion: (id) => records.get(id),
    hasThreeCorrectInARow: (id) => records.get(id).history.endsWith("111"),
  };
  const { weights } = buildWeaknessWeights({ questionIds: questions.map((q) => q.id),
    everWrongQuestionIds: [...records].filter(([, r]) => r.attempts > r.correct).map(([id]) => id),
    getRecord: learningRecord.getQuestion, similarData });
  for (const fieldId of fieldIds) {
    for (const answer of ["all", "unanswered", "wrong", "exclude_mastered"]) {
      for (const calc of ["all", "without", "only"]) {
        const getPool = new Function("state", "getSelectedFields", "FIELD_DEFINITIONS",
          "questionMatchesField", "getAnswerModeValue", "getCalcModeValue", "learningRecord",
          `${extract("matchesAnswerMode")}\n${extract("matchesCalcMode")}\n${extract("getQuestionPool")}\nreturn getQuestionPool;`)(
          { allQuestions: questions }, () => [{ id: fieldId }], fieldIds,
          (q, field) => q.field_ids.includes(field.id), () => answer, () => calc, learningRecord,
        );
        const pool = getPool();
        for (const selectionWeights of [weights, new Map()]) {
          const selected = selectWeaknessQuestionSet({ questions: pool, count: 50,
            weights: selectionWeights, selectedFieldIds: [fieldId], fieldOrder: fieldIds });
          assert.equal(selected.length, Math.min(50, pool.length));
          assert.equal(new Set(selected.map((q) => q.id)).size, selected.length);
          for (const q of selected) {
            const r = records.get(q.id);
            assert.ok(q.field_ids.includes(fieldId));
            if (answer === "unanswered") assert.equal(r.attempts, 0);
            if (answer === "wrong") assert.equal(r.lastCorrect, false);
            if (answer === "exclude_mastered") assert.equal(r.history.endsWith("111"), false);
            if (calc === "only") assert.equal(q.difficulty, "calculation_basic");
            if (calc === "without") assert.notEqual(q.difficulty, "calculation_basic");
          }
        }
      }
    }
  }
});

test("a wrong source outside the selected field can propagate to a filtered candidate", () => {
  const source = questions.find((q) => similarData[q.id].top5.some((id) =>
    questions.find((target) => target.id === id)?.field_ids[0] !== q.field_ids[0]));
  const target = questions.find((q) => similarData[source.id].top5.includes(q.id)
    && q.field_ids[0] !== source.field_ids[0]);
  const { weights } = buildWeaknessWeights({ questionIds: questions.map((q) => q.id),
    everWrongQuestionIds: [source.id], similarData,
    getRecord: (id) => id === source.id ? { attempts: 1, correct: 0, lastCorrect: false } : {},
  });
  assert.ok(weights.get(target.id) > 0);
  assert.deepEqual(selectWeaknessQuestionSet({ questions: [target], weights, count: 5 }), [target]);
});

test("pending weakness preparation is guarded, retryable on failure and cannot start after leaving", async () => {
  let resolveLoad;
  let loadCount = 0;
  let starts = 0;
  let messages = 0;
  const state = { sessionStarting: false, sessionId: 1, allQuestions: [] };
  const startView = { hidden: false };
  const summaryView = { hidden: true };
  const start = new Function("state", "startView", "summaryView", "updateQuestionModeAvailability",
    "getQuestionModeValue", "updateStartControls", "loadSimilarQuestionsInBackground",
    "buildWeaknessWeights", "learningRecord", "startSelectedSession", "showSimilarMessage", "console",
    `${extract("startSession")}\nreturn startSession;`)(state, startView, summaryView,
    () => {}, () => "weakness", () => {},
    () => { loadCount += 1; return new Promise((resolve, reject) => { resolveLoad = { resolve, reject }; }); },
    () => ({ weights: new Map() }), { getEverWrongQuestionIds: () => [] },
    () => { starts += 1; return true; }, () => { messages += 1; }, { error() {} });
  const first = start();
  assert.equal(await start(), false);
  assert.equal(loadCount, 1);
  startView.hidden = true;
  resolveLoad.resolve({});
  assert.equal(await first, false);
  assert.equal(starts, 0);
  assert.equal(state.sessionStarting, false);
  startView.hidden = false;
  const failure = start();
  resolveLoad.reject(Error("offline"));
  assert.equal(await failure, false);
  assert.equal(messages, 1);
  const retry = start();
  resolveLoad.resolve({});
  assert.equal(await retry, true);
  assert.equal(starts, 1);
});
