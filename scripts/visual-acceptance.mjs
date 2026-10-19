import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const artifacts = resolve(root, "artifacts");
const round = process.env.VISUAL_ROUND ?? "round-3";
mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true,
});
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.screenshot({
  path: resolve(artifacts, `${round}-upload-1440.png`),
  fullPage: true,
});

await page
  .locator("input[type=file]")
  .setInputFiles(resolve(root, "samples", "mixed-issues.srt"));
await page.getByText("全部检查结果").waitFor();
const initialEntryCount = await page.getByText(/共 6 条字幕/).count();

await page.getByRole("button", { name: "检查规则", exact: true }).click();

for (const label of ["删除句末标点", "英文句首大写", "清理多余空格"]) {
  await page.getByText(label, { exact: true }).last().click();
}
await page
  .getByRole("dialog")
  .getByRole("button", { name: "重新运行检查" })
  .click();
await page.getByText(/全部检查结果/).waitFor();
await page.waitForTimeout(350);

await page.screenshot({
  path: resolve(artifacts, `${round}-workspace-1440.png`),
  fullPage: true,
});
const size1440 = await page.evaluate(() => ({
  viewport: [window.innerWidth, window.innerHeight],
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight,
  cards: document.querySelectorAll(".issue-card").length,
  centerWidth: Math.round(
    document.querySelector(".review-column")?.getBoundingClientRect().width ??
      0,
  ),
}));

await page.setViewportSize({ width: 1024, height: 768 });
await page.screenshot({
  path: resolve(artifacts, `${round}-workspace-1024.png`),
  fullPage: true,
});
const size1024 = await page.evaluate(() => ({
  viewport: [window.innerWidth, window.innerHeight],
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight,
  centerWidth: Math.round(
    document.querySelector(".review-column")?.getBoundingClientRect().width ??
      0,
  ),
  toolbarWidth: Math.round(
    document.querySelector(".workspace-toolbar")?.scrollWidth ?? 0,
  ),
}));

await page.setViewportSize({ width: 1440, height: 960 });
await page.getByRole("button", { name: "接受修改" }).first().click();
await page.getByRole("button", { name: "接受修改" }).first().click();
await page.getByRole("button", { name: "忽略", exact: true }).first().click();
await page
  .locator(".issue-card")
  .filter({ has: page.getByRole("button", { name: /手动编辑/ }) })
  .first()
  .getByRole("button", { name: /手动编辑/ })
  .click();
const editor = page.locator(".manual-editor textarea").first();
await editor.fill("人工复核后的字幕");
await page.getByRole("button", { name: "保存修改" }).click();
await page.getByRole("button", { name: "撤销上一次操作" }).click();

await page.getByRole("button", { name: "完成并导出" }).click();
await page.getByRole("dialog").waitFor();
await page.waitForTimeout(250);
const modalCounts = await page.locator(".summary-item").allTextContents();
await page.screenshot({
  path: resolve(artifacts, `${round}-export-modal-1440.png`),
  fullPage: true,
});

const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: /继续导出/ }).click();
const download = await downloadPromise;
const downloadedPath = resolve(artifacts, "acceptance-export.srt");
await download.saveAs(downloadedPath);
const exported = readFileSync(downloadedPath);

page.once("dialog", (dialog) => dialog.accept());
await page.getByRole("button", { name: "取消任务", exact: true }).click();
await page.locator("input[type=file]").setInputFiles(downloadedPath);
await page.getByText("全部检查结果").waitFor();
const reimported = await page.getByText(/共 6 条字幕/).count();

console.log(
  JSON.stringify(
    {
      initialEntryCount,
      reimported,
      modalCounts,
      utf8Bom:
        exported[0] === 0xef && exported[1] === 0xbb && exported[2] === 0xbf,
      hasOnlyCrlf: !exported
        .toString("utf8")
        .replace(/\r\n/g, "")
        .includes("\n"),
      size1440,
      size1024,
      consoleErrors,
    },
    null,
    2,
  ),
);

await browser.close();
