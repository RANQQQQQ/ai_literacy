# AI 使用规范工具

面向大学生的 AI 素养教育原型。参考 HTML 只用于功能和交互逻辑；数据于 2026-08-15 从[首都师范大学图书馆 AI 专题政策页面](https://lib.cnu.edu.cn/static/site/view/ai/com)及其链接的现行原文重新核验、独立拆解。

## 功能

- 浏览当前页面的 40 项政策入口，以及独立页面列出的 15 个出版机构规则
- 检索 100 条已核验规则，支持 15 个主题、5 类场景、3 种结论和全文关键词筛选
- 展开查看政策原文与来源，并把单条规则交给 AI 解读
- 生成课程作业、毕业论文、科研活动三类 AI 使用声明
- 通过服务端 DeepSeek 接口回答问题，流式输出并展示本次检索命中的规则原文
- 服务端密钥隔离、输入长度限制和基础请求频率限制

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
cp .env.example .dev.vars
npm run dev
```

在 `.dev.vars` 中填写 DeepSeek 密钥。该文件已被 Git 忽略，禁止把真实密钥写入前端代码或提交到仓库。

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

`app/policies.json` 保存当前政策目录，`app/rules.json` 只保存能够读取原文并复核的规则。仅有目录入口、尚未取得正文的文件不会被推断成规则。`scripts/audit-current-policies.py` 与 `scripts/build-current-rules.py` 用于复现目录审计和规则构建。

智能问答只接收本地已核验规则库检索出的条目，并被提示不得补充规则库以外的政策事实。结果仍然是辅助解释，不替代任课教师、院系、学校、期刊或主管机构的最新规定。

声明模板没有写入统一的 AI 内容比例，因为不同课程和学校要求可能不同，应以实际适用规则为准。
