# AI 使用规范工具

面向大学生的 AI 素养教育原型。参考 HTML 只用于功能和交互逻辑；数据于 2026-08-19 从[首都师范大学图书馆 AI 专题政策页面](https://lib.cnu.edu.cn/static/site/view/ai/com)及其链接的现行原文重新核验、独立拆解。

## 在线使用

访问：[AI 使用规范工具](https://ranqqqqq.github.io/ai_literacy/)

普通访客无需填写或提供 DeepSeek API Key。智能问答通过项目维护者预先配置的服务端 Secret 调用 DeepSeek；密钥不会写入网页代码、发送到访客浏览器或公开在 GitHub 仓库中。

## 功能

- 浏览当前页面的 40 项政策入口，以及独立页面列出的 15 个出版机构规则
- 检索 155 条已核验规则，支持主题、场景、结论和全文关键词筛选
- 展开查看政策原文与来源，并把单条规则交给 AI 解读
- 生成课程作业、毕业论文、科研活动三类 AI 使用声明
- 通过服务端 DeepSeek 接口回答问题，以安全的标准 Markdown 流式展示标题、列表、链接、代码和表格，并附上本次命中的规则原文
- 服务端密钥隔离、输入长度限制和基础请求频率限制

## 自行部署与本地开发

以下内容只面向需要在自己电脑或托管平台上重新部署项目的开发者；在线访客可以忽略本节。

需要 Node.js `>=22.13.0`。

```bash
npm install
cp .env.example .dev.vars
npm run dev
```

自行部署时，在 `.dev.vars` 中填写部署者自己的 DeepSeek 密钥。该文件已被 Git 忽略，禁止把真实密钥写入前端代码或提交到仓库。

```dotenv
DEEPSEEK_API_KEY=your_server_side_key
DEEPSEEK_API_BASE=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

生产构建检查：

```bash
npm run build
```

## 发布配置

部署时把 `DEEPSEEK_API_KEY` 配置为托管平台的服务端 Secret；`DEEPSEEK_API_BASE` 和 `DEEPSEEK_MODEL` 可作为普通环境变量。不要把 `.dev.vars`、`.env` 或任何真实密钥提交到 GitHub。

## 数据与使用边界

`app/policies.json` 保存当前政策目录，`app/rules.json` 只保存能够读取原文并复核的规则。仅有目录入口、尚未取得正文的文件不会被推断成规则。`work/rule-coverage.json` 记录 40 项入口的读取状态、正文字符数和核验规则数；`scripts/audit-current-policies.py` 与 `scripts/reconcile-current-rules.py` 用于复现目录审计和严格匹配过程。

智能问答只接收本地已核验规则库检索出的条目，并被提示不得补充规则库以外的政策事实。结果仍然是辅助解释，不替代任课教师、院系、学校、期刊或主管机构的最新规定。

声明模板没有写入统一的 AI 内容比例，因为不同课程和学校要求可能不同，应以实际适用规则为准。
