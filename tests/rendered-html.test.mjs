import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isAssistantHelpQuestion, parseRuleIds } from "../app/chat-logic.mjs";

test("does not turn an empty citation header into rule zero", () => {
  assert.deepEqual(parseRuleIds(null), []);
  assert.deepEqual(parseRuleIds(""), []);
  assert.deepEqual(parseRuleIds("   "), []);
  assert.deepEqual(parseRuleIds("0,4,12"), [0, 4, 12]);
  assert.deepEqual(parseRuleIds("0,,bad,-1,2.5,7"), [0, 7]);
});

test("recognizes assistant identity and usage questions", () => {
  assert.equal(isAssistantHelpQuestion("你是谁"), true);
  assert.equal(isAssistantHelpQuestion("这个工具怎么用？"), true);
  assert.equal(isAssistantHelpQuestion("What can you do?"), true);
  assert.equal(isAssistantHelpQuestion("课程作业可以使用 AI 吗？"), false);
});

test("keeps DeepSeek generation and policy grounding in the server route", async () => {
  const route = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /\/chat\/completions/);
  assert.match(route, /model,/);
  assert.match(route, /stream:\s*true/);
  assert.match(route, /X-AI-Provider/);
  assert.match(route, /规则库没有检索到与问题匹配的条目/);
  assert.match(route, /不能用训练知识补充或杜撰/);
  assert.match(route, /Access-Control-Allow-Origin/);
  assert.match(route, /https:\/\/ranqqqqq\.github\.io/);
});

test("keeps the GitHub Pages frontend connected to the protected backend", async () => {
  const [page, config, workflow] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
  ]);
  assert.match(page, /NEXT_PUBLIC_CHAT_API_URL/);
  assert.match(config, /output:\s*"export"/);
  assert.match(config, /basePath:\s*"\/ai_literacy"/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});

test("renders assistant Markdown instead of exposing Markdown as a preformatted string", async () => {
  const [page, styles, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /from "react-markdown"/);
  assert.match(page, /remarkPlugins=\{\[remarkGfm\]\}/);
  assert.doesNotMatch(page, /<pre>\{message\.content\}<\/pre>/);
  assert.match(styles, /\.markdownBody h3/);
  assert.match(styles, /\.markdownBody table/);
  assert.match(route, /分段标题用“### 标题”/);
});
