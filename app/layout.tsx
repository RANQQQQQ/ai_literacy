import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.GITHUB_PAGES === "true"
  ? "https://ranqqqqq.github.io/ai_literacy/"
  : "https://ai-usage-policy-tool.gasnatural.chatgpt.site/";
const title = "AI 使用规范工具｜高校 AI 素养教育";
const description = "面向大学生的 AI 政策原文检索、使用声明生成与受限智能问答工具。";
const image = new URL("og.png", siteUrl).toString();
const favicon = new URL("favicon.svg", siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: { icon: favicon, shortcut: favicon },
  openGraph: { title, description, type: "website", url: siteUrl, images: [{ url: image, width: 1200, height: 630, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: [image] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
