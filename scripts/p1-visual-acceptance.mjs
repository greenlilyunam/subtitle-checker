import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const baseUrl = "http://127.0.0.1:4173/";
const artifactDir = resolve("artifacts", "p1-visual");
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true,
});
const externalRequests = [];
page.on("request", (request) => {
  const url = new URL(request.url());
  if (url.hostname !== "127.0.0.1") externalRequests.push(request.url());
});
page.on("console", (message) => {
  if (message.type() === "error") console.error(`BROWSER: ${message.text()}`);
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "字幕本土化" }).click();
await page.screenshot({
  path: resolve(artifactDir, "round-1-upload-1440.png"),
  fullPage: true,
});
await page
  .locator('input[type=file][accept*="srt"]')
  .setInputFiles(resolve("samples", "localization-input.srt"));
await page.getByRole("heading", { name: "设置本土化规则" }).waitFor();
await page.screenshot({
  path: resolve(artifactDir, "round-1-setup-1440.png"),
  fullPage: true,
});
await page.getByRole("button", { name: "开始生成建议" }).click();
await page.getByText("我們透過軟體平台集中查看設備運行資料。").waitFor();
await page.screenshot({
  path: resolve(artifactDir, "round-1-workspace-1440.png"),
});
const wideMetrics = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth,
  viewport: innerWidth,
  cards: document.querySelectorAll(".localization-card").length,
}));

await page.setViewportSize({ width: 1024, height: 768 });
await page.screenshot({
  path: resolve(artifactDir, "round-1-workspace-1024.png"),
});
const compactMetrics = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth,
  viewport: innerWidth,
  cardWidth:
    document.querySelector(".localization-card")?.getBoundingClientRect()
      .width ?? 0,
}));

await page.getByRole("button", { name: /^术语表/ }).click();
await page
  .locator(".localization-panel input[type=file]")
  .setInputFiles(resolve("glossary", "example-glossary.csv"));
await page.getByRole("heading", { name: "术语表导入结果" }).waitFor();
await page.screenshot({
  path: resolve(artifactDir, "round-1-import-1024.png"),
});
await page.getByRole("button", { name: "使用有效条目" }).click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: "本土化规则" })
  .click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: "重新运行检查" })
  .click();
await page.getByText("我們透過軟體平台集中查看設備運行資料。").waitFor();

await page
  .locator(".localization-card")
  .first()
  .getByRole("button", { name: "接受建议" })
  .click();
await page.getByTitle("撤销").click();
await page.getByTitle("重做").click();
await page.getByRole("button", { name: "完成并导出" }).click();
await page.screenshot({
  path: resolve(artifactDir, "round-1-export-1024.png"),
});
const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "导出 SRT" }).last().click();
const download = await downloadPromise;
await download.saveAs(resolve(artifactDir, await download.suggestedFilename()));

console.log(
  JSON.stringify(
    {
      wideMetrics,
      compactMetrics,
      externalRequests,
      downloaded: await download.suggestedFilename(),
    },
    null,
    2,
  ),
);
await browser.close();
