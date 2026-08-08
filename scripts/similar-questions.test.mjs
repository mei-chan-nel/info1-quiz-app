import assert from "node:assert/strict";
import test from "node:test";

import {
  SIMILAR_RETURN_CONTEXT_KEY,
  SIMILAR_RETURN_MAX_AGE_MS,
  SIMILAR_SOURCE_TYPES,
  buildSimilarCandidates,
  clearSimilarReturnContext,
  createSimilarQuestionsLoader,
  createSimilarReturnContext,
  getSafeSimilarReturnUrl,
  readSimilarReturnContext,
  selectSimilarQuestionIds,
  weightedSampleWithoutReplacement,
  writeSimilarReturnContext,
} from "../app/similar-questions.js";

test("concurrent similar-data consumers share one request and reuse cached data", async () => {
  let fetchCount = 0;
  let resolveFetch;
  const fetchImpl = (_url, init) => {
    fetchCount += 1;
    assert.equal(init.cache, "no-store");
    return new Promise((resolve) => {
      resolveFetch = resolve;
    });
  };
  const loader = createSimilarQuestionsLoader({
    url: "https://example.test/similar.json",
    fetchImpl,
  });

  const first = loader.load();
  const second = loader.load();
  assert.equal(first, second);
  assert.equal(fetchCount, 1);

  const data = { source: { top5: ["candidate"], additional: [] } };
  resolveFetch({ ok: true, status: 200, json: async () => data });
  assert.equal(await first, data);
  assert.equal(await loader.load(), data);
  assert.equal(fetchCount, 1);
});

test("a failed similar-data request can be retried", async () => {
  let fetchCount = 0;
  const loader = createSimilarQuestionsLoader({
    url: "https://example.test/similar.json",
    fetchImpl: async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return { ok: false, status: 503 };
      }
      return { ok: true, status: 200, json: async () => ({ source: {} }) };
    },
  });

  await assert.rejects(loader.load(), /HTTP 503/);
  assert.equal(loader.getPendingRequest(), null);
  assert.deepEqual(await loader.load(), { source: {} });
  assert.equal(fetchCount, 2);
});

test("candidate validation removes invalid, self, duplicate, and missing IDs", () => {
  const warnings = [];
  const candidates = buildSimilarCandidates({
    sourceQuestionId: "source",
    similarEntry: {
      top5: ["top-a", "", 42, "source", "shared", "shared", "missing-a"],
      additional: ["shared", "additional-a", null, "missing-b"],
    },
    validQuestionIds: new Set(["source", "top-a", "shared", "additional-a"]),
    onMissing: (questionId) => warnings.push(questionId),
  });

  assert.deepEqual(candidates, [
    { id: "top-a", weight: 3 },
    { id: "shared", weight: 3 },
    { id: "additional-a", weight: 1 },
  ]);
  assert.deepEqual(warnings, ["missing-a", "missing-b"]);
});

test("selection uses every valid candidate up to five and samples five above that", () => {
  for (let size = 0; size <= 5; size += 1) {
    const candidates = Array.from({ length: size }, (_, index) => ({
      id: `q${index}`,
      weight: index < 2 ? 3 : 1,
    }));
    const selected = selectSimilarQuestionIds({ candidates, random: () => 0 });
    assert.equal(selected.length, size);
    assert.deepEqual(new Set(selected), new Set(candidates.map(({ id }) => id)));
  }

  const candidates = Array.from({ length: 8 }, (_, index) => ({
    id: `q${index}`,
    weight: index < 5 ? 3 : 1,
  }));
  const selected = selectSimilarQuestionIds({ candidates, random: () => 0.25 });
  assert.equal(selected.length, 5);
  assert.equal(new Set(selected).size, 5);
});

test("weighted sampling honors top5 weight 3 versus additional weight 1", () => {
  const candidates = [
    { id: "top", weight: 3 },
    { id: "additional", weight: 1 },
  ];
  assert.deepEqual(
    weightedSampleWithoutReplacement(candidates, 1, () => 0.74),
    ["top"],
  );
  assert.deepEqual(
    weightedSampleWithoutReplacement(candidates, 1, () => 0.76),
    ["additional"],
  );
});

test("selected IDs are shuffled after weighted sampling", () => {
  const candidates = Array.from({ length: 6 }, (_, index) => ({
    id: String.fromCharCode(97 + index),
    weight: 1,
  }));
  const weightedOrder = weightedSampleWithoutReplacement(candidates, 5, () => 0);
  const selected = selectSimilarQuestionIds({ candidates, random: () => 0 });
  assert.deepEqual(weightedOrder, ["a", "b", "c", "d", "e"]);
  assert.notDeepEqual(selected, weightedOrder);
  assert.deepEqual(new Set(selected), new Set(weightedOrder));
});

test("return context is stored, expires after 24 hours, and can be cleared", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const locationLike = {
    href: "https://example.test/info1-quiz-app/app/",
    origin: "https://example.test",
    pathname: "/info1-quiz-app/app/",
    search: "",
    hash: "",
  };
  const createdAt = 1_000_000;
  const context = createSimilarReturnContext({
    sourceType: SIMILAR_SOURCE_TYPES.RESULT_LIST,
    sourceQuestionId: "source",
    returnUrl: `${locationLike.href}?view=summary#q3`,
    scrollY: 640,
    viewState: { view: "summary" },
    createdAt,
  });

  assert.equal(writeSimilarReturnContext(context, { storage, locationLike }), true);
  assert.equal(values.has(SIMILAR_RETURN_CONTEXT_KEY), true);
  assert.deepEqual(
    readSimilarReturnContext({ storage, locationLike, now: createdAt + 1000 }),
    {
      ...context,
      returnUrl: "/info1-quiz-app/app/?view=summary#q3",
    },
  );

  assert.equal(
    readSimilarReturnContext({
      storage,
      locationLike,
      now: createdAt + SIMILAR_RETURN_MAX_AGE_MS,
    }),
    null,
  );
  assert.equal(values.has(SIMILAR_RETURN_CONTEXT_KEY), false);

  writeSimilarReturnContext(context, { storage, locationLike });
  clearSimilarReturnContext({ storage });
  assert.equal(values.has(SIMILAR_RETURN_CONTEXT_KEY), false);
});

test("safe return URL stays on the current app page", () => {
  const locationLike = {
    href: "https://example.test/info1-quiz-app/app/?source=similar",
    origin: "https://example.test",
    pathname: "/info1-quiz-app/app/",
    search: "?source=similar",
    hash: "",
  };
  assert.equal(
    getSafeSimilarReturnUrl(
      "https://example.test/info1-quiz-app/app/?view=record#saved",
      locationLike,
    ),
    "/info1-quiz-app/app/?view=record#saved",
  );
  assert.equal(
    getSafeSimilarReturnUrl("https://attacker.test/elsewhere", locationLike),
    "/info1-quiz-app/app/?source=similar",
  );
});
