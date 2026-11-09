import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("../questions/index.html", import.meta.url), "utf8");
const source = await readFile(new URL("../assets/question-filter.js", import.meta.url), "utf8");
const payload = JSON.parse(await readFile(new URL("../questions/filter-data.json", import.meta.url), "utf8"));
const original = JSON.parse(await readFile(new URL("../data/questions/completed_questions.json", import.meta.url), "utf8"));

// Exercise the same pure matching functions used by the UI against the entire dataset.
const functionNames = ["normalizeText", "searchTerms", "hasConditions", "matchesSelection", "matchingCards"];
const functions = functionNames.map((name) => {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf("\n  }", start) + 4;
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end);
}).join("\n");
const context = vm.createContext({});
vm.runInContext(`${functions}\nthis.normalize = normalizeText; this.match = (cardsValue, keywordValue, fieldsValue, selectedValue = []) => {
  cards = cardsValue; keyword = keywordValue; fields = fieldsValue; selected = selectedValue;
  return hasConditions() ? matchingCards().map(card => card.id) : [];
};`, context);
const normalize = context.normalize;
const cards = payload.questions.map((question) => ({...question, search: {
  stem: normalize(question.stem),
  choices: normalize(question.choices.map((choice) => choice.text).join("\n")),
  explanation: normalize([question.explanation, ...question.choices.map((choice) => choice.explanation)].join("\n")),
}}));
const match = (keyword, fields, selected = []) => Array.from(context.match(cards, keyword, fields, selected));

test("all question and choice text, IDs, and explanations survive generation in newest-first order", () => {
  assert.deepEqual(payload.questions.map(q => q.id), [...original].reverse().map(q => q.id));
  for (const [index, q] of payload.questions.entries()) {
    const expected = original[original.length - 1 - index];
    assert.equal(q.stem, expected.stem);
    assert.equal(q.answer_choice_id, expected.answer_choice_id);
    assert.equal(q.explanation, String(expected.explanation || "").trim());
    assert.deepEqual(q.choices, expected.choices.map(c => Object.fromEntries(
      ["choice_id", "label", "text", "explanation"].map(key => [key, String(c[key] || "")]),
    )));
  }
});

test("initial HTML has no question DOM or removed term descriptions, and defaults to keyword search", () => {
  assert.doesNotMatch(html, /data-filter-question|tag-term-summary|tag-term-guide-link/);
  assert.match(html, /data-keyword-panel open/);
  assert.match(html, /<details class="facet-panel">/);
  assert.match(html, /value="stem" data-search-field checked/);
  assert.match(html, /value="choices" data-search-field checked/);
  assert.match(html, /value="explanation" data-search-field \/>/);
  assert.match(html, /aria-labelledby="filter-results-heading" hidden/);
  assert.match(html, /data-filter-data="\.\/filter-data.json\?v=[a-f0-9]+"/);
});

test("empty keywords or no selected fields produce no results", () => {
  assert.deepEqual(match("　 \t", ["stem", "choices"]), []);
  assert.deepEqual(match("情報", []), []);
});

test("AND terms can match across selected fields and normalize Japanese/Latin spacing and width", () => {
  const fixtures = [{ id: "yes", tags: [], search: {stem: normalize("ＡＢＣ　情報"), choices: normalize("選択肢"), explanation: ""} },
    { id: "no", tags: [], search: {stem: "abc", choices: "", explanation: ""} }];
  assert.deepEqual(Array.from(context.match(fixtures, "abc　選択肢", ["stem", "choices"])), ["yes"]);
  assert.deepEqual(Array.from(context.match(fixtures, "abc 選択肢", ["stem"])), []);
});

test("every general and choice explanation is searchable even when not present in stem/choices", () => {
  let uniqueChoiceReasons = 0;
  for (const card of cards) {
    for (const text of [card.explanation, ...card.choices.map(choice => choice.explanation)]) {
      if (!normalize(text)) continue;
      const terms = normalize(text).split(/\s+/u);
      const hits = match(text, ["explanation"]);
      assert.ok(hits.includes(card.id), `${card.id}: missing explanation`);
      if (!terms.every(term => `${card.search.stem}\n${card.search.choices}`.includes(term))) {
        uniqueChoiceReasons++;
        assert.ok(!match(text, ["stem", "choices"]).includes(card.id));
      }
    }
  }
  assert.ok(uniqueChoiceReasons > 0);
});

test("each public tag and tag intersection returns all matching source questions", () => {
  const tags = [...new Set(cards.flatMap(card => card.tags))];
  for (const tag of tags) {
    assert.deepEqual(match("", ["stem", "choices"], [tag]), cards.filter(card => card.tags.includes(tag)).map(card => card.id));
  }
  for (const card of cards.filter(card => card.tags.length > 1).slice(0, 30)) {
    const selected = card.tags.slice(0, 2);
    assert.deepEqual(match("", [], selected), cards.filter(item => selected.every(tag => item.tags.includes(tag))).map(item => item.id));
  }
});
