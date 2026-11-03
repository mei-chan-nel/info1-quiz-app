import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  buildWeaknessWeights,
  getAnswerSelectionFactor,
  getInitialWeaknessWeight,
  isWeaknessUnlocked,
  selectWeaknessQuestionSet,
} from "../app/weakness-selection.js";

const record = (attempts = 0, correct = 0, lastCorrect = null) => ({ attempts, correct, lastCorrect });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

test("initial weights and final factors have separate roles, including migrated history", () => {
  for (const [value, initial, factor] of [
    [record(), 0, 1], [record(1, 0, false), 1, 0.1],
    [record(2, 1, true), 0.3, 0.05], [record(2, 2, true), 0, 0.05],
    [record(3, 1, null), 1, 0.05],
  ]) {
    assert.equal(getInitialWeaknessWeight(value), initial);
    assert.equal(getAnswerSelectionFactor(value), factor);
  }
});

test("two sparse hops add all directed paths and cycles before applying correction", () => {
  const records = { a: record(1, 0, false), b: record(2, 1, true), c: record(3, 3, true) };
  const similarData = {
    a: { top5: ["b", "c", "d", "e", "f"], additional: ["ignored"] },
    b: { top5: ["a", "c", "d", "e", "f"] },
    c: { top5: ["a", "b", "d", "e", "f"] },
  };
  const result = buildWeaknessWeights({
    questionIds: ["a", "b", "c", "d", "e", "f", "ignored"],
    everWrongQuestionIds: ["a", "b"], getRecord: (id) => records[id] || record(), similarData,
  });
  close(result.directWeights.get("b"), 0.2);
  close(result.directWeights.get("c"), 0.26);
  // a <- b <- a and a <- c <- {a,b}; b's corrected factor must not weaken these paths.
  close(result.secondWeights.get("a"), (0.2 + 0.26) / 5);
  close(result.propagatedWeights.get("a"), 0.3 + 0.6 * 0.06 + 0.1 * 0.092);
  close(result.weights.get("a"), result.propagatedWeights.get("a") * 0.1);
  close(result.weights.get("b"), result.propagatedWeights.get("b") * 0.05);
  close(result.weights.get("c"), result.propagatedWeights.get("c") * 0.05);
  close(result.weights.get("d"), result.propagatedWeights.get("d"));
  assert.equal(result.weights.has("ignored"), false);
});

test("missing edges, duplicates and invalid target IDs are safe and do not use additional", () => {
  const { weights, directWeights } = buildWeaknessWeights({
    questionIds: ["a", "b", "c"], everWrongQuestionIds: ["a", "a"],
    getRecord: (id) => id === "a" ? record(1, 0, false) : record(),
    similarData: { a: { top5: ["b", "b", "missing"], additional: ["c"] } },
  });
  assert.equal(directWeights.get("b"), 1);
  close(weights.get("a"), 0.03);
  close(weights.get("b"), 0.6);
  assert.equal(weights.has("c"), false);
});

test("global history unlocks at five distinct ever-wrong IDs and relocks after clear", () => {
  const source = readFileSync(new URL("../app/learning-record.js", import.meta.url), "utf8");
  const store = new Map();
  const context = {
    window: {}, console: { warn() {}, error() {} },
    localStorage: { getItem: (key) => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) },
  };
  vm.runInNewContext(source, context);
  const api = context.window.Info1LearningRecord;
  for (let index = 0; index < 5; index += 1) {
    assert.equal(isWeaknessUnlocked(api.getEverWrongQuestionIds()), false);
    api.recordAnswer(`q${index}`, false);
    api.recordAnswer(`q${index}`, false);
    api.recordAnswer(`q${index}`, true);
    api.recordAnswer(`correct${index}`, true);
    assert.equal(api.getEverWrongQuestionIds().length, index + 1);
  }
  assert.equal(isWeaknessUnlocked(api.getEverWrongQuestionIds()), true);
  assert.equal(isWeaknessUnlocked(["a", "a", "a", "a", "a"]), false);
  vm.runInNewContext(source, context);
  assert.equal(isWeaknessUnlocked(context.window.Info1LearningRecord.getEverWrongQuestionIds()), true);
  api.clear();
  assert.equal(isWeaknessUnlocked(api.getEverWrongQuestionIds()), false);
});

