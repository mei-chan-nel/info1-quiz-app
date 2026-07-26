import assert from "node:assert/strict";
import test from "node:test";

import {
  QUESTION_SELECTION_CONFIG,
  assignQuestionToSelectionField,
  buildQuestionSelectionWeights,
  calculateAttemptWeight,
  getRecentAnsweredQuestionIds,
  groupQuestionsBySelectionField,
  medianOfPositiveValues,
  selectWeightedQuestionSet,
  weightedPickOne,
} from "../app/question-selection.js";

const DAY = 24 * 60 * 60 * 1000;
const FIELD_ORDER = ["a", "b", "c"];

test("正の回答回数だけから中央値を求める", () => {
  assert.equal(medianOfPositiveValues([2, 4, 8, 10]), 6);
});

test("中央値の計算から0回を除く", () => {
  assert.equal(medianOfPositiveValues([0, 0, 3, 9]), 6);
});

test("分野内の全問題が0回なら回答回数補正はすべて1になる", () => {
  const questions = [question("a1", "a"), question("a2", "a")];
  const { fieldByQuestionId } = groupQuestionsBySelectionField({
    questions,
    selectedFieldIds: ["a"],
    fieldOrder: FIELD_ORDER,
  });
  const { weights } = buildQuestionSelectionWeights({
    questions,
    fieldByQuestionId,
    attemptCounts: new Map([["a1", 0], ["a2", 0]]),
    attemptStatsAvailable: true,
  });
  assert.deepEqual(
    [...weights.values()].map((value) => value.attemptWeight),
    [1, 1],
  );
});

test("0回の問題は新規問題として高い回答回数補正を受ける", () => {
  const weight = calculateAttemptWeight({ attempts: 0, fieldMedian: 16 });
  assert.ok(weight > 1);
});

test("回答回数補正は0.75から1.75の範囲に収まる", () => {
  assert.equal(calculateAttemptWeight({ attempts: 1_000_000_000, fieldMedian: 1 }), 0.75);
  assert.equal(calculateAttemptWeight({ attempts: 0, fieldMedian: 1_000_000_000 }), 1.75);
});

test("統計を利用できない場合は回答回数補正が1になる", () => {
  assert.equal(
    calculateAttemptWeight({
      attempts: 0,
      fieldMedian: 100,
      statsAvailable: false,
    }),
    1,
  );
});

test("直近対象数は候補数の10パーセントを切り上げる", () => {
  const now = Date.UTC(2026, 6, 20);
  const questions = Array.from({ length: 21 }, (_, index) => question(`q${String(index).padStart(2, "0")}`, "a"));
  const recent = getRecentAnsweredQuestionIds({
    questions,
    getAnsweredAt: () => now - DAY,
    now,
  });
  assert.equal(recent.size, Math.ceil(questions.length * 0.10));
});

test("7日より古い問題は直近対象にならない", () => {
  const now = Date.UTC(2026, 6, 20);
  const recent = getRecentAnsweredQuestionIds({
    questions: [question("old", "a")],
    getAnsweredAt: () => now - 7 * DAY - 1,
    now,
  });
  assert.equal(recent.size, 0);
});

test("直近問題の補正倍率は0.25になる", () => {
  const questions = [question("recent", "a")];
  const fieldByQuestionId = new Map([["recent", "a"]]);
  const { weights } = buildQuestionSelectionWeights({
    questions,
    fieldByQuestionId,
    recentQuestionIds: new Set(["recent"]),
  });
  assert.equal(weights.get("recent").recentWeight, QUESTION_SELECTION_CONFIG.RECENT_ANSWER_WEIGHT);
});

test("7日以内の問題が少ない場合は古い問題で補わない", () => {
  const now = Date.UTC(2026, 6, 20);
  const questions = Array.from({ length: 30 }, (_, index) => question(`q${index}`, "a"));
  const recent = getRecentAnsweredQuestionIds({
    questions,
    getAnsweredAt: (item) => (
      item.id === "q0" || item.id === "q1"
        ? now - DAY
        : now - 8 * DAY
    ),
    now,
  });
  assert.deepEqual([...recent].sort(), ["q0", "q1"]);
});

test("同じ回答日時では問題IDが直近順の第2ソートキーになる", () => {
  const now = Date.UTC(2026, 6, 20);
  const questions = [
    question("b", "a"),
    question("a", "a"),
    ...Array.from({ length: 8 }, (_, index) => question(`z${index}`, "a")),
  ];
  const recent = getRecentAnsweredQuestionIds({
    questions,
    getAnsweredAt: () => now - DAY,
    now,
  });
  assert.deepEqual([...recent], ["a"]);
});

