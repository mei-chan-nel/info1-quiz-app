import { weightedPickOne } from "./question-selection.js";

export const WEAKNESS_SELECTION_CONFIG = Object.freeze({
  UNLOCK_COUNT: 5,
  INITIAL_WRONG: 1,
  INITIAL_RECOVERED: 0.3,
  SELF_SHARE: 0.3,
  DIRECT_SHARE: 0.6,
  SECOND_SHARE: 0.1,
  UNANSWERED_FACTOR: 1,
  WRONG_FACTOR: 0.1,
  CORRECT_FACTOR: 0.05,
  NEIGHBOR_LIMIT: 5,
});

export function hasWrongAnswer(record) {
  return Number(record?.attempts) > Number(record?.correct);
}

export function getInitialWeaknessWeight(record, config = WEAKNESS_SELECTION_CONFIG) {
  if (!hasWrongAnswer(record)) return 0;
  // Old migrated records may have no last result; retain their known wrong history.
  return record.lastCorrect === true ? config.INITIAL_RECOVERED : config.INITIAL_WRONG;
}

export function getAnswerSelectionFactor(record, config = WEAKNESS_SELECTION_CONFIG) {
  if (!(Number(record?.attempts) > 0)) return config.UNANSWERED_FACTOR;
  return record.lastCorrect === false ? config.WRONG_FACTOR : config.CORRECT_FACTOR;
}

export function isWeaknessUnlocked(everWrongQuestionIds, config = WEAKNESS_SELECTION_CONFIG) {
  return new Set(everWrongQuestionIds).size >= config.UNLOCK_COUNT;
}

export function buildWeaknessWeights({
  questionIds,
  everWrongQuestionIds,
  getRecord,
  similarData,
  config = WEAKNESS_SELECTION_CONFIG,
}) {
  const validIds = new Set(Array.from(questionIds, String));
  const initialWeights = new Map();
  const records = new Map();
  const recordFor = (id) => {
    if (!records.has(id)) records.set(id, getRecord(id));
    return records.get(id);
  };
  for (const id of new Set(Array.from(everWrongQuestionIds, String))) {
    const weight = getInitialWeaknessWeight(recordFor(id), config);
    if (weight > 0) initialWeights.set(id, weight);
  }

  // Sparse, directed propagation. Correction is deliberately applied only after both hops.
  const propagate = (sources) => {
    const result = new Map();
    for (const [id, weight] of sources) {
      const top5 = similarData?.[id]?.top5;
      const neighbors = Array.isArray(top5)
        ? [...new Set(top5.slice(0, config.NEIGHBOR_LIMIT).map(String))]
          .filter((neighbor) => validIds.has(neighbor))
        : [];
      for (const neighbor of neighbors) {
        result.set(neighbor, (result.get(neighbor) || 0) + weight / neighbors.length);
      }
    }
    return result;
  };
  const directWeights = propagate(initialWeights);
  const secondWeights = propagate(directWeights);
  const propagatedWeights = new Map();
  for (const [component, share] of [
    [initialWeights, config.SELF_SHARE],
    [directWeights, config.DIRECT_SHARE],
    [secondWeights, config.SECOND_SHARE],
  ]) {
    for (const [id, weight] of component) {
      if (validIds.has(id)) {
        propagatedWeights.set(id, (propagatedWeights.get(id) || 0) + share * weight);
      }
    }
  }
  const weights = new Map([...propagatedWeights].map(([id, weight]) => [
    id, weight * getAnswerSelectionFactor(recordFor(id), config),
  ]));
  return { initialWeights, directWeights, secondWeights, propagatedWeights, weights };
}

// questions must already satisfy the existing field, answer and calculation filters.
export function selectWeaknessQuestionSet({
  questions,
  count,
  weights,
  random = Math.random,
}) {
  const candidates = [...new Map((questions || []).filter((question) => question?.id)
    .map((question) => [String(question.id), question])).values()];
  const selectionCount = Math.min(Math.max(0, Math.floor(Number(count) || 0)), candidates.length);
  const positive = candidates.filter((question) => {
    const weight = weights.get(String(question.id));
    return Number.isFinite(weight) && weight > 0;
  });
  const selected = [];
  while (selected.length < selectionCount && positive.length) {
    const question = weightedPickOne(positive, {
      getWeight: (candidate) => weights.get(String(candidate.id)),
      random,
    });
    selected.push(question);
    positive.splice(positive.indexOf(question), 1);
  }
  return selected;
}
