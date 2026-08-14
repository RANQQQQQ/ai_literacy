"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseRuleIds } from "./chat-logic.mjs";
import rulesData from "./rules.json";
import policiesData from "./policies.json";

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

type PolicyDocument = {
  section: string;
  subsection: string;
  text: string;
  date: string;
  links: string[];
  preferredUrl: string;
  new: boolean;
};

type PublisherPolicy = {
  publisher: string;
  url: string;
  clauses: string[];
};

type PolicyCatalogue = {
  retrievedAt: string;
  mainArticleDate: string;
  sourceUrl: string;
  documents: PolicyDocument[];
  publisherPolicies: PublisherPolicy[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ruleIds?: number[];
  error?: boolean;
};

const RULES = rulesData as PolicyRule[];
const POLICY_CATALOGUE = policiesData as PolicyCatalogue;
const SOURCE_URL = "https://lib.cnu.edu.cn/static/site/view/ai/com";
const RULE_TOTAL = RULES.length;
const DOCUMENT_TOTAL = POLICY_CATALOGUE.documents.length;
const PUBLISHER_TOTAL = POLICY_CATALOGUE.publisherPolicies.length;
const LEVEL_COUNTS = {
  forbid: RULES.filter((rule) => rule.level === "forbid").length,
  caution: RULES.filter((rule) => rule.level === "caution").length,
  allow: RULES.filter((rule) => rule.level === "allow").length,
};
const SCENES = ["", "本科毕业论文", "课程作业", "科研活动", "日常学习", "通用"];
const LEVELS = [
  { value: "", label: "全部结论" },
  { value: "forbid", label: "禁止" },
  { value: "caution", label: "有限使用" },
  { value: "allow", label: "允许" },
];
const TOPIC_ORDER = [
  "正文撰写与代写", "伦理与合规", "声明与披露", "批判性评估AI", "数据隐私与安全",
  "AI素养与规范使用", "其他规范要求", "文献检索与整理", "图像与图表生成", "语言润色与翻译",
  "日常学习辅助", "课程作业使用", "数据分析与统计", "辅助写作与构思", "同行评议与审稿",
  "未成年人使用", "数据伪造与篡改", "列AI为作者", "研究设计与方案", "学术诚信违规",
  "AI工具选用与备案", "申报材料生成",
];
const STAGES = [
  "文献检索与整理", "语法校对与语言润色", "思路拓展与头脑风暴", "格式规范与参考文献整理",
  "翻译辅助", "数据可视化辅助", "代码调试辅助", "报告框架辅助", "访谈记录整理", "其他",
];
const CHAT_EXAMPLES = [
  "我在写课程论文，能用AI帮我润色语言吗？",
  "毕业论文里用AI做数据分析会怎样？",
  "科研论文投稿前用AI润色英文，需要声明吗？",
  "Can I use AI to generate images for my paper?",
];

function messageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function Mark({ text, query }: { text: string; query: string }) {
  const clean = query.trim();
  if (!clean) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = clean.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let index = lowerText.indexOf(lowerQuery);
  while (index >= 0) {
    parts.push(text.slice(cursor, index));
    parts.push(<mark key={`${index}-${cursor}`}>{text.slice(index, index + clean.length)}</mark>);
    cursor = index + clean.length;
    index = lowerText.indexOf(lowerQuery, cursor);
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export default function Home() {
  const [tab, setTab] = useState<"rules" | "catalogue" | "declaration" | "chat">("rules");
  const [query, setQuery] = useState("");
  const [scene, setScene] = useState("");
  const [level, setLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [expandedRule, setExpandedRule] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(60);
  const [declType, setDeclType] = useState<"course" | "thesis" | "research">("course");
  const [form, setForm] = useState({ title: "", tool: "", time: "", stage: "", author: "", purpose: "" });
  const [generated, setGenerated] = useState("");
  const [copyStatus, setCopyStatus] = useState("复制全文");
  const [ask, setAsk] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [catalogueSection, setCatalogueSection] = useState("全部");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    RULES.forEach((rule) => counts.set(rule.tag, (counts.get(rule.tag) || 0) + 1));
    const names = [...TOPIC_ORDER.filter((name) => counts.has(name)), ...[...counts.keys()].filter((name) => !TOPIC_ORDER.includes(name))];
    return names.map((name) => ({ name, count: counts.get(name) || 0 }));
  }, []);

  const catalogueDocuments = useMemo(() => POLICY_CATALOGUE.documents.filter((document) =>
    catalogueSection === "全部" || document.section === catalogueSection
  ), [catalogueSection]);

  function resolveSourceUrl(url: string) {
    if (!url) return SOURCE_URL;
    return url.startsWith("http") ? url : `https://lib.cnu.edu.cn${url}`;
  }

  const results = useMemo(() => {
    const base = RULES.filter((rule) =>
      (!scene || rule.scene === scene) &&
      (!level || rule.level === level) &&
      (!topic || rule.tag === topic)
    );
    const clean = query.trim().toLowerCase();
    if (!clean) return base;
    return base.map((rule) => {
      let score = 0;
      if (rule.action.toLowerCase().includes(clean)) score += 5;
      if (rule.tag.toLowerCase().includes(clean)) score += 4;
      if (rule.quote.toLowerCase().includes(clean)) score += 3;
      if (rule.source.toLowerCase().includes(clean)) score += 2;
      if (rule.scene.toLowerCase().includes(clean)) score += 1;
      return { rule, score };
    }).filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.rule.id - b.rule.id)
      .map((item) => item.rule);
  }, [query, scene, level, topic]);

  const ruleMap = useMemo(() => new Map(RULES.map((rule) => [rule.id, rule])), []);

  useEffect(() => setVisibleCount(60), [query, scene, level, topic]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isAsking]);

  function generateDeclaration() {
    const title = form.title.trim() || "[论文 / 作业题目]";
    const tool = form.tool.trim() || "[AI工具名称及版本]";
    const time = form.time.trim() || "[使用时间]";
    const stage = form.stage.trim() || "[使用环节]";
    const author = form.author.trim() || "[作者姓名]";
    const purpose = form.purpose.trim() || "[具体用途]";
    const detail = `使用工具：${tool}\n使用时间：${time}\n使用环节：${stage}\n具体用途：${purpose}`;

    if (declType === "thesis") {
      setGenerated(`AIGC工具使用声明\n\n论文题目：${title}\n作者：${author}\n\n本人在撰写上述毕业论文期间使用了生成式人工智能工具，现将实际使用情况披露如下：\n\n${detail}\n\n本人确认：AI仅参与上述已说明环节；论文的核心学术贡献、事实核查、观点判断与最终表述由本人负责。是否需要提交提示词、修改记录或其他材料，请以本校、本院系及指导教师的最新要求为准。\n\n作者签名：___________\n日期：___________`);
    } else if (declType === "research") {
      setGenerated(`人工智能使用披露声明\n\n成果题目：${title}\n作者：${author}\n\n本研究使用了生成式人工智能工具，现如实披露如下：\n\n${detail}\n\n研究者已对AI辅助内容进行人工核查与修改，并对研究设计、数据、分析、引用及最终成果承担责任。投稿或提交前，请进一步核对资助机构、伦理审查、期刊和所在单位的适用规定。\n\n作者签名：___________\n日期：___________`);
    } else {
      setGenerated(`AI使用情况说明\n\n题目：${title}\n作者：${author}\n\n${detail}\n\n本人已对AI辅助内容进行核查与修改，并对最终提交内容承担责任。AI使用是否获准、是否需要引用或披露、是否存在比例或材料留存要求，均以任课教师、课程说明及学校最新规定为准。\n\n作者签名：___________\n日期：___________`);
    }
  }

  function resetDeclaration() {
    setForm({ title: "", tool: "", time: "", stage: "", author: "", purpose: "" });
    setGenerated("");
    setCopyStatus("复制全文");
  }

  async function copyDeclaration() {
    await navigator.clipboard?.writeText(generated);
    setCopyStatus("已复制 ✓");
    window.setTimeout(() => setCopyStatus("复制全文"), 1800);
  }

  async function submitQuestion(rawQuestion?: string) {
    const question = (rawQuestion ?? ask).trim();
    if (!question || isAsking) return;
    setTab("chat");
    setAsk("");
    setIsAsking(true);

    const userMessage: ChatMessage = { id: messageId(), role: "user", content: question };
    const assistantId = messageId();
    const assistantMessage: ChatMessage = { id: assistantId, role: "assistant", content: "" };
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({ error: "问答服务暂时不可用。" })) as { error?: string };
        throw new Error(data.error || "问答服务暂时不可用。");
      }

      const ruleIds = parseRuleIds(response.headers.get("X-Rule-Ids"));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let inThinking = false;

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
            let content = parsed.choices?.[0]?.delta?.content || "";
            if (content.includes("<think>")) { inThinking = true; content = content.replaceAll("<think>", ""); }
            if (content.includes("</think>")) { inThinking = false; content = content.replaceAll("</think>", ""); }
            if (!inThinking && content) {
              answer += content;
              setMessages((current) => current.map((message) =>
                message.id === assistantId ? { ...message, content: answer, ruleIds } : message
              ));
            }
          } catch {
            // Ignore incomplete or provider-specific SSE events.
          }
        }
      }

      if (!answer) throw new Error("DeepSeek 未返回有效回答。");
    } catch (error) {
      const content = error instanceof Error ? error.message : "问答服务暂时不可用。";
      setMessages((current) => current.map((message) =>
        message.id === assistantId ? { ...message, content, error: true } : message
      ));
    } finally {
      setIsAsking(false);
    }
  }

  function interpretSearch() {
    const subject = query.trim() || topic || "当前筛选结果";
    const selectedScene = scene || "全部场景";
    void submitQuestion(`请解读关于「${subject}」的AI使用规则（场景：${selectedScene}），并说明不同来源的结论差异和需要核验的事项。`);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brandMark">规</span><div><strong>AI 使用规范工具</strong><small>{RULE_TOTAL} 条已核验规则 · {DOCUMENT_TOTAL} 项现行目录</small></div></div>
        <nav aria-label="主要功能">
          <button className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")}>规则检索</button>
          <button className={tab === "catalogue" ? "active" : ""} onClick={() => setTab("catalogue")}>政策目录</button>
          <button className={tab === "declaration" ? "active" : ""} onClick={() => setTab("declaration")}>声明生成</button>
          <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>智能问答</button>
        </nav>
      </header>

      <section className="hero compactHero">
        <div><span className="eyebrow">当前目录 · 独立拆解 · 来源可核验</span><h1>先找到依据，再决定怎样使用 AI</h1><p>按现行网页重新核验政策目录，只把能够读取到当前原文的内容拆成规则；参考原型仅用于功能与交互逻辑。</p></div>
        <div className="heroStats"><div><strong>{RULE_TOTAL}</strong><span>已核验规则</span></div><div><strong>{DOCUMENT_TOTAL}</strong><span>目录政策</span></div><div><strong>{PUBLISHER_TOTAL}</strong><span>出版机构</span></div></div>
      </section>

      <div className="sourceNotice"><span className="statusDot" /><p><strong>数据边界：</strong>{POLICY_CATALOGUE.retrievedAt} 重新访问原栏目，记录 {DOCUMENT_TOTAL} 项政策入口和 {PUBLISHER_TOTAL} 个出版机构规则。当前 {RULE_TOTAL} 条规则均从可读取原文重新拆分；仅有目录、尚未核验正文的文件不会被写成规则。</p><a href={SOURCE_URL} target="_blank" rel="noreferrer">访问当前政策库 ↗</a></div>

      {tab === "rules" && <section className="workspace searchLayout">
        <aside className="sidebar">
          <div className="sideTitle"><span>按主题筛选</span><small>共 {topics.length} 类</small></div>
          <button className={!topic ? "selectedTopic" : ""} onClick={() => setTopic("")}><span>全部主题</span><b>{RULE_TOTAL}</b></button>
          {topics.map(({ name, count }) => <button key={name} className={topic === name ? "selectedTopic" : ""} onClick={() => setTopic(topic === name ? "" : name)}><span>{name}</span><b>{count}</b></button>)}
        </aside>

        <div className="contentPanel">
          <div className="searchBox">
            <label htmlFor="rule-search">搜索规则条目</label>
            <div className="searchRow enhancedSearch"><input id="rule-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") setExpandedRule(results[0]?.id ?? null); }} placeholder="输入关键词，支持中英文、行为、条款原文和来源……" /><button onClick={() => setExpandedRule(results[0]?.id ?? null)}>检索</button><button className="aiInterpret" disabled={!query.trim() && !topic} onClick={interpretSearch}>AI 解读</button></div>
            <div className="filterGroups"><div className="filterRow"><span>场景</span>{SCENES.map((item) => <button key={item || "all"} className={scene === item ? "selected" : ""} onClick={() => setScene(item)}>{item || "全部场景"}</button>)}</div><div className="filterRow"><span>结论</span>{LEVELS.map((item) => <button key={item.value || "all"} className={level === item.value ? "selected" : ""} onClick={() => setLevel(item.value)}>{item.label}</button>)}</div></div>
          </div>

          <div className="resultMeta"><div className="distribution"><span className="red" />禁止 {LEVEL_COUNTS.forbid} <span className="amber" />有限使用 {LEVEL_COUNTS.caution} <span className="green" />允许 {LEVEL_COUNTS.allow}</div><span>{query || scene || level || topic ? <>找到 <strong>{results.length}</strong> 条</> : <>共 <strong>{RULE_TOTAL}</strong> 条</>}</span></div>
          <div className="cards">
            {results.length === 0 ? <div className="emptyState"><strong>未找到相关规则</strong><p>请缩短关键词，或取消部分场景、结论与主题筛选。</p></div> : results.slice(0, visibleCount).map((rule) => <article className={`policyCard rule-${rule.level}`} key={rule.id}>
              <button className="cardHead ruleHead" onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)} aria-expanded={expandedRule === rule.id}>
                <span className={`verdict verdict-${rule.level}`}>{rule.verdict}</span><span className="cardTitle"><Mark text={rule.action} query={query} /></span><span className="cardTags"><span>{rule.tag}</span><span>{rule.scene}</span></span><span className="chevron">{expandedRule === rule.id ? "−" : "+"}</span>
              </button>
              {expandedRule === rule.id && <div className="cardBody ruleBody"><blockquote><Mark text={rule.quote} query={query} /></blockquote><div className="ruleSource"><span>来源</span><a href={rule.sourceUrl} target="_blank" rel="noreferrer"><Mark text={rule.source} query={query} /> ↗</a>{rule.originalUrl && <a href={rule.originalUrl} target="_blank" rel="noreferrer">机构原始页面 ↗</a>}<small>{rule.publishedAt && `发布/更新：${rule.publishedAt} · `}核验：{rule.verifiedAt}</small></div><button className="textButton" onClick={() => { setQuery(rule.action); void submitQuestion(`请解读规则「${rule.action}」（场景：${rule.scene}）。请基于规则原文说明结论、适用边界、不同来源的差异和需要核验的事项。`); }}>用 AI 解读这条规则</button></div>}
            </article>)}
            {results.length > visibleCount && <button className="loadMore" onClick={() => setVisibleCount((count) => count + 60)}>继续显示（剩余 {results.length - visibleCount} 条）</button>}
          </div>
        </div>
      </section>}

      {tab === "catalogue" && <section className="workspace cataloguePanel">
        <div className="sectionHeading"><span className="sectionIcon">录</span><div><h2>当前政策目录</h2><p>目录完整记录网页当前入口；规则库只收录已经读取并核验正文的条款。</p></div></div>
        <div className="auditSummary"><div><strong>{DOCUMENT_TOTAL}</strong><span>政策入口</span></div><div><strong>{PUBLISHER_TOTAL}</strong><span>出版机构</span></div><div><strong>{POLICY_CATALOGUE.documents.filter((item) => item.new).length}</strong><span>网站“新”标记</span></div><p>抓取核验日期：{POLICY_CATALOGUE.retrievedAt}<br />目录页标注日期：{POLICY_CATALOGUE.mainArticleDate}</p></div>
        <div className="catalogueFilters">{["全部", "政府", "行业组织", "高校", "科研院所"].map((item) => <button key={item} className={catalogueSection === item ? "selected" : ""} onClick={() => setCatalogueSection(item)}>{item}</button>)}</div>
        <div className="catalogueGrid">{catalogueDocuments.map((document, index) => <article className="documentCard" key={`${document.text}-${index}`}><div className="documentMeta"><span>{document.section}</span>{document.date && <time>{document.date}</time>}{document.new && <b>网站标记为新</b>}</div><h3>{document.text}</h3><a href={resolveSourceUrl(document.preferredUrl || SOURCE_URL)} target="_blank" rel="noreferrer">查看已核对来源 ↗</a></article>)}</div>
        <div className="publisherSection"><div className="sectionHeading compactHeading"><span className="sectionIcon">刊</span><div><h2>出版机构与出版伦理规则</h2><p>来自该专题的独立出版机构页面；摘要只展示网站现有文本。</p></div></div><div className="catalogueGrid publisherGrid">{POLICY_CATALOGUE.publisherPolicies.map((policy) => <article className="documentCard publisherCard" key={policy.publisher}><div className="documentMeta"><span>出版机构</span><b>{policy.clauses.length} 条摘要</b></div><h3>{policy.publisher}</h3><p>{policy.clauses[0]}</p><a href={policy.url || SOURCE_URL} target="_blank" rel="noreferrer">查看机构页面 ↗</a></article>)}</div></div>
      </section>}

      {tab === "declaration" && <section className="workspace singlePanel">
        <div className="sectionHeading"><span className="sectionIcon">文</span><div><h2>AI 使用声明生成器</h2><p>按课程作业、毕业论文或科研活动生成不同结构的可编辑声明。</p></div></div>
        <div className="typeTabs"><button className={declType === "course" ? "selected" : ""} onClick={() => setDeclType("course")}>课程作业</button><button className={declType === "thesis" ? "selected" : ""} onClick={() => setDeclType("thesis")}>毕业论文</button><button className={declType === "research" ? "selected" : ""} onClick={() => setDeclType("research")}>科研活动</button></div>
        <div className="formGrid"><label className="wide">论文 / 作业题目<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例：《社交媒体中的AI使用规范研究》" /></label><label>AI 工具名称及版本<input value={form.tool} onChange={(event) => setForm({ ...form, tool: event.target.value })} placeholder="例：DeepSeek / 模型版本" /></label><label>使用时间<input value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} placeholder="例：2026年5月" /></label><label>使用环节<select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}><option value="">请选择</option>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label><label>作者姓名<input value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="例：张三" /></label><label className="wide">具体用途描述<textarea value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} placeholder="如实说明AI参与了什么、本人如何核查和修改" /></label></div>
        <button className="primaryButton" onClick={generateDeclaration}>生成声明文本</button>
        {generated && <div className="generated"><div><strong>生成结果</strong><span><button onClick={copyDeclaration}>{copyStatus}</button><button onClick={resetDeclaration}>重新填写</button></span></div><pre>{generated}</pre><p>使用前请核实内容与实际情况一致，最终责任由作者本人承担。</p></div>}
      </section>}

      {tab === "chat" && <section className="workspace chatWorkspace">
        <div className="chatHeader"><div><span className="chatOnline" /> <strong>AI 规范顾问</strong><small>DeepSeek · 基于 {RULE_TOTAL} 条已核验规则的受限问答</small></div><button onClick={() => setMessages([])}>清除对话</button></div>
        <div className="chatMessages">
          {messages.length === 0 && <div className="chatWelcome"><span className="sectionIcon">问</span><h2>描述你的 AI 使用场景</h2><p>系统会先从 {RULE_TOTAL} 条已核验规则中检索相关条目，再交给 DeepSeek 综合解释。回答附带可展开的原文与来源。</p><div>{CHAT_EXAMPLES.map((example) => <button key={example} onClick={() => void submitQuestion(example)}>{example}</button>)}</div></div>}
          {messages.map((message, index) => {
            const citedRules = (message.ruleIds || []).map((id) => ruleMap.get(id)).filter(Boolean) as PolicyRule[];
            const waiting = message.role === "assistant" && !message.content && isAsking && index === messages.length - 1;
            return <div className={`chatMessage ${message.role} ${message.error ? "messageError" : ""}`} key={message.id}><div className="messageLabel">{message.role === "user" ? "你" : "DeepSeek"}</div><div className="messageBubble">{waiting ? <span className="typing">正在检索规则并生成回答<span>…</span></span> : <pre>{message.content}</pre>}{citedRules.length > 0 && <div className="citations"><strong>引用规则（{citedRules.length}条）</strong>{citedRules.map((rule) => <details key={rule.id}><summary><span className={`verdict verdict-${rule.level}`}>{rule.verdict}</span>{rule.action}<small>{rule.source}</small></summary><blockquote>{rule.quote}</blockquote></details>)}<p>以上回答仅基于规则库中的政策条款，具体以任课教师和所在院校最新规定为准。</p></div>}</div></div>;
          })}
          <div ref={chatEndRef} />
        </div>
        <div className="chatComposer"><textarea rows={2} maxLength={600} value={ask} onChange={(event) => setAsk(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitQuestion(); } }} placeholder="描述你的使用场景；Enter 发送，Shift+Enter 换行……" /><button disabled={isAsking || !ask.trim()} onClick={() => void submitQuestion()}>{isAsking ? "回答中…" : "发送"}</button></div>
      </section>}

      <footer><span>AI 使用规范工具 · 研究原型</span><p>核验日期 {POLICY_CATALOGUE.retrievedAt}；信息检索和声明辅助不替代适用机构的最新规定。</p><a href={SOURCE_URL} target="_blank" rel="noreferrer">数据来源：首都师范大学图书馆 AI 专题政策页面 ↗</a></footer>
    </main>
  );
}