test("分野抽選は残り候補数に比例する", () => {
  const selected = selectWeightedQuestionSet({
    questions: [
      question("a1", "a"),
      question("a2", "a"),
      question("a3", "a"),
      question("b1", "b"),
    ],
    count: 1,
    selectedFieldIds: ["a", "b"],
    fieldOrder: FIELD_ORDER,
    random: sequenceRandom([0.60, 0]),
  });
  assert.equal(selected[0].field_ids[0], "a");
});

test("分野を均等抽選せず候補が多い分野を確率区間どおり選ぶ", () => {
  const selected = selectWeightedQuestionSet({
    questions: [
      question("a1", "a"),
      question("b1", "b"),
      question("b2", "b"),
      question("b3", "b"),
    ],
    count: 1,
    selectedFieldIds: ["a", "b"],
    fieldOrder: FIELD_ORDER,
    random: sequenceRandom([0.40, 0]),
  });
  assert.equal(selected[0].field_ids[0], "b");
});

test("分野内抽選は最終重みに従う", () => {
  const selected = selectWeightedQuestionSet({
    questions: [question("new", "a"), question("frequent", "a")],
    count: 1,
    selectedFieldIds: ["a"],
    fieldOrder: FIELD_ORDER,
    attemptCounts: new Map([["new", 0], ["frequent", 100]]),
    attemptStatsAvailable: true,
    random: sequenceRandom([0, 0.60]),
  });
  assert.equal(selected[0].id, "new");
});

test("最終重みは回答回数補正と直近回答補正の積になる", () => {
  const questions = [question("q", "a")];
  const { weights } = buildQuestionSelectionWeights({
    questions,
    fieldByQuestionId: new Map([["q", "a"]]),
    attemptCounts: new Map([["q", 0]]),
    attemptStatsAvailable: true,
    recentQuestionIds: new Set(["q"]),
  });
  const weight = weights.get("q");
  assert.equal(weight.finalWeight, weight.attemptWeight * weight.recentWeight);
});

test("同一問題セット内で同じ問題を重複させない", () => {
  const questions = [question("q1", "a"), question("q2", "a"), question("q3", "b")];
  const selected = selectWeightedQuestionSet({
    questions,
    count: 3,
    selectedFieldIds: ["a", "b"],
    fieldOrder: FIELD_ORDER,
    random: () => 0,
  });
  assert.equal(new Set(selected.map((item) => item.id)).size, selected.length);
});

test("候補数より多い出題数を要求しても候補数で安全に終了する", () => {
  const selected = selectWeightedQuestionSet({
    questions: [question("q1", "a"), question("q2", "b")],
    count: 50,
    selectedFieldIds: ["a", "b"],
    fieldOrder: FIELD_ORDER,
    random: () => 0.5,
  });
  assert.equal(selected.length, 2);
});

test("不正な重みでは均等抽選へ戻る", () => {
  const selected = weightedPickOne(["first", "second"], {
    getWeight: (item) => (item === "first" ? Number.NaN : -1),
    random: () => 0.75,
  });
  assert.equal(selected, "second");
});

test("固定乱数では抽選結果を再現できる", () => {
  const options = {
    questions: [
      question("a1", "a"),
      question("a2", "a"),
      question("b1", "b"),
      question("b2", "b"),
    ],
    count: 3,
    selectedFieldIds: ["a", "b"],
    fieldOrder: FIELD_ORDER,
  };
  const first = selectWeightedQuestionSet({
    ...options,
    random: sequenceRandom([0.1, 0.8, 0.9, 0.2, 0.4, 0.6]),
  });
  const second = selectWeightedQuestionSet({
    ...options,
    random: sequenceRandom([0.1, 0.8, 0.9, 0.2, 0.4, 0.6]),
  });
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
});

test("一部分野だけを選んだ場合の抽選用分野割当は決定的である", () => {
  const item = question("q", "c");
  const options = {
    question: item,
    selectedFieldIds: ["a", "b"],
    fieldOrder: FIELD_ORDER,
    matchingFieldIds: new Set(["b", "a", "c"]),
  };
  assert.equal(assignQuestionToSelectionField(options), "a");
  assert.equal(assignQuestionToSelectionField(options), "a");
});

test("主分野が選択中なら推定分野より主分野を優先する", () => {
  assert.equal(
    assignQuestionToSelectionField({
      question: question("q", "b"),
      selectedFieldIds: ["a", "b", "c"],
      fieldOrder: FIELD_ORDER,
      matchingFieldIds: new Set(["a"]),
    }),
    "b",
  );
});

function question(id, fieldId) {
  return { id, field_ids: [fieldId] };
}

function sequenceRandom(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}
