import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:4173/";
const round = process.env.VISUAL_ROUND ?? "round-1";
const artifacts = resolve("artifacts", "focused-workspace", round);
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true,
});
const browserErrors = [],
  outboundRequests = [],
  metrics = [];
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("request", (request) => {
  if (new URL(request.url()).origin !== new URL(baseUrl).origin)
    outboundRequests.push(request.url());
});
const shot = async (name) => {
  await page.screenshot({ path: resolve(artifacts, `${name}.png`) });
  const metric = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    center: Math.round(
      document.querySelector(".review-column").getBoundingClientRect().width,
    ),
    toolbar: document.querySelector(".workspace-toolbar").scrollWidth,
  }));
  assert.equal(metric.width, metric.scrollWidth);
  assert.ok(metric.toolbar <= metric.width);
  metrics.push({ name, ...metric });
};
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page
  .locator('input[accept*="srt"]')
  .setInputFiles(resolve("samples", "mixed-issues.srt"));
await page.getByRole("heading", { name: "全部检查结果" }).waitFor();
assert.equal(await page.getByRole("dialog").count(), 0);
await page.getByRole("button", { name: "检查规则", exact: true }).click();
const rules = page.getByRole("dialog");
for (const label of ["删除句末标点", "英文句首大写", "清理多余空格"])
  await rules.getByText(label, { exact: true }).click();
await rules.getByRole("button", { name: "重新运行检查" }).click();
await page.locator(".issue-card").nth(10).waitFor();
await shot("basic-1440");
await page.getByRole("button", { name: "接受修改" }).first().click();
const acceptedCount = await page.locator(".status-accepted").count();
assert.ok(acceptedCount > 0);
await page.getByRole("button", { name: "撤销上一次操作" }).click();
assert.equal(await page.locator(".status-accepted").count(), 0);
await page.getByRole("button", { name: "重做上一次操作" }).click();
assert.equal(await page.locator(".status-accepted").count(), acceptedCount);
await page
  .getByRole("navigation", { name: "处理状态" })
  .getByRole("button", { name: /已处理/ })
  .click();
assert.ok((await page.locator(".issue-card").count()) > 0);
await page
  .getByRole("navigation", { name: "处理状态" })
  .getByRole("button", { name: /全部/ })
  .click();
await page.getByRole("button", { name: "筛选", exact: true }).click();
await page.getByLabel("问题类型", { exact: true }).selectOption("checkOverlap");
assert.equal(await page.locator(".issue-card").count(), 1);
assert.equal(await page.getByRole("button", { name: "接受修改" }).count(), 0);
await page.getByRole("button", { name: "清除筛选" }).click();
await page.getByRole("button", { name: "筛选", exact: true }).click();
await page.setViewportSize({ width: 1024, height: 768 });
await shot("basic-1024");
await page.getByRole("button", { name: "检查规则", exact: true }).click();
await shot("basic-drawer-1024");
await page.keyboard.press("Escape");
assert.equal(await page.getByRole("dialog").count(), 0);
assert.equal(
  await page
    .getByRole("button", { name: "检查规则", exact: true })
    .evaluate((el) => document.activeElement === el),
  true,
);
page.once("dialog", (dialog) => dialog.accept());
await page.getByRole("button", { name: "取消任务" }).click();
await page.getByRole("button", { name: "字幕本土化" }).click();
await page
  .locator('input[accept*="srt"]')
  .setInputFiles(resolve("samples", "localization-input.srt"));
await page.getByRole("heading", { name: "设置本土化规则" }).waitFor();
await page
  .locator(".setup-glossary input")
  .setInputFiles(resolve("glossary", "example-glossary.csv"));
await page.getByRole("button", { name: "使用有效条目" }).click();
await page.getByRole("button", { name: "开始生成建议" }).click();
await page.locator(".localization-card").first().waitFor();
await shot("localization-1024");
await page.setViewportSize({ width: 1440, height: 960 });
await shot("localization-1440");
const details = page
  .locator(".localization-card")
  .first()
  .locator(".reason-details");
assert.equal(await details.getAttribute("open"), null);
await details.locator("summary").click();
const customDetails = page
  .locator(".reason-details")
  .filter({ has: page.locator("button").filter({ hasText: "编辑此术语" }) })
  .first();
await customDetails.locator("summary").click();
await page
  .getByRole("button", { name: "编辑此术语", exact: true })
  .first()
  .click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: "取消", exact: true })
  .click();
await page.getByRole("button", { name: /^术语表/ }).click();
await page.getByRole("dialog").getByLabel("搜索术语").fill("报警信息");
assert.equal(await page.locator(".glossary-row").count(), 1);
await shot("glossary-drawer-1440");
await page.getByRole("button", { name: "关闭工具面板" }).click();
await page.getByRole("button", { name: "本土化规则", exact: true }).click();
await page.getByRole("dialog").getByText("中英文空格", { exact: true }).click();
await page.getByRole("button", { name: "关闭工具面板" }).click();
assert.equal(await page.locator(".workspace-dirty-note").count(), 1);
await page
  .locator(".workspace-dirty-note")
  .getByRole("button", { name: "重新运行检查" })
  .click();
await page.locator(".localization-card").first().waitFor();
await page.getByRole("button", { name: "完成并导出" }).click();
await page.getByRole("heading", { name: "确认导出台湾繁体字幕" }).waitFor();
await page.getByRole("button", { name: "返回检查" }).click();
assert.deepEqual(browserErrors, []);
assert.deepEqual(outboundRequests, []);
const result = {
  baseUrl,
  round,
  metrics,
  undoRedo: true,
  filters: true,
  drawerFocusAndEscape: true,
  termEditing: true,
  dirtyNotice: true,
  exportDialog: true,
  browserErrors,
  outboundRequests,
};
writeFileSync(
  resolve(artifacts, "results.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
await browser.close();
