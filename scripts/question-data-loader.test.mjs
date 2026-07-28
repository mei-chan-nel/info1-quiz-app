import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../app/question-data.js", import.meta.url), "utf8");

function createContext(fetchImplementation) {
  const window = {
    location: { href: "https://example.test/info1-quiz-app/app/" },
  };
  const context = vm.createContext({
    URL,
    TypeError,
    fetch: fetchImplementation,
    window,
  });
  vm.runInContext(source, context, { filename: "question-data.js" });
  return context.window.StudyAtlasQuestionData;
}

test("concurrent consumers share one fetch, one JSON parse, and one cached array", async () => {
  let fetchCount = 0;
  let parseCount = 0;
  const questions = [{ id: "q-1" }];
  const loader = createContext(async () => {
    fetchCount += 1;
    return {
      ok: true,
      async json() {
        parseCount += 1;
        return questions;
      },
    };
  });

  const [forApp, forIssueReport] = await Promise.all([loader.load(), loader.load()]);
  const cached = await loader.load();

  assert.equal(fetchCount, 1);
  assert.equal(parseCount, 1);
  assert.equal(forApp, forIssueReport);
  assert.equal(forApp, cached);
  assert.deepEqual(forApp, questions);
});

test("a failed request clears the pending Promise so the next call can retry", async () => {
  let fetchCount = 0;
  const loader = createContext(async () => {
    fetchCount += 1;
    if (fetchCount === 1) {
      throw new Error("temporary failure");
    }
    return { ok: true, async json() { return [{ id: "q-2" }]; } };
  });

  await assert.rejects(loader.load(), /temporary failure/);
  assert.deepEqual(await loader.load(), [{ id: "q-2" }]);
  assert.equal(fetchCount, 2);
});
