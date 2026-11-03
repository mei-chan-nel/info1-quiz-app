// Synthetic history only. Run: node scripts/simulate-weakness-selection.mjs
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { selectWeightedQuestionSet } from "../app/question-selection.js";
import { buildWeaknessWeights, isWeaknessUnlocked } from "../app/weakness-selection.js";
import { selectWeaknessQuestionSet } from "../app/weakness-selection.js";

const questions = JSON.parse(readFileSync(new URL("../data/questions/completed_questions.json", import.meta.url)));
const similarData = JSON.parse(readFileSync(new URL("../data/questions/similar_questions_compact.json", import.meta.url)));
const ids = questions.map((q) => q.id);
const byId = new Map(questions.map((q) => [q.id, q]));
const fields = ["society_security", "digital", "network", "data_db", "algorithm", "design"];
const perField = fields.map((field) => questions.find((q) => q.field_ids[0] === field).id);
const dense = [ids[0], ...similarData[ids[0]].top5.slice(0, 4)];
const rounds = 2000;
const args = process.argv.slice(2);
const argument = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : null;
const seed = Number(argument("--seed") || 20261103) >>> 0;
let randomState = seed;
const random = () => {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 2 ** 32;
};
const defaultScenarios = [
  { name: "誤答なし", wrong: [] },
  ...[1, 2, 3, 4, 5].map((count) => ({ name: `異なる${count}題を誤答`, wrong: ids.slice(0, count) })),
  { name: "6分野から各1題を誤答", wrong: perField },
  { name: "関連の強い5題を誤答", wrong: dense },
  { name: "3題誤答・2題は正答へ回復", wrong: ids.slice(0, 5), recovered: ids.slice(3, 5) },
  { name: "多数の誤答（300題）", wrong: ids.filter((_, index) => index % 4 === 0).slice(0, 300) },
  { name: "全1438題が誤答", wrong: ids },
];
// A saved report can replay its synthetic source combinations without the source CSV.
const scenarioFile = argument("--scenarios");
const scenarios = scenarioFile
  ? JSON.parse(readFileSync(scenarioFile)).reports.map((report) => ({
    name: report.name, wrong: report.sourceIds, recovered: report.recoveredIds,
  }))
  : defaultScenarios;
const reports = scenarios.map((scenario) => {
  const wrong = new Set(scenario.wrong);
  const recovered = new Set(scenario.recovered || []);
  const getRecord = (id) => recovered.has(id) ? { attempts: 2, correct: 1, lastCorrect: true }
    : wrong.has(id) ? { attempts: 1, correct: 0, lastCorrect: false } : { attempts: 0, correct: 0 };
  const start = performance.now();
  const { weights } = buildWeaknessWeights({ questionIds: ids, everWrongQuestionIds: wrong, getRecord, similarData });
  const buildMs = performance.now() - start;
  const total = [...weights.values()].reduce((sum, value) => sum + value, 0);
  const categoryProbability = { unanswered: 0, wrong: 0, recovered: 0 };
  const fieldProbability = Object.fromEntries(fields.map((field) => [field, 0]));
  for (const [id, weight] of weights) {
    categoryProbability[recovered.has(id) ? "recovered" : wrong.has(id) ? "wrong" : "unanswered"] += weight / total;
    fieldProbability[byId.get(id).field_ids[0]] += weight / total;
  }
  const unlocked = isWeaknessUnlocked(wrong);
  const histogram = Array(6).fill(0);
  const fieldDrawCounts = Object.fromEntries(fields.map((field) => [field, 0]));
  const selectedCounts = new Map();
  let unansweredDraws = 0;
  let duplicates = 0;
  const drawStart = performance.now();
  for (let iteration = 0; iteration < rounds; iteration += 1) {
    const options = { questions, count: 5, selectedFieldIds: fields, fieldOrder: fields, random };
    const selected = unlocked ? selectWeaknessQuestionSet({ ...options, weights }) : selectWeightedQuestionSet(options);
    if (new Set(selected.map((q) => q.id)).size !== selected.length) duplicates += 1;
    const unanswered = selected.filter((q) => !wrong.has(q.id)).length;
    unansweredDraws += unanswered;
    histogram[unanswered] += 1;
    for (const question of selected) {
      fieldDrawCounts[question.field_ids[0]] += 1;
      selectedCounts.set(question.id, (selectedCounts.get(question.id) || 0) + 1);
    }
  }
  return {
    name: scenario.name, sourceIds: [...wrong], recoveredIds: [...recovered],
    unlocked, actualMode: unlocked ? "weakness" : "standard", eligibleCount: questions.length,
    weightedCandidateCount: [...weights.values()].filter((weight) => weight > 0).length,
    weightTotal: total, categoryProbability, fieldProbability,
    actualFirstDrawCategoryProbability: unlocked ? categoryProbability : {
      unanswered: (questions.length - wrong.size) / questions.length,
      wrong: (wrong.size - recovered.size) / questions.length,
      recovered: recovered.size / questions.length,
    },
    actualFirstDrawFieldProbability: unlocked ? fieldProbability : Object.fromEntries(
      fields.map((field) => [field, questions.filter((q) => q.field_ids[0] === field).length / questions.length]),
    ),
    topWeights: [...weights].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, weight]) => ({ id, weight, probability: weight / total })),
    rounds, averageUnansweredPerSet: unansweredDraws / rounds, unansweredHistogram: histogram,
    fieldDrawShare: Object.fromEntries(fields.map((field) => [field, fieldDrawCounts[field] / (rounds * 5)])),
    topSelected: [...selectedCounts].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, count]) => ({ id, count, setInclusionRate: count / rounds })),
    duplicates, buildMs, averageDrawMs: (performance.now() - drawStart) / rounds,
  };
});
console.log(JSON.stringify({ seed, questionCount: questions.length,
  fields, roundsPerScenario: rounds, note: "仮想履歴。未解放時は通常抽選。確率欄は解放条件とは別に算出した苦手重点出題の初回抽選重み。", reports }, null, 2));
