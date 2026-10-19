import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { strToU8, zipSync } from "fflate";
import { chromium } from "playwright";

const workbookPath = process.argv[2];
assert.ok(workbookPath, "请通过第一个参数提供真实 .xlsx 文件路径");
assert.ok(existsSync(workbookPath), `找不到文件：${workbookPath}`);

const artifactDir = resolve("artifacts", "adaptive-glossary");
mkdirSync(artifactDir, { recursive: true });
const docxPath = resolve(artifactDir, "ordinary-glossary.docx");
const wordDocument = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:tbl>
<w:tr><w:tc><w:p><w:r><w:t>中文列</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>翻译中文列</w:t></w:r></w:p></w:tc></w:tr>
<w:tr><w:tc><w:p><w:r><w:t>軟件</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>軟體</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl><w:sectPr/></w:body></w:document>`;
writeFileSync(
  docxPath,
  Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      "_rels/.rels": strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      "word/document.xml": strToU8(wordDocument),
    }),
  ),
);
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const externalRequests = [];
const browserErrors = [];
page.on("request", (request) => {
  if (new URL(request.url()).hostname !== "127.0.0.1")
    externalRequests.push(request.url());
});
page.on("pageerror", (error) => browserErrors.push(error.message));

await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "字幕本土化" }).click();
await page.getByText("已有企业术语表？原文件可以直接用").waitFor();
await page.screenshot({
  path: resolve(artifactDir, "before-srt-upload-1440.png"),
  fullPage: true,
});

await page.locator('input[accept*="srt"]').setInputFiles({
  name: "adaptive-input.srt",
  mimeType: "application/x-subrip",
  buffer: Buffer.from(
    "1\r\n00:00:00,000 --> 00:00:03,000\r\n软件、服务器和数据支持。\r\n",
  ),
});
await page.getByRole("heading", { name: "设置本土化规则" }).waitFor();
await page.locator(".setup-glossary input[type=file]").setInputFiles(docxPath);
await page.getByRole("heading", { name: "术语表导入结果" }).waitFor();
const wordModalText = await page.getByRole("dialog").textContent();
assert.match(wordModalText, /有效条目\s*1/);
assert.match(wordModalText, /已自动识别 Word/);
await page.getByRole("button", { name: "取消" }).click();

await page
  .locator(".setup-glossary input[type=file]")
  .setInputFiles(workbookPath);
await page.getByRole("heading", { name: "术语表导入结果" }).waitFor();
const modalText = await page.getByRole("dialog").textContent();
assert.match(modalText, /有效条目\s*60/);
assert.match(modalText, /已自动识别.*Sheet1.*来源词.*目标词/);
assert.doesNotMatch(modalText, /格式错误\s*[1-9]/);
await page.waitForTimeout(220);
await page.screenshot({
  path: resolve(artifactDir, "real-workbook-import-1440.png"),
});

await page.getByRole("button", { name: "使用有效条目" }).click();
await page.getByRole("button", { name: "开始生成建议" }).click();
await page.getByText("軟體、伺服器和資料支援。").waitFor();
await page.setViewportSize({ width: 1024, height: 768 });
await page.screenshot({
  path: resolve(artifactDir, "real-workbook-workspace-1024.png"),
});
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth),
  1024,
);
assert.deepEqual(externalRequests, []);
assert.deepEqual(browserErrors, []);

await page.getByRole("button", { name: "完成并导出" }).click();
await page.getByRole("heading", { name: "确认导出台湾繁体字幕" }).waitFor();
await page.getByRole("button", { name: "返回检查" }).click();

page.once("dialog", async (dialog) => {
  assert.match(dialog.message(), /当前处理进度.*不会保存/);
  await dialog.accept();
});
await page.getByRole("button", { name: "取消任务" }).click();
await page.getByRole("heading", { name: /本土化为台湾繁体或英文/ }).waitFor();

console.log(
  JSON.stringify(
    {
      workbook: workbookPath,
      wordEntries: 1,
      importedEntries: 60,
      suggestion: "軟體、伺服器和資料支援。",
      finishOpenedExportConfirmation: true,
      cancelReturnedToUpload: true,
      externalRequests,
      browserErrors,
    },
    null,
    2,
  ),
);
await browser.close();
