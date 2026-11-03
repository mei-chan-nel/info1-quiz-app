import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const tagSource = readFileSync(new URL("../app/tag-challenge.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");

function createLoader(now = 1000, appendError = false) {
  const scripts = [];
  const window = {};
  const document = {
    readyState: "loading",
    addEventListener() {},
    createElement() {
      const listeners = {};
      return {
        addEventListener(type, callback) { listeners[type] = callback; },
        fire(type) { listeners[type](); },
      };
    },
    head: {
      append(script) {
        if (appendError) throw new Error("Script blocked");
        scripts.push(script);
      },
    },
  };
  vm.runInNewContext(tagSource, { window, document, Date: { now: () => now } });
  return { load: window.Info1TagChallenge.loadTermGuides, window, scripts };
}

test("term registry shares one request and its result across consumers", async () => {
  const { load, scripts, window } = createLoader();
  const pending = load();
  assert.equal(load(), pending);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, "/assets/term-guides.js?v=1000");
  window.StudyAtlasTermGuides = Object.freeze({ DNS: { url: "/terms/dns/" } });
  scripts[0].fire("load");
  assert.equal(await pending, window.StudyAtlasTermGuides);
  assert.equal(await load(), window.StudyAtlasTermGuides);
  assert.equal(scripts.length, 1);
});

test("reloading the page fetches the updated registry with a new cache key", async () => {
  const first = createLoader(1000);
  const firstRequest = first.load();
  first.window.StudyAtlasTermGuides = { DNS: { url: "/terms/dns/" } };
  first.scripts[0].fire("load");
  await firstRequest;

  const second = createLoader(2000);
  second.window.StudyAtlasTermGuides = first.window.StudyAtlasTermGuides;
  const secondRequest = second.load();
  assert.notEqual(second.scripts[0].src, first.scripts[0].src);
  second.window.StudyAtlasTermGuides = { ...first.window.StudyAtlasTermGuides, URL: { url: "/terms/url/" } };
  second.scripts[0].fire("load");
  assert.equal((await secondRequest).URL.url, "/terms/url/");
});

test("network failure hides terms instead of reusing an old global or retrying per question", async () => {
  const { load, scripts, window } = createLoader();
  window.StudyAtlasTermGuides = { DNS: { url: "/terms/dns/" } };
  const pending = load();
  scripts[0].fire("error");
  assert.equal(Object.keys(await pending).length, 0);
  assert.equal(await load(), await pending);
  assert.equal(scripts.length, 1);
});

test("a missing registry or a blocked script also resolves to an empty mapping", async () => {
  const { load, scripts } = createLoader();
  const pending = load();
  scripts[0].fire("load");
  assert.equal(Object.keys(await pending).length, 0);
  assert.equal(Object.keys(await createLoader(1000, true).load()).length, 0);
});

function extractFunction(name) {
  const match = appSource.match(new RegExp(`function ${name}\\([\\s\\S]*?(?=\\nfunction |$)`));
  assert.ok(match, `${name} should exist`);
  return match[0];
}

function createRenderer(termGuides, choiceReasons = false) {
  return new Function(
    "state", "shouldShowChoiceReasonList", "buildExplanation", "renderQuestionLearningHistory", "formatChoice", "TEXT",
    `${extractFunction("escapeHtml")}
     ${extractFunction("renderSummaryRelatedTerms")}
     ${extractFunction("renderSummaryExplanation")}
     return { related: renderSummaryRelatedTerms, explanation: renderSummaryExplanation };`,
  )(
    { termGuides }, () => choiceReasons, () => "既存の解説", (id) => `<div>履歴：${id}</div>`,
    (choice) => choice.text, { answer: "正答" },
  );
}

test("only published guides for the individual question appear with correct new-tab links", () => {
  const { related } = createRenderer({
    ドメイン名: { url: "/terms/domain-name/" },
    DNS: { url: "/terms/dns/" },
    URL: { url: "/terms/url/" },
    未公開: {},
  });
  assert.equal(
    related({ tags: ["ドメイン名", "存在しないタグ", "DNS", "未公開"] }),
    '<p class="summary-related-terms"><strong>関連する用語</strong>：<a href="/terms/domain-name/" target="_blank" rel="noopener noreferrer">ドメイン名</a>、<a href="/terms/dns/" target="_blank" rel="noopener noreferrer">DNS</a></p>',
  );
  const second = related({ tags: ["URL"] });
  assert.match(second, /href="\/terms\/url\/"/);
  assert.doesNotMatch(second, /DNS|ドメイン名|、/);
  // Tag data is already normalized: do not add spelling or case matching.
  assert.equal(related({ tags: ["dns", " DNS "] }), "");
});

test("the entire item is absent for no matching tags, no tags, or a failed load", () => {
  const { related } = createRenderer({ DNS: { url: "/terms/dns/" } });
  assert.equal(related({ tags: ["用語解説なし"] }), "");
  assert.equal(related({ tags: [] }), "");
  assert.equal(related({}), "");
  assert.equal(createRenderer({}).related({ tags: ["DNS"] }), "");
});

test("term labels and URLs are escaped as HTML", () => {
  const html = createRenderer({ '<用語&"名>': { url: '/terms/test/?a=1&b="x"' } })
    .related({ tags: ['<用語&"名>'] });
  assert.match(html, /&lt;用語&amp;&quot;名&gt;/);
  assert.match(html, /href="\/terms\/test\/\?a=1&amp;b=&quot;x&quot;"/);
});

test("terms are between the unchanged explanation and history for both answer formats", () => {
  for (const choiceReasons of [false, true]) {
    const question = { id: "q1", tags: ["DNS"] };
    const html = createRenderer({ DNS: { url: "/terms/dns/" } }, choiceReasons)
      .explanation(question, {}, { text: "正解の選択肢" });
    assert.equal(html.includes("<p>正答: 正解の選択肢</p>"), !choiceReasons);
    assert.ok(html.indexOf('<p class="explanation">既存の解説</p>') < html.indexOf("関連する用語"));
    assert.ok(html.indexOf("関連する用語") < html.indexOf("<div>履歴：q1</div>"));
  }
});
