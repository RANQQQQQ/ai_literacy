import { env } from "cloudflare:workers";
import rulesData from "../../rules.json";

type PolicyRule = {
  id: number;
  scene: string;
  action: string;
  verdict: string;
  level: "forbid" | "caution" | "allow";
  quote: string;
  source: string;
  sourceUrl: string;
  originalUrl?: string;
  publishedAt?: string;
  verifiedAt: string;
  tag: string;
};

type ChatTurn = { role: "user" | "assistant"; content: string };

const RULES = rulesData as PolicyRule[];
const requestWindows = new Map<string, { count: number; expiresAt: number }>();

function runtimeValue(key: string) {
  const workerEnv = env as unknown as Record<string, string | undefined>;
  return workerEnv[key] || process.env[key];
}

function isRateLimited(request: Request) {
  const client = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "local";
  const now = Date.now();
  const current = requestWindows.get(client);
  if (!current || current.expiresAt <= now) {
    requestWindows.set(client, { count: 1, expiresAt: now + 5 * 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 12;
}

function retrieveRules(query: string) {
  const normalized = query.toLowerCase().replace(/[?？,，。！!、《》“”‘’（）【】]/g, " ");
  const terms: string[] = [];
  normalized.split(/\s+/).filter(Boolean).forEach((word) => {
    if (/[\u4e00-\u9fff]/.test(word)) {
      for (let size = 2; size <= 4; size += 1) {
        for (let index = 0; index <= word.length - size; index += 1) {
          const term = word.slice(index, index + size);
          if (/[\u4e00-\u9fff]/.test(term)) terms.push(term);
        }
      }
    } else if (word.length > 1) {
      terms.push(word);
    }
  });

  const uniqueTerms = [...new Set(terms)];
  const tags = [...new Set(RULES.map((rule) => rule.tag))];
  const matchedTags = tags.filter((tag) => normalized.includes(tag.toLowerCase()));

  return RULES.map((rule) => {
    let score = matchedTags.includes(rule.tag) ? 6 : 0;
    uniqueTerms.forEach((term) => {
      if (rule.action.toLowerCase().includes(term)) score += 5;
      if (rule.tag.toLowerCase().includes(term)) score += 4;
      if (rule.scene.toLowerCase().includes(term)) score += 3;
      if (rule.quote.toLowerCase().includes(term)) score += 1;
      if (rule.source.toLowerCase().includes(term)) score += 1;
    });
    return { rule, score };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.rule.id - b.rule.id)
    .slice(0, 10)
    .map((item) => item.rule);
}

function buildSystemPrompt(rules: PolicyRule[]) {
  if (!rules.length) {
    return "你是高校图书馆AI使用规范咨询助手。规则库没有检索到与问题匹配的条目。请只回复：规则库中未收录该场景的明确规定，建议咨询任课教师或学院。不要添加其他知识。";
  }

  const context = rules.map((rule, index) =>
    `[规则${index + 1}]\n场景：${rule.scene}\n行为：${rule.action}\n结论：${rule.verdict}\n原文：${rule.quote}\n来源：${rule.source}\n发布/更新：${rule.publishedAt || "页面未注明"}\n核验日期：${rule.verifiedAt}\n来源链接：${rule.sourceUrl}${rule.originalUrl ? `\n机构原始链接：${rule.originalUrl}` : ""}`
  ).join("\n---\n");

  return `你是高校图书馆AI使用规范咨询助手，帮助大学生理解不同学术场景下的AI使用要求。\n\n以下是从规则库检索出的政策条目：\n\n${context}\n\n严格遵守：\n1. 只使用上述条目的内容，不得用训练知识补充政策事实。\n2. 每个政策判断必须标注文件名和条款编号或页码；来源中没有编号时不得创造。\n3. 规则未覆盖的问题，明确回答“规则库中未收录该场景的明确规定，建议咨询任课教师或学院”。\n4. 不猜测、不扩张解释、不把某一学校要求说成普遍规则。\n5. 若不同来源结论不同，如实并列差异。\n6. 回答语言与用户提问一致。\n7. 不输出思考过程。\n8. 结尾固定提示：以上回答仅基于规则库中的政策条款，具体以任课教师和所在院校最新规定为准。`;
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return Response.json({ error: "请求过于频繁，请稍后再试。" }, { status: 429 });
  }

  const apiKey = runtimeValue("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "DeepSeek 服务端密钥尚未配置。" }, { status: 503 });
  }

  let payload: { question?: string; history?: ChatTurn[] };
  try {
    payload = await request.json() as { question?: string; history?: ChatTurn[] };
  } catch {
    return Response.json({ error: "请求格式无效。" }, { status: 400 });
  }

  const question = payload.question?.trim() ?? "";
  if (!question || question.length > 600) {
    return Response.json({ error: "问题不能为空，且不能超过 600 个字符。" }, { status: 400 });
  }

  const history = Array.isArray(payload.history)
    ? payload.history.slice(-6).filter((turn) =>
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" && turn.content.length <= 1800
      )
    : [];
  const matchedRules = retrieveRules(question);
  const apiBase = (runtimeValue("DEEPSEEK_API_BASE") || "https://api.deepseek.com").replace(/\/$/, "");
  const model = runtimeValue("DEEPSEEK_MODEL") || "deepseek-chat";

  try {
    const upstream = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(matchedRules) },
          ...history,
          { role: "user", content: question },
        ],
        temperature: 0.05,
        max_tokens: 1100,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const message = upstream.status === 401
        ? "DeepSeek 密钥无效或已失效。"
        : `DeepSeek 服务暂时不可用（${upstream.status}）。`;
      return Response.json({ error: message }, { status: 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Rule-Ids": matchedRules.map((rule) => rule.id).join(","),
      },
    });
  } catch {
    return Response.json({ error: "无法连接 DeepSeek，请稍后重试。" }, { status: 502 });
  }
}
