import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const generatedHtml = await readFile(new URL("../questions/index.html", import.meta.url), "utf8");
const filterScript = await readFile(new URL("../assets/question-filter.js", import.meta.url), "utf8");

test("全問題を装飾のないhidden-until-found wrapper内に静的生成する", () => {
  const shells = [...generatedHtml.matchAll(
    /<div class="filtered-question-shell"[^>]*hidden="until-found"[^>]*data-filter-question[^>]*data-question-id="([^"]+)"[^>]*>/g,
  )];
  const cards = generatedHtml.match(/<article class="question-card filtered-question-card">/g) || [];

  assert.equal(shells.length, 1_438);
  assert.equal(cards.length, shells.length);
  assert.equal(new Set(shells.map((match) => match[1])).size, shells.length);
});

test("通常の絞り込みリセットでも問題をText Fragmentの検索対象に保つ", () => {
  assert.match(filterScript, /card\.node\.setAttribute\("hidden", "until-found"\)/);
  assert.doesNotMatch(filterScript, /card\.node\.hidden\s*=\s*true/);
  assert.match(filterScript, /card\.node\.removeAttribute\("hidden"\)/);
});

test("beforematchで一致問題を強調しdetailsを開く", () => {
  assert.match(filterScript, /addEventListener\("beforematch"/);
  assert.match(filterScript, /event\.target\.closest\("\[data-filter-question\]"\)/);
  assert.match(filterScript, /card\.node\.classList\.add\("is-origin-question"\)/);
  assert.match(filterScript, /card\.node\.querySelectorAll\("details"\)/);
  assert.match(filterScript, /details\.open = true/);
});

test("JavaScript無効時も全問題を表示する上書きを生成する", () => {
  assert.match(
    generatedHtml,
    /<noscript><style>\.filtered-question-shell\[hidden="until-found"\] \{ display: block; content-visibility: visible; \} \.filtered-question-shell \+ \.filtered-question-shell \{ margin-top: 18px; \}<\/style><\/noscript>/,
  );
});
