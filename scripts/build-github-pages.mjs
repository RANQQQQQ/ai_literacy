import { rename } from "node:fs/promises";
import { spawn } from "node:child_process";

const apiDirectory = new URL("../app/api", import.meta.url);
const parkedApiDirectory = new URL("../.github-pages-api", import.meta.url);

await rename(apiDirectory, parkedApiDirectory);

try {
  const child = spawn("./node_modules/.bin/next", ["build", "--webpack"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      GITHUB_PAGES: "true",
      NEXT_PUBLIC_CHAT_API_URL: "https://ai-usage-policy-tool.gasnatural.chatgpt.site/api/chat",
    },
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (exitCode !== 0) process.exitCode = Number(exitCode) || 1;
} finally {
  await rename(parkedApiDirectory, apiDirectory);
}
