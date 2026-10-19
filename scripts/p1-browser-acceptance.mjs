import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

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
const browserErrors = [];
page.on("request", (request) => {
  if (new URL(request.url()).hostname !== "127.0.0.1")
    externalRequests.push(request.url());
});
page.on("pageerror", (error) => browserErrors.push(error.message));

await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "字幕本土化" }).click();
await page
  .locator('input[type=file][accept*="srt"]')
  .setInputFiles(resolve("samples", "localization-input.srt"));
await page.getByRole("heading", { name: "设置本土化规则" }).waitFor();
await page
  .locator(".setup-glossary input[type=file]")
  .setInputFiles(resolve("glossary", "example-glossary.csv"));
await page.getByRole("heading", { name: "术语表导入结果" }).waitFor();
await page.waitForTimeout(250);
await page.screenshot({
  path: resolve(artifactDir, "round-2-import-1440.png"),
});
await page.getByRole("button", { name: "使用有效条目" }).click();
await page.getByRole("button", { name: "开始生成建议" }).click();
await page.getByText("我們透過軟體平台集中查看設備運行資料。").waitFor();
assert.equal(await page.locator(".localization-card").count(), 13);
await page.screenshot({
  path: resolve(artifactDir, "round-2-workspace-1440.png"),
});

await page.setViewportSize({ width: 1024, height: 768 });
await page.screenshot({
  path: resolve(artifactDir, "round-2-workspace-1024.png"),
});
const compact = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  viewport: innerWidth,
}));
assert.equal(compact.scrollWidth, compact.viewport);

await page.locator(".review-selection-bar input[type=checkbox]").check();
page.once("dialog", (dialog) => dialog.accept());
await page.getByRole("button", { name: "批量接受" }).click();
await page.getByText("已接受", { exact: true }).first().waitFor();
await page.getByRole("button", { name: "完成并导出" }).click();
await page.getByRole("heading", { name: "确认导出台湾繁体字幕" }).waitFor();
await page.waitForTimeout(250);
await page.screenshot({
  path: resolve(artifactDir, "round-2-export-1024.png"),
});
const downloadPromise = page.waitForEvent("download");
await page
  .getByRole("dialog")
  .getByRole("button", { name: "导出 SRT" })
  .click();
const download = await downloadPromise;
const downloadPath = resolve(artifactDir, await download.suggestedFilename());
await download.saveAs(downloadPath);

const actual = readFileSync(downloadPath, "utf8");
const expected = readFileSync(
  resolve("samples", "localization-expected-custom-glossary.srt"),
  "utf8",
);
assert.equal(actual.trimEnd(), expected.trimEnd());
assert.equal(actual.charCodeAt(0) === 0xfeff, false);
for (const protectedText of [
  "思倍云",
  "SmartInspect",
  "V2.1",
  "https://example.com",
  "ops@example.com",
])
  assert.ok(actual.includes(protectedText));
assert.deepEqual(externalRequests, []);
assert.deepEqual(browserErrors, []);

console.log(
  JSON.stringify(
    {
      cards: 13,
      protectedUnchangedBlocks: 1,
      compact,
      externalRequests,
      browserErrors,
      download: await download.suggestedFilename(),
      customOutputMatched: true,
      utf8Bom: false,
    },
    null,
    2,
  ),
);
await browser.close();
