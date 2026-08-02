export const QUESTION_SELECTION_CONFIG = Object.freeze({
  ATTEMPT_WEIGHT_PSEUDOCOUNT: 4,
  ATTEMPT_WEIGHT_MIN: 0.75,
  ATTEMPT_WEIGHT_MAX: 1.75,
  RECENT_ANSWER_RATIO: 0.10,
  RECENT_ANSWER_WEIGHT: 0.25,
  RECENT_ANSWER_VALID_DAYS: 7,
  QUESTION_STATS_BATCH_SIZE: 200,
});

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const RECENT_ANSWER_VALID_MS =
  QUESTION_SELECTION_CONFIG.RECENT_ANSWER_VALID_DAYS * MILLISECONDS_PER_DAY;
const DEFAULT_FALLBACK_FIELD = "__fallback__";

export function medianOfPositiveValues(values) {
  const positiveValues = Array.from(values || [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  if (!positiveValues.length) {
    return 0;
  }
  const middle = Math.floor(positiveValues.length / 2);
  if (positiveValues.length % 2 === 1) {
    return positiveValues[middle];
  }
  return (positiveValues[middle - 1] + positiveValues[middle]) / 2;
}

export function calculateAttemptWeight({
  attempts,
  fieldMedian,
  statsAvailable = true,
  config = QUESTION_SELECTION_CONFIG,
}) {
  if (!statsAvailable || fieldMedian === 0) {
    return 1;
  }
  const attemptCount = Number(attempts);
  const median = Number(fieldMedian);
  if (
    !Number.isFinite(attemptCount) ||
    attemptCount < 0 ||
    !Number.isFinite(median) ||
    median < 0
  ) {
    return 1;
  }
  const rawWeight = Math.sqrt(
    (median + config.ATTEMPT_WEIGHT_PSEUDOCOUNT) /
      (attemptCount + config.ATTEMPT_WEIGHT_PSEUDOCOUNT),
  );
  if (!Number.isFinite(rawWeight) || rawWeight <= 0) {
    return 1;
  }
  return Math.min(
    Math.max(rawWeight, config.ATTEMPT_WEIGHT_MIN),
    config.ATTEMPT_WEIGHT_MAX,
  );
}

export function getRecentAnsweredQuestionIds({
  questions,
  getAnsweredAt,
  now = Date.now(),
  config = QUESTION_SELECTION_CONFIG,
}) {
  const candidates = Array.isArray(questions) ? questions : [];
  const currentTime = Number(now);
  if (!Number.isFinite(currentTime) || typeof getAnsweredAt !== "function") {
    return new Set();
  }
  const recentCandidates = [];
  for (const question of candidates) {
    const answeredAt = Number(getAnsweredAt(question));
    const answeredAge = currentTime - answeredAt;
    if (
      Number.isFinite(answeredAt) &&
      answeredAt > 0 &&
      answeredAge >= 0 &&
      answeredAge <= RECENT_ANSWER_VALID_MS
    ) {
      recentCandidates.push({
        id: getQuestionId(question),
        answeredAt,
      });
    }
  }
  recentCandidates.sort((left, right) => {
    if (left.answeredAt !== right.answeredAt) {
      return right.answeredAt - left.answeredAt;
    }
    return compareIds(left.id, right.id);
  });
  const recentLimit = Math.min(
    Math.ceil(config.RECENT_ANSWER_RATIO * candidates.length),
    recentCandidates.length,
  );
  return new Set(recentCandidates.slice(0, recentLimit).map((item) => item.id));
}

export function weightedPickOne(
  items,
  {
    getWeight = () => 1,
    random = Math.random,
  } = {},
) {
  const candidates = Array.from(items || []);
  if (!candidates.length) {
    return null;
  }
  const weights = candidates.map((item) => {
    const value = Number(getWeight(item));
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const randomValue = normalizeRandomValue(random());
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return candidates[Math.floor(randomValue * candidates.length)];
  }
  const target = randomValue * totalWeight;
  let cumulativeWeight = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    cumulativeWeight += weights[index];
    if (target < cumulativeWeight) {
      return candidates[index];
    }
  }
  return candidates[candidates.length - 1];
}

export function assignQuestionToSelectionField({
  question,
  selectedFieldIds,
  fieldOrder,
  onWarning = () => {},
}) {
  const selected = new Set(Array.from(selectedFieldIds || [], String));
  const orderedFields = uniqueStrings(fieldOrder);
  const primaryField = String(question?.field_ids?.[0] || "");
  if (primaryField && selected.has(primaryField)) {
    return primaryField;
  }
  const fallbackField =
    orderedFields.find((fieldId) => selected.has(fieldId)) ||
    [...selected].sort(compareIds)[0] ||
    primaryField ||
    DEFAULT_FALLBACK_FIELD;
  onWarning(
    `抽選用分野を決定できなかったため、問題 ${getQuestionId(question) || "(IDなし)"} を ${fallbackField} に割り当てました。`,
  );
  return fallbackField;
}

export function groupQuestionsBySelectionField({
  questions,
  selectedFieldIds,
  fieldOrder,
  onWarning = () => {},
}) {
  const selected = uniqueStrings(selectedFieldIds);
  const orderedFields = uniqueStrings(fieldOrder);
  const groups = new Map();
  const fieldByQuestionId = new Map();
  for (const fieldId of orderedFields) {
    if (selected.includes(fieldId)) {
      groups.set(fieldId, []);
    }
  }
  for (const question of questions || []) {
    const fieldId = assignQuestionToSelectionField({
      question,
      selectedFieldIds: selected,
      fieldOrder: orderedFields,
      onWarning,
    });
    if (!groups.has(fieldId)) {
      groups.set(fieldId, []);
    }
    groups.get(fieldId).push(question);
    fieldByQuestionId.set(getQuestionId(question), fieldId);
  }
  return { groups, fieldByQuestionId };
}

export function buildQuestionSelectionWeights({
  questions,
  fieldByQuestionId,
  attemptCounts = new Map(),
  attemptStatsAvailable = false,
  recentQuestionIds = new Set(),
  config = QUESTION_SELECTION_CONFIG,
}) {
  const candidates = Array.isArray(questions) ? questions : [];
  const fieldAttempts = new Map();
  if (attemptStatsAvailable) {
    for (const question of candidates) {
      const questionId = getQuestionId(question);
      const fieldId = fieldByQuestionId.get(questionId);
      if (!fieldAttempts.has(fieldId)) {
        fieldAttempts.set(fieldId, []);
      }
      fieldAttempts.get(fieldId).push(Number(attemptCounts.get(questionId) ?? 0));
    }
  }
  const fieldMedians = new Map(
    [...fieldAttempts].map(([fieldId, attempts]) => [
      fieldId,
      medianOfPositiveValues(attempts),
    ]),
  );
  const weights = new Map();
  for (const question of candidates) {
    const questionId = getQuestionId(question);
    const fieldId = fieldByQuestionId.get(questionId);
    const attemptWeight = calculateAttemptWeight({
      attempts: attemptCounts.get(questionId) ?? 0,
      fieldMedian: fieldMedians.get(fieldId) ?? 0,
      statsAvailable: attemptStatsAvailable,
      config,
    });
    const recentWeight = recentQuestionIds.has(questionId)
      ? config.RECENT_ANSWER_WEIGHT
      : 1;
    const combinedWeight = attemptWeight * recentWeight;
    weights.set(questionId, {
      attemptWeight,
      recentWeight,
      finalWeight:
        Number.isFinite(combinedWeight) && combinedWeight > 0
          ? combinedWeight
          : 1,
    });
  }
  return { fieldMedians, weights };
}

export function selectWeightedQuestionSet({
  questions,
  count,
  selectedFieldIds,
  fieldOrder,
  attemptCounts = new Map(),
  attemptStatsAvailable = false,
  getAnsweredAt = () => null,
  now = Date.now(),
  random = Math.random,
  onWarning = () => {},
  config = QUESTION_SELECTION_CONFIG,
}) {
  const candidates = uniqueQuestions(questions, onWarning);
  const requestedCount = Math.max(0, Math.floor(Number(count) || 0));
  const selectionCount = Math.min(requestedCount, candidates.length);
  if (!selectionCount) {
    return [];
  }
  const { groups, fieldByQuestionId } = groupQuestionsBySelectionField({
    questions: candidates,
    selectedFieldIds,
    fieldOrder,
    onWarning,
  });
  const recentQuestionIds = getRecentAnsweredQuestionIds({
    questions: candidates,
    getAnsweredAt,
    now,
    config,
  });
  const { weights } = buildQuestionSelectionWeights({
    questions: candidates,
    fieldByQuestionId,
    attemptCounts,
    attemptStatsAvailable,
    recentQuestionIds,
    config,
  });
  const selectedQuestions = [];
  while (selectedQuestions.length < selectionCount) {
    const remainingFields = [...groups].filter(([, remaining]) => remaining.length > 0);
    if (!remainingFields.length) {
      break;
    }
    const selectedField = weightedPickOne(remainingFields, {
      getWeight: ([, remaining]) => remaining.length,
      random,
    });
    const remainingQuestions = selectedField?.[1];
    if (!remainingQuestions?.length) {
      break;
    }
    const selectedQuestion = weightedPickOne(remainingQuestions, {
      getWeight: (question) => weights.get(getQuestionId(question))?.finalWeight ?? 1,
      random,
    });
    if (!selectedQuestion) {
      break;
    }
    selectedQuestions.push(selectedQuestion);
    remainingQuestions.splice(remainingQuestions.indexOf(selectedQuestion), 1);
  }
  return selectedQuestions;
}

function uniqueQuestions(questions, onWarning) {
  const unique = [];
  const seenIds = new Set();
  for (const question of questions || []) {
    const questionId = getQuestionId(question);
    if (!questionId || seenIds.has(questionId)) {
      onWarning(`抽選候補から重複またはIDのない問題を除外しました: ${questionId || "(IDなし)"}`);
      continue;
    }
    seenIds.add(questionId);
    unique.push(question);
  }
  return unique;
}

function uniqueStrings(values) {
  return [...new Set(Array.from(values || [], String).filter(Boolean))];
}

function getQuestionId(question) {
  return String(question?.id || "").trim();
}

function compareIds(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeRandomValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  return Math.min(number, 1 - Number.EPSILON);
}
