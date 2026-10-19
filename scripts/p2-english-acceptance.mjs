import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { strToU8, zipSync } from "fflate";

const artifacts = resolve("artifacts", "p2-english");
mkdirSync(artifacts, { recursive: true });

const xmlEscape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const rows = [
  ["中文术语", "英文术语", "备注", "优先级"],
  ["请打开软件。", "Please open the software.", "整句译文", "100"],
  ["设备运行数据", "equipment operating data", "专业术语", "90"],
];
const cells = rows
  .map(
    (row, rowIndex) =>
      `<row r="${rowIndex + 1}">${row
        .map(
          (value, columnIndex) =>
            `<c r="${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`,
        )
        .join("")}</row>`,
  )
  .join("");
const files = {
  "[Content_Types].xml": strToU8(
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  ),
  "_rels/.rels": strToU8(
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  ),
  "xl/workbook.xml": strToU8(
    '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="中英术语" sheetId="1" r:id="rId1"/></sheets></workbook>',
  ),
  "xl/_rels/workbook.xml.rels": strToU8(
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  ),
  "xl/worksheets/sheet1.xml": strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cells}</sheetData></worksheet>`,
  ),
};
const xlsxPath = resolve(artifacts, "english-glossary.xlsx");
writeFileSync(xlsxPath, Buffer.from(zipSync(files)));

const srt =
  "1\r\n00:00:00,000 --> 00:00:02,000\r\n请打开软件。\r\n\r\n2\r\n00:00:02,200 --> 00:00:05,000\r\n查看设备运行数据。\r\n";
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
  if (new URL(request.url()).hostname !== "127.0.0.1")
    externalRequests.push(request.url());
});

await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "字幕本土化" }).click();
await page.locator('input[accept*="srt"]').setInputFiles({
  name: "english-input.srt",
  mimeType: "application/x-subrip",
  buffer: Buffer.from(srt),
});
await page.getByRole("heading", { name: "设置本土化规则" }).waitFor();
await page.getByRole("button", { name: /简体中文 → 英文/ }).click();
await page.screenshot({
  path: resolve(artifacts, "english-setup-1440.png"),
  fullPage: true,
});
await page
  .locator('.setup-glossary input[type="file"]')
  .setInputFiles(xlsxPath);
await page.getByRole("heading", { name: "术语表导入结果" }).waitFor();
assert.match(await page.getByRole("dialog").textContent(), /有效条目\s*2/);
await page.getByRole("button", { name: "使用有效条目" }).click();
await page.getByRole("button", { name: "开始生成建议" }).click();
await page.getByRole("heading", { name: "英文翻译建议" }).waitFor();
assert.equal(await page.locator(".localization-card").count(), 2);
assert.equal(await page.locator(".localization-card.risk-low").count(), 1);
assert.equal(await page.locator(".localization-card.risk-high").count(), 1);
assert.equal(
  await page
    .locator(".localization-card.risk-high")
    .getByRole("button", { name: "接受建议" })
    .isDisabled(),
  true,
);
await page
  .locator(".localization-card.risk-low")
  .getByRole("button", { name: "接受建议" })
  .click();
const highCard = page.locator(".localization-card.risk-high");
await highCard.getByRole("button", { name: "手动编辑" }).click();
await highCard.locator("textarea").fill("View equipment operating data.");
await highCard.getByRole("button", { name: "保存修改" }).click();
await page.setViewportSize({ width: 1024, height: 768 });
await page.screenshot({
  path: resolve(artifacts, "english-workspace-1024.png"),
});
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth),
  1024,
);
await page.getByRole("button", { name: "完成并导出" }).click();
await page.getByRole("heading", { name: "确认导出英文字幕" }).waitFor();
await page.waitForTimeout(220);
await page.screenshot({ path: resolve(artifacts, "english-export-1024.png") });
const downloadPromise = page.waitForEvent("download");
await page
  .getByRole("dialog")
  .getByRole("button", { name: "导出 SRT" })
  .click();
const download = await downloadPromise;
const outputPath = resolve(artifacts, await download.suggestedFilename());
await download.saveAs(outputPath);
const output = readFileSync(outputPath, "utf8");
assert.match(output, /Please open the software\./);
assert.match(output, /View equipment operating data\./);
assert.equal(output.includes("请打开软件"), false);
assert.equal(output.includes("查看设备运行数据"), false);
assert.equal(await download.suggestedFilename(), "english-input_en.srt");
assert.deepEqual(externalRequests, []);

console.log(
  JSON.stringify(
    {
      xlsxEntries: 2,
      suggestions: 2,
      lowRiskAccepted: 1,
      highRiskManualEdit: 1,
      download: await download.suggestedFilename(),
      externalRequests,
    },
    null,
    2,
  ),
);
await browser.close();
