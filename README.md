# 字幕检查器

一个纯浏览器运行的 SRT 交付前检查工具。字幕内容不会上传服务器；项目不包含后端、数据库、登录、遥测或外部 AI API。

## 本地运行

```bash
npm install
npm run dev
```

开发服务器默认使用 Vite 提供的本地地址。生产验证：

```bash
npm run format:check
npm run lint
npm run test -- --run
npm run build
```

## 功能范围

工作台使用“校对优先”布局：顶部显示文件和处理进度；左侧只保留待处理、已处理、全部三个入口，处理结果、问题类型和风险放进高级筛选；中间显示字幕对照。规则和术语表通过右侧抽屉打开，普通建议的详细原因按需展开，高风险与冲突保持展开。规则更改后即使关闭抽屉，工作台仍会提醒重新检查。

- 单个 UTF-8 / UTF-8 BOM SRT 导入
- 句末标点、英文句首大写、多余空格建议
- 序号、时间码、空字幕和时间轴重叠检查
- 接受、忽略、手动编辑、批量处理与事务撤销
- UTF-8 无 BOM、CRLF SRT 导出
- “基础检查 / 字幕本土化”任务模式
- 离线简体中文（中国大陆）到繁体中文（中国台湾）转换
- 台湾地区、企业软件用语与技术片段保护规则
- Word `.docx`、Excel `.xlsx`、CSV、JSON 企业术语资料自动识别、校验、去重、冲突提示与会话内管理
- 本土化建议的风险、来源、原因、接受、忽略、编辑、撤销与重做
- 本土化导出保留原序号、时间码、字幕块顺序和源文件换行，默认增加 `_zh-TW`
- 简体中文到英文的中英对照流程，支持整句译文和专业术语英文映射，默认增加 `_en`
- 英文流程不会猜测未覆盖译文；仍含中文的结果标为高风险并要求手动补译

简繁转换使用 `opencc-js` 的浏览器内置字典，运行时不会请求网络。该依赖采用 `MIT AND Apache-2.0` 许可证，并通过 `src/lib/localization/opencc-adapter.ts` 隔离。

Excel 解析使用 `read-excel-file`，采用 MIT 许可证。系统会在浏览器内检查全部工作表，自动识别常见或自定义表头，并在没有标准表头时推断双列对照关系。支持 `.xlsx`；旧版 `.xls` 需先另存为 `.xlsx`。

Word 解析使用 `mammoth`，采用 BSD-2-Clause 许可证。系统会在浏览器内读取 `.docx` 的表格及“来源词 → 目标词”段落，不渲染文档中的 HTML，也不会上传文件。旧版 `.doc` 需先另存为 `.docx`。

P0 需求、规则和验收基线见 `PRD.md`、`RULES.md` 与 `ACCEPTANCE.md`；P1 交接材料保存在 `docs/p1-localization/`。

## GitHub Pages 部署

访问地址：<https://greenlilyunam.github.io/subtitle-checker/>。

项目包含 `.github/workflows/pages.yml`。推送到 `main` 后，GitHub Actions 会依次运行格式检查、lint、全部单元测试和生产构建，通过后发布 `dist`。仓库 Pages 设置使用 GitHub Actions，Vite 使用相对资源路径，支持部署到仓库子路径。

应用与离线转换字典作为静态资源提供。字幕和术语表始终只在访问者的浏览器中处理。个人导入文件、验收下载和截图位于 `artifacts/`，该目录已排除在 Git 之外。

Windows 上已安装 Chrome 时，可运行 `node scripts/focused-workspace-acceptance.mjs` 验证三种状态、高级筛选、抽屉键盘操作、术语编辑、撤销/重做及 1440×960 和 1024×768 布局。设置 `APP_URL` 可对部署后的站点执行同一验收。
