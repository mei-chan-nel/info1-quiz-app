import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../app/quiz-preferences.js", import.meta.url), "utf8");
const PREFERENCE_KEY = "info1QuizPreferences:v1";
const LEARNING_KEY = "info1LearningRecord:v1";
const ALL_FIELDS = [
  "society_security",
  "digital",
  "network",
  "data_db",
  "algorithm",
  "design",
];

function createPreferences(initialEntries = {}) {
  const values = new Map(Object.entries(initialEntries));
  const localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
  const window = {};
  const context = vm.createContext({ console: { warn() {} }, localStorage, Set, window });
  vm.runInContext(source, context, { filename: "quiz-preferences.js" });
  return { api: window.Info1QuizPreferences, values };
}

function plain(preferences) {
  return { ...preferences, fields: [...preferences.fields] };
}

test("missing preferences use the existing UI defaults", () => {
  const { api } = createPreferences();
  assert.deepEqual(plain(api.load()), {
    fields: ALL_FIELDS,
    answerMode: "all",
    questionMode: "standard",
    calcMode: "all",
    setSize: 5,
  });
});

test("valid preferences including all-fields-cleared survive a reload", () => {
  const { api, values } = createPreferences();
  assert.equal(api.save({
    fields: [],
    answerMode: "unanswered",
    questionMode: "standard",
    calcMode: "without",
    setSize: 17,
  }), true);

  const reloaded = createPreferences(Object.fromEntries(values)).api.load();
  assert.deepEqual(plain(reloaded), {
    fields: [],
    answerMode: "unanswered",
    questionMode: "standard",
    calcMode: "without",
    setSize: 17,
  });
});

test("every supported answer and calculation mode round-trips", () => {
  const answerModes = ["all", "unanswered", "wrong", "exclude_mastered"];
  const calcModes = ["all", "without", "only"];

  for (const answerMode of answerModes) {
    for (const calcMode of calcModes) {
      const { api } = createPreferences();
      api.save({ fields: ["algorithm"], answerMode, calcMode, setSize: 23 });
      assert.deepEqual(plain(api.load()), {
        fields: ["algorithm"],
        answerMode,
        questionMode: "standard",
        calcMode,
        setSize: 23,
      });
    }
  }
});

test("corrupt and unsupported values fall back safely", () => {
  const corrupt = createPreferences({ [PREFERENCE_KEY]: "not-json" }).api.load();
  assert.deepEqual(plain(corrupt), {
    fields: ALL_FIELDS,
    answerMode: "all",
    questionMode: "standard",
    calcMode: "all",
    setSize: 5,
  });

  const unsupported = createPreferences({
    [PREFERENCE_KEY]: JSON.stringify({
      v: 1,
      fields: ["removed_future_field"],
      answerMode: "future-mode",
      questionMode: "standard",
      calcMode: "future-mode",
      setSize: 1000,
    }),
  }).api.load();
  assert.deepEqual(plain(unsupported), {
    fields: ALL_FIELDS,
    answerMode: "all",
    questionMode: "standard",
    calcMode: "all",
    setSize: 5,
  });
});

test("saving preferences never changes the learning-record key", () => {
  const learningRecord = JSON.stringify({
    v: 1,
    q: { q1: [3, 2, 1, 123, "101", 1] },
    d: ["20260913"],
  });
  const { api, values } = createPreferences({ [LEARNING_KEY]: learningRecord });

  api.save({ fields: ["digital"], answerMode: "wrong", calcMode: "only", setSize: 9 });

  assert.equal(values.get(LEARNING_KEY), learningRecord);
  assert.ok(values.has(PREFERENCE_KEY));
});

test("question modes round-trip and old v1 settings default to standard", () => {
  for (const questionMode of ["standard", "weakness"]) {
    const { api, values } = createPreferences();
    api.save({ fields: ALL_FIELDS, questionMode, answerMode: "unanswered", calcMode: "without", setSize: 5 });
    const loaded = createPreferences(Object.fromEntries(values)).api.load();
    assert.equal(loaded.questionMode, questionMode);
    assert.equal(loaded.answerMode, "unanswered");
    assert.equal(loaded.calcMode, "without");
  }
  const old = createPreferences({ [PREFERENCE_KEY]: JSON.stringify({
    v: 1, fields: ["digital"], answerMode: "wrong", calcMode: "only", setSize: 9,
  }) }).api.load();
  assert.equal(old.questionMode, "standard");
  assert.equal(old.answerMode, "wrong");
  const unknown = createPreferences({ [PREFERENCE_KEY]: JSON.stringify({ v: 1, questionMode: "unknown" }) }).api.load();
  assert.equal(unknown.questionMode, "standard");
});

test("unavailable localStorage never throws on load or save", () => {
  const context = vm.createContext({ console: { warn() {} }, window: {}, localStorage: {
    getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); },
  } });
  vm.runInContext(source, context);
  assert.equal(context.window.Info1QuizPreferences.load().questionMode, "standard");
  assert.equal(context.window.Info1QuizPreferences.save({ questionMode: "weakness" }), false);
});