test("history API reads old v1 and legacy records without losing content or needing storage", () => {
  const source = readFileSync(new URL("../app/learning-record.js", import.meta.url), "utf8");
  for (const [key, data] of [
    ["info1LearningRecord:v1", { v: 1, q: { a: [8, 7, 1, 123, "01111111", 1] }, d: [] }],
    ["info1QuizStats:v4", { a: { attempts: 8, correct: 7 } }],
  ]) {
    const context = { window: {}, console: { warn() {}, error() {} }, localStorage: {
      getItem: (requested) => requested === key ? JSON.stringify(data) : null,
      setItem() {}, removeItem() {},
    } };
    vm.runInNewContext(source, context);
    assert.deepEqual([...context.window.Info1LearningRecord.getEverWrongQuestionIds()], ["a"]);
    assert.equal(context.window.Info1LearningRecord.getQuestion("a").attempts, 8);
  }
  const context = { window: {}, console: { warn() {}, error() {} }, localStorage: {
    getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); }, removeItem() { throw Error("denied"); },
  } };
  vm.runInNewContext(source, context);
  const api = context.window.Info1LearningRecord;
  for (let index = 0; index < 5; index += 1) api.recordAnswer(`q${index}`, false);
  assert.equal(isWeaknessUnlocked(api.getEverWrongQuestionIds()), true);
  assert.equal(api.clear(), false);
  assert.equal(isWeaknessUnlocked(api.getEverWrongQuestionIds()), false);
});

test("weighted sampling is proportional, equal weights tie equally, without normal decay", () => {
  const questions = ["a", "b", "c"].map((id) => ({ id, field_ids: ["field"] }));
  const weights = new Map([["a", 1], ["b", 1], ["c", 2]]);
  const tally = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 1000; i += 1) {
    const [chosen] = selectWeaknessQuestionSet({ questions, count: 1, weights, random: () => (i + 0.5) / 1000,
      attemptCounts: new Map([["a", 9999]]), attemptStatsAvailable: true, getAnsweredAt: () => Date.now() });
    tally[chosen.id] += 1;
  }
  assert.deepEqual(tally, { a: 250, b: 250, c: 500 });
});

test("fallback fills only the shortfall from the filtered pool and never duplicates", () => {
  const questions = ["a", "b", "c", "d"].map((id) => ({ id, field_ids: ["field"] }));
  for (const count of [0, 1, 3, 8]) {
    const chosen = selectWeaknessQuestionSet({ questions: [...questions, questions[0]], count,
      weights: new Map([["c", 1]]), selectedFieldIds: ["field"], fieldOrder: ["field"], random: () => 0 });
    assert.equal(chosen.length, Math.min(count, 4));
    assert.equal(new Set(chosen.map((question) => question.id)).size, chosen.length);
    if (count > 0) assert.equal(chosen[0].id, "c");
    assert.ok(chosen.every((question) => questions.includes(question)));
  }
  assert.deepEqual(selectWeaknessQuestionSet({ questions: [], count: 5, weights: new Map() }), []);
  assert.equal(selectWeaknessQuestionSet({ questions, count: 5, weights: new Map() }).length, 4);
});

test("full real network has five valid directed neighbors and sparse computation stays bounded", () => {
  const questions = JSON.parse(readFileSync(new URL("../data/questions/completed_questions.json", import.meta.url)));
  const similarData = JSON.parse(readFileSync(new URL("../data/questions/similar_questions_compact.json", import.meta.url)));
  const ids = questions.map((question) => question.id);
  const valid = new Set(ids);
  for (const id of ids) {
    assert.equal(similarData[id].top5.length, 5);
    assert.equal(new Set(similarData[id].top5).size, 5);
    assert.ok(similarData[id].top5.every((neighbor) => valid.has(neighbor)));
  }
  const { propagatedWeights, weights } = buildWeaknessWeights({ questionIds: ids,
    everWrongQuestionIds: ids, getRecord: () => record(1, 0, false), similarData });
  close([...propagatedWeights.values()].reduce((sum, weight) => sum + weight, 0), ids.length);
  assert.equal(weights.size, ids.length);
});
