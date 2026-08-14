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
});
