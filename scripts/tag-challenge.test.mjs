import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../app/tag-challenge.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
const filterSource = readFileSync(new URL("../assets/question-filter.js", import.meta.url), "utf8");
const searchHtml = readFileSync(new URL("../questions/index.html", import.meta.url), "utf8");
const legacyTagsHtml = readFileSync(new URL("../questions/tags.html", import.meta.url), "utf8");

function extractAppFunction(name, nextName) {
  const pattern = new RegExp(
    `(?:async )?function ${name}\\([\\s\\S]*?(?=\\r?\\n(?:async )?function ${nextName}\\()`
  );
  const match = appSource.match(pattern);
  assert.ok(match, `${name} should exist`);
  return match[0].trim();
}

function createApi() {
  const values = new Map();
  const window = {
    location: {
      href: "https://mei-chan-nel.com/info1-quiz-app/app/",
      origin: "https://mei-chan-nel.com",
    },
    sessionStorage: {
      getItem(key) {
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
      removeItem(key) {
        values.delete(key);
      },
    },
  };
  const context = vm.createContext({ URL, window, console });
  vm.runInContext(source, context, { filename: "tag-challenge.js" });
  return { api: window.Info1TagChallenge, values };
}

function context(overrides = {}) {
  return {
    version: 1,
    source: "tag-search",
    candidateQuestionIds: ["A", "B", "C", "D"],
    questionCount: 2,
    currentQuestionIds: ["A", "B"],
    returnUrl: "https://mei-chan-nel.com/info1-quiz-app/questions/#tag=暗号化",
    createdAt: "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

test("tag challenge context is stored, validated, and read back", () => {
  const { api, values } = createApi();
  const original = context();

  assert.equal(api.writeContext(original), true);
  assert.deepEqual(JSON.parse(JSON.stringify(api.readContext())), original);
  assert.ok(values.has(api.CONTEXT_KEY));

  assert.equal(api.writeContext(context({ source: "other" })), false);
  values.set(api.CONTEXT_KEY, JSON.stringify(context({ currentQuestionIds: ["missing", "B"] })));
  assert.equal(api.readContext(), null);
});

test("safe return URL keeps the same-origin tag search hash and rejects external paths", () => {
  const { api } = createApi();

  assert.equal(
    api.getSafeReturnUrl(
      "https://mei-chan-nel.com/info1-quiz-app/questions/?x=1#tag=暗号化",
    ),
    "/info1-quiz-app/questions/?x=1#tag=%E6%9A%97%E5%8F%B7%E5%8C%96",
  );
  assert.equal(
    api.getSafeReturnUrl("https://example.com/info1-quiz-app/questions/#tag=暗号化"),
    "/info1-quiz-app/questions/",
  );
  assert.equal(
    api.getSafeReturnUrl("https://mei-chan-nel.com/"),
    "/info1-quiz-app/questions/",
  );
});

test("safe return URL follows the app-relative search path in a standalone local server", () => {
  const { api } = createApi();
  const localLocation = {
    href: "http://127.0.0.1:8765/app/",
    origin: "http://127.0.0.1:8765",
  };

  assert.equal(
    api.getSafeReturnUrl("/questions/?x=1#tag=暗号化", localLocation),
    "/questions/?x=1#tag=%E6%9A%97%E5%8F%B7%E5%8C%96",
  );
  assert.equal(
    api.getSafeReturnUrl("https://example.com/questions/#tag=暗号化", localLocation),
    "/questions/",
  );
  assert.equal(
    api.getSafeReturnUrl("/info1-quiz-app/questions/#tag=暗号化", localLocation),
    "/questions/",
  );
});

test("Fisher-Yates shuffle returns a bounded, duplicate-free selection", () => {
  const { api } = createApi();
  const shuffled = api.shuffle(["A", "B", "C", "D"], () => 0);

  assert.deepEqual(Array.from(shuffled), ["B", "C", "D", "A"]);
  assert.equal(new Set(shuffled).size, 4);
  assert.equal(api.sameSet(["A", "B"], ["B", "A"]), true);
  assert.equal(api.sameSet(["A", "B"], ["A", "C"]), false);
});

test("clearing the context removes the tag-only session state", () => {
  const { api, values } = createApi();
  api.writeContext(context());
  api.clearContext();
  assert.equal(values.has(api.CONTEXT_KEY), false);
  assert.equal(api.readContext(), null);
});

test("tag page exposes the count controls and shared challenge helper", () => {
  assert.match(searchHtml, /data-tag-challenge-controls/);
  assert.match(searchHtml, /data-tag-challenge-count/);
  assert.match(searchHtml, /class="tag-challenge-count-display"/);
  assert.match(searchHtml, /data-tag-challenge-start/);
  assert.match(searchHtml, /src="\.\.\/app\/tag-challenge\.js\?v=\d+"/);
  assert.match(legacyTagsHtml, /noindex,follow/);
  assert.match(filterSource, /アプリでランダムに出題/);
  assert.doesNotMatch(filterSource, /tagChallengeQuestionCount\}問をランダムに出題/);
});

test("tag challenge parser accepts the full candidate list", () => {
  const functionSource = extractAppFunction(
    "parseChallengeQuestionIds",
    "resolveChallengeQuestions",
  );
  const parseChallengeQuestionIds = new Function(
    "MAX_SHARED_QUESTIONS",
    `${functionSource}; return parseChallengeQuestionIds;`,
  )(10);
  const ids = Array.from({ length: 12 }, (_, index) => `Q${index + 1}`);

  assert.deepEqual(parseChallengeQuestionIds(ids.join(","), Number.POSITIVE_INFINITY), ids);
  assert.equal(parseChallengeQuestionIds(ids.join(",")).length, 10);
});

test("tag retry avoids the previous set when possible and reshuffles a full set", () => {
  const functionSource = extractAppFunction(
    "selectTagChallengeQuestionIds",
    "writeTagChallengeContext",
  );
  const normalizeIds = (values) => [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  const sameSet = (left, right) => {
    const rightSet = new Set(right);
    return left.length === right.length && left.every((value) => rightSet.has(value));
  };
  let shuffleCalls = 0;
  const tagChallenge = {
    normalizeIds,
    sameSet,
    shuffle(values) {
      shuffleCalls += 1;
      return shuffleCalls === 1 ? [...values] : [values[1], values[0], ...values.slice(2)];
    },
  };
  const selectTagChallengeQuestionIds = new Function(
    "tagChallenge",
    `${functionSource}; return selectTagChallengeQuestionIds;`,
  )(tagChallenge);

  assert.deepEqual(
    selectTagChallengeQuestionIds(["A", "B", "C"], 1, ["A"]),
    ["B"],
  );
  assert.equal(shuffleCalls, 2);

  shuffleCalls = 0;
  tagChallenge.shuffle = (values) => {
    shuffleCalls += 1;
    return [values[1], values[0], ...values.slice(2)];
  };
  assert.deepEqual(
    selectTagChallengeQuestionIds(["A", "B"], 2, ["A", "B"]),
    ["B", "A"],
  );
  assert.equal(shuffleCalls, 1);
});
