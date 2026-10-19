# SRT 测试样例说明

| 文件 | 用途 |
| --- | --- |
| `normal.srt` | 合法、无需修改的基础文件 |
| `content-issues.srt` | 句末标点、句首小写、多余空格 |
| `content-expected-all-accepted.srt` | 开启全部内容规则并接受全部建议后的预期输出 |
| `structural-issues.srt` | 序号、空字幕、时间重叠等结构问题 |
| `invalid-format.srt` | 非法时间码和破损块，验证错误处理 |
| `mixed-issues.srt` | 人工验收主文件，包含内容与结构问题 |

注意：

- `structural-issues.srt` 和 `invalid-format.srt` 故意不规范，不应被“修正”成合法样例。
- 内容样例的期望行为以根目录 `RULES.md` 为准。
- 开发者不得为了让测试通过而修改期望文件；应先核对实现与规则。

