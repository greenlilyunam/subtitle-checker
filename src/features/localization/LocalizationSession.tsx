import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  Languages,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Brand } from "../../components/Brand";
import {
  ReviewNavigation,
  ReviewProgress,
  type ReviewView,
} from "../../components/ReviewNavigation";
import { ToolDrawer } from "../../components/ToolDrawer";
import { Switch } from "../../components/Switch";
import {
  LOCALIZATION_SOURCE_LABELS,
  LOCALIZATION_TYPE_LABELS,
} from "../../lib/localization/builtin-terms";
import {
  localizationOutputText,
  runLocalization,
} from "../../lib/localization/engine";
import { runEnglishLocalization } from "../../lib/localization/english-engine";
import { parseGlossaryExcel } from "../../lib/localization/excel-glossary-adapter";
import {
  detectGlossaryConflicts,
  parseGlossary,
  validateGlossaryEntry,
} from "../../lib/localization/glossary";
import { parseGlossaryWord } from "../../lib/localization/word-glossary-adapter";
import { decodeUtf8 } from "../../lib/srt/parser";
import { serializeSrtWithLineEnding } from "../../lib/srt/serializer";
import type { SubtitleEntry } from "../../types";
import {
  DEFAULT_LOCALIZATION_RULES,
  type GlossaryEntry,
  type GlossaryImportResult,
  type LocalizationIssue,
  type LocalizationDirection,
  type LocalizationRisk,
  type LocalizationRulesConfig,
  type LocalizationSnapshot,
  type LocalizationStatus,
  type LocalizationType,
} from "../../types/localization";

interface LocalizationSessionProps {
  fileName: string;
  entries: SubtitleEntry[];
  lineEnding: "\n" | "\r\n";
  onReplace: () => void;
  onToast: (message: string) => void;
}

const RULES: Array<{
  key: keyof LocalizationRulesConfig;
  label: string;
  description: string;
}> = [
  {
    key: "convertCharacters",
    label: "简体字转台湾繁体",
    description: "离线、确定性字符转换",
  },
  {
    key: "useTaiwanTerms",
    label: "台湾地区用语",
    description: "影片、网路、硬碟等表达",
  },
  {
    key: "useSoftwareTerms",
    label: "企业软件用语",
    description: "使用者、登入、资料库等表达",
  },
  {
    key: "formatSpacing",
    label: "中英文空格",
    description: "规范技术词与中文边界",
  },
  {
    key: "protectTechnical",
    label: "保护技术片段",
    description: "URL、邮箱、版本号与型号",
  },
  {
    key: "scanRisks",
    label: "遗漏与风险扫描",
    description: "标出疑似漏改和冲突",
  },
];

const STATUS_LABELS: Record<LocalizationStatus, string> = {
  pending: "待确认",
  accepted: "已接受",
  ignored: "已忽略",
  edited: "手动编辑",
};
const RISK_LABELS: Record<LocalizationRisk, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

function diffParts(before: string, after: string) {
  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  )
    prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before.at(-1 - suffix) === after.at(-1 - suffix)
  )
    suffix += 1;
  return {
    start: before.slice(0, prefix),
    removed: before.slice(
      prefix,
      suffix ? before.length - suffix : before.length,
    ),
    added: after.slice(prefix, suffix ? after.length - suffix : after.length),
    end: suffix ? before.slice(before.length - suffix) : "",
  };
}

function LocalizedDiff({
  before,
  after,
  targetLabel,
}: {
  before: string;
  after: string;
  targetLabel: string;
}) {
  const diff = useMemo(() => diffParts(before, after), [before, after]);
  return (
    <div className="diff-stack localization-diff">
      <div className="caption-block original-block">
        <span className="caption-label">原文 · zh-CN</span>
        <p>
          {diff.start}
          {diff.removed && <del>{diff.removed}</del>}
          {diff.end}
        </p>
      </div>
      <div className="caption-block suggestion-block">
        <span className="caption-label">建议 · {targetLabel}</span>
        <p>
          {diff.start}
          {diff.added && <ins>{diff.added}</ins>}
          {diff.end}
        </p>
      </div>
    </div>
  );
}

function LocalizationCard({
  issue,
  entry,
  selected,
  onSelect,
  onAccept,
  onIgnore,
  onEdit,
  onReopen,
  onEditTerm,
  direction,
}: {
  issue: LocalizationIssue;
  entry: SubtitleEntry;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onAccept: () => void;
  onIgnore: () => void;
  onEdit: (text: string) => void;
  onReopen: () => void;
  onEditTerm: (term: string) => void;
  direction: LocalizationDirection;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(issue.editedText ?? issue.suggestedText);
  const activeText =
    issue.status === "edited"
      ? (issue.editedText ?? issue.suggestedText)
      : issue.suggestedText;
  const requiresManual = direction === "zh-CN_en" && issue.risk === "high";
  const primaryChange =
    issue.changes.find((change) => change.type === "conflict") ??
    issue.changes.find((change) => change.source === "custom-glossary") ??
    issue.changes.find((change) => change.source === "builtin-glossary") ??
    issue.changes[0];
  const selectable =
    issue.status === "pending" && !issue.hasConflict && !requiresManual;
  return (
    <article
      className={`issue-card localization-card status-${issue.status} risk-${issue.risk}`}
      data-issue-id={issue.id}
    >
      <div className="proof-track" aria-hidden="true">
        <span />
      </div>
      <div className="issue-card-inner">
        <header className="issue-header">
          <label className={`issue-select ${!selectable ? "is-disabled" : ""}`}>
            <input
              type="checkbox"
              checked={selected}
              disabled={!selectable}
              onChange={(event) => onSelect(event.target.checked)}
              aria-label={`选择字幕 ${entry.sequenceRaw}`}
            />
          </label>
          <span className="entry-number">
            #{entry.sequenceRaw || entry.order + 1}
          </span>
          <code className="timecode">{entry.timecodeRaw}</code>
          <span className={`risk-badge ${issue.risk}`}>
            {issue.hasConflict && <AlertTriangle size={12} />}
            {RISK_LABELS[issue.risk]}
          </span>
          <span className={`status-badge ${issue.status}`}>
            {STATUS_LABELS[issue.status]}
          </span>
        </header>
        <div className="localization-meta">
          <span>
            {LOCALIZATION_TYPE_LABELS[primaryChange?.type ?? issue.types[0]]}
          </span>
          {issue.hasConflict && (
            <span className="conflict-chip">术语冲突 · 需要人工确认</span>
          )}
          {requiresManual && (
            <span className="conflict-chip">需要人工补译</span>
          )}
        </div>
        {editing ? (
          <div className="manual-editor localization-editor">
            <label htmlFor={`localize-${issue.id}`}>
              {direction === "zh-CN_en"
                ? "手动补充英文字幕"
                : "手动编辑台湾繁体字幕"}
            </label>
            <textarea
              id={`localize-${issue.id}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Escape") setEditing(false);
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  onEdit(draft);
                  setEditing(false);
                }
              }}
            />
            <div className="edit-actions">
              <button
                className="secondary-button small"
                type="button"
                onClick={() => setEditing(false)}
              >
                取消
              </button>
              <button
                className="primary-button small"
                type="button"
                onClick={() => {
                  onEdit(draft);
                  setEditing(false);
                }}
              >
                保存修改
              </button>
            </div>
          </div>
        ) : (
          <LocalizedDiff
            before={issue.originalText}
            after={activeText}
            targetLabel={direction === "zh-CN_en" ? "EN" : "zh-TW"}
          />
        )}
        <p className="primary-change-reason">{primaryChange?.reason}</p>
        <details
          className="reason-details"
          open={issue.hasConflict || issue.risk === "high" || undefined}
        >
          <summary>查看详情 · {issue.changes.length} 项规则</summary>
          <div className="change-reasons">
            {issue.changes.map((change) => (
              <div key={change.id}>
                <strong>{change.reason}</strong>
                <span>
                  {LOCALIZATION_SOURCE_LABELS[change.source]} ·{" "}
                  {RISK_LABELS[change.risk]}
                  {change.conflictTargets
                    ? ` · 候选：${change.conflictTargets.join(" / ")}`
                    : ""}
                </span>
                {change.source === "custom-glossary" && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onEditTerm(change.matchedTerm)}
                  >
                    编辑此术语
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
        {!editing && (
          <footer className="issue-actions">
            {issue.status === "pending" ? (
              <>
                <button
                  className="text-button neutral"
                  type="button"
                  onClick={() => {
                    setDraft(activeText);
                    setEditing(true);
                  }}
                >
                  <Edit3 size={14} />
                  手动编辑
                </button>
                <button
                  className="secondary-button small"
                  type="button"
                  onClick={onIgnore}
                >
                  忽略
                </button>
                <button
                  className="primary-button small"
                  type="button"
                  disabled={issue.hasConflict || requiresManual}
                  title={
                    issue.hasConflict
                      ? "冲突项必须手动编辑"
                      : requiresManual
                        ? "仍有中文未翻译，请先手动补充英文"
                        : undefined
                  }
                  onClick={onAccept}
                >
                  <Check size={14} />
                  接受建议
                </button>
              </>
            ) : (
              <button
                className="secondary-button small"
                type="button"
                onClick={onReopen}
              >
                <RotateCcw size={14} />
                重新处理
              </button>
            )}
          </footer>
        )}
      </div>
    </article>
  );
}

function GlossaryEditor({
  initial,
  onClose,
  onSave,
}: {
  initial?: GlossaryEntry;
  onClose: () => void;
  onSave: (entry: GlossaryEntry) => void;
}) {
  const [value, setValue] = useState<Omit<GlossaryEntry, "id" | "source">>({
    sourceTerm: initial?.sourceTerm ?? "",
    targetTerm: initial?.targetTerm ?? "",
    action: initial?.action ?? "replace",
    note: initial?.note,
    enabled: initial?.enabled ?? true,
    priority: initial?.priority ?? 80,
  });
  const [error, setError] = useState("");
  const submit = () => {
    const nextError = validateGlossaryEntry(value);
    if (nextError) {
      setError(nextError);
      return;
    }
    onSave({
      ...value,
      id: initial?.id ?? `custom-ui-${Date.now()}`,
      source: "custom",
    });
  };
  return (
    <div className="modal-backdrop">
      <section
        className="export-modal glossary-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="glossary-editor-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="glossary-editor-title">
              {initial ? "编辑术语" : "新增术语"}
            </h2>
            <p>自定义术语优先于内置规则</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="glossary-form-grid">
          <label>
            来源词
            <input
              value={value.sourceTerm}
              onChange={(event) =>
                setValue({ ...value, sourceTerm: event.target.value })
              }
            />
          </label>
          <label>
            目标词
            <input
              value={value.targetTerm}
              onChange={(event) =>
                setValue({ ...value, targetTerm: event.target.value })
              }
              disabled={value.action === "protect" || value.action === "warn"}
            />
          </label>
          <label>
            处理方式
            <select
              value={value.action}
              onChange={(event) =>
                setValue({
                  ...value,
                  action: event.target.value as GlossaryEntry["action"],
                })
              }
            >
              <option value="replace">直接替换</option>
              <option value="suggest">仅建议</option>
              <option value="protect">保护不改</option>
              <option value="warn">仅提醒</option>
            </select>
          </label>
          <label>
            优先级
            <input
              type="number"
              min="0"
              max="100"
              value={value.priority}
              onChange={(event) =>
                setValue({ ...value, priority: Number(event.target.value) })
              }
            />
          </label>
          <label className="full">
            备注
            <input
              value={value.note ?? ""}
              onChange={(event) =>
                setValue({ ...value, note: event.target.value })
              }
            />
          </label>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            className="text-button neutral"
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button className="primary-button" type="button" onClick={submit}>
            保存术语
          </button>
        </div>
      </section>
    </div>
  );
}

function ImportResultModal({
  result,
  onClose,
  onUse,
}: {
  result: GlossaryImportResult;
  onClose: () => void;
  onUse: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-result-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="import-result-title">术语表导入结果</h2>
            <p>有效条目可直接加入当前会话</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="summary-grid import-summary">
          <div className="summary-item accepted">
            <span>有效条目</span>
            <strong>{result.entries.length}</strong>
          </div>
          <div className="summary-item">
            <span>重复跳过</span>
            <strong>{result.duplicateCount}</strong>
          </div>
          <div className="summary-item structural">
            <span>格式错误</span>
            <strong>{result.errors.length}</strong>
          </div>
          <div className="summary-item pending">
            <span>术语冲突</span>
            <strong>{result.conflicts.length}</strong>
          </div>
        </div>
        {result.detectedLayout && (
          <div className="import-detected">
            <CheckCircle2 size={15} />
            <span>{result.detectedLayout}</span>
          </div>
        )}
        {(result.errors.length > 0 || result.conflicts.length > 0) && (
          <div className="import-details">
            {result.errors.slice(0, 6).map((error) => (
              <p key={`${error.line}-${error.reason}`}>
                <AlertCircle size={14} />第 {error.line} 行：{error.reason}
              </p>
            ))}
            {result.conflicts.map((conflict) => (
              <p key={conflict.sourceTerm}>
                <AlertTriangle size={14} />“{conflict.sourceTerm}
                ”存在相同优先级的不同目标词：{conflict.targetTerms.join(" / ")}
              </p>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button
            className="text-button neutral"
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={result.entries.length === 0}
            onClick={onUse}
          >
            使用有效条目
          </button>
        </div>
      </section>
    </div>
  );
}

function LocalizationExport({
  defaultName,
  issues,
  lineEnding,
  direction,
  onClose,
  onExport,
}: {
  defaultName: string;
  issues: LocalizationIssue[];
  lineEnding: "\n" | "\r\n";
  direction: LocalizationDirection;
  onClose: () => void;
  onExport: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const counts = {
    accepted: issues.filter((item) => item.status === "accepted").length,
    edited: issues.filter((item) => item.status === "edited").length,
    ignored: issues.filter((item) => item.status === "ignored").length,
    pending: issues.filter((item) => item.status === "pending").length,
  };
  const conflicts = issues.filter(
    (item) => item.hasConflict && item.status === "pending",
  ).length;
  return (
    <div className="modal-backdrop">
      <section
        className="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="local-export-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="local-export-title">
              {direction === "zh-CN_en"
                ? "确认导出英文字幕"
                : "确认导出台湾繁体字幕"}
            </h2>
            <p>时间轴与字幕块结构将严格保留</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="summary-grid">
          <div className="summary-item accepted">
            <span>已接受</span>
            <strong>{counts.accepted}</strong>
          </div>
          <div className="summary-item accepted">
            <span>手动编辑</span>
            <strong>{counts.edited}</strong>
          </div>
          <div className="summary-item">
            <span>已忽略</span>
            <strong>{counts.ignored}</strong>
          </div>
          <div className="summary-item pending">
            <span>未处理</span>
            <strong>{counts.pending}</strong>
          </div>
        </div>
        {(counts.pending > 0 || conflicts > 0) && (
          <div className="export-warning">
            <AlertTriangle size={18} />
            <div>
              <strong>
                {conflicts > 0
                  ? `仍有 ${conflicts} 项术语冲突`
                  : `仍有 ${counts.pending} 项待处理`}
              </strong>
              <p>未处理和已忽略的字幕将保留原文；仍可继续导出。</p>
            </div>
          </div>
        )}
        <div className="form-field">
          <label htmlFor="local-export-name">文件名</label>
          <input
            id="local-export-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <dl className="export-meta">
          <div>
            <dt>语言</dt>
            <dd>{direction === "zh-CN_en" ? "英文" : "繁体中文（台湾）"}</dd>
          </div>
          <div>
            <dt>编码</dt>
            <dd>UTF-8，无 BOM</dd>
          </div>
          <div>
            <dt>换行</dt>
            <dd>{lineEnding === "\r\n" ? "保留 CRLF" : "保留 LF"}</dd>
          </div>
        </dl>
        <div className="locked-option">
          <span>
            <Check size={13} />
          </span>
          <div>
            <strong>保留序号、时间码、顺序与换行</strong>
            <p>只替换已接受或手动编辑的字幕文本</p>
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="text-button neutral"
            type="button"
            onClick={onClose}
          >
            返回检查
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!name.trim()}
            onClick={() =>
              onExport(
                name.toLowerCase().endsWith(".srt") ? name : `${name}.srt`,
              )
            }
          >
            <Download size={16} />
            导出 SRT
          </button>
        </div>
      </section>
    </div>
  );
}

export function LocalizationSession({
  fileName,
  entries,
  lineEnding,
  onReplace,
  onToast,
}: LocalizationSessionProps) {
  const [started, setStarted] = useState(false);
  const [direction, setDirection] =
    useState<LocalizationDirection>("zh-CN_zh-TW");
  const [rules, setRules] = useState(DEFAULT_LOCALIZATION_RULES);
  const [rulesDirty, setRulesDirty] = useState(false);
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [issues, setIssues] = useState<LocalizationIssue[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<LocalizationSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<LocalizationSnapshot[]>([]);
  const [checking, setChecking] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | LocalizationStatus>(
    "all",
  );
  const [view, setView] = useState<ReviewView>("all");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | LocalizationType>("all");
  const [riskFilter, setRiskFilter] = useState<"all" | LocalizationRisk>("all");
  const [tab, setTab] = useState<"rules" | "glossary">("rules");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<GlossaryEntry | "new" | null>(null);
  const [importResult, setImportResult] = useState<GlossaryImportResult | null>(
    null,
  );
  const [exportOpen, setExportOpen] = useState(false);
  const glossaryInput = useRef<HTMLInputElement>(null);

  const snapshot = (label: string): LocalizationSnapshot => ({
    issues,
    selectedIssueIds: [...selected],
    label,
  });
  const commit = (label: string, nextIssues: LocalizationIssue[]) => {
    setUndoStack((current) => [...current, snapshot(label)]);
    setRedoStack([]);
    setIssues(nextIssues);
    setSelected(new Set());
  };
  const run = (keepEdits = false) => {
    setChecking(true);
    setSelected(new Set());
    window.setTimeout(() => {
      let next =
        direction === "zh-CN_en"
          ? runEnglishLocalization(entries, glossary)
          : runLocalization(entries, rules, glossary);
      if (keepEdits) {
        const edited = new Map(
          issues
            .filter((issue) => issue.status === "edited")
            .map((issue) => [issue.entryId, issue]),
        );
        next = next.map((issue) =>
          edited.has(issue.entryId)
            ? {
                ...issue,
                status: "edited",
                editedText: edited.get(issue.entryId)?.editedText,
              }
            : issue,
        );
      }
      setIssues(next);
      setRulesDirty(false);
      setChecking(false);
      setStarted(true);
    }, 260);
  };
  const rerun = () => {
    const hasEdits = issues.some((issue) => issue.status === "edited");
    const keep = hasEdits
      ? window.confirm(
          "重新检查时是否保留手动编辑内容？\n“确定”保留，“取消”将完全重新生成。",
        )
      : false;
    setUndoStack((current) => [...current, snapshot("重新运行检查")]);
    setRedoStack([]);
    run(keep);
  };
  const updateIssue = (
    issue: LocalizationIssue,
    status: LocalizationStatus,
    editedText?: string,
  ) =>
    commit(
      STATUS_LABELS[status],
      issues.map((item) =>
        item.id === issue.id
          ? {
              ...item,
              status,
              editedText,
              acceptedText:
                status === "accepted" ? item.suggestedText : item.acceptedText,
            }
          : item,
      ),
    );
  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((current) => [...current, snapshot(previous.label)]);
    setUndoStack((current) => current.slice(0, -1));
    setIssues(previous.issues);
    setSelected(new Set(previous.selectedIssueIds));
    onToast(`已撤销${previous.label}`);
  };
  const redo = () => {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((current) => [...current, snapshot(next.label)]);
    setRedoStack((current) => current.slice(0, -1));
    setIssues(next.issues);
    setSelected(new Set(next.selectedIssueIds));
    onToast(`已重做${next.label}`);
  };
  const selectedIssues = issues.filter((issue) => selected.has(issue.id));
  const batchAccept = () => {
    const eligible = selectedIssues.filter(
      (issue) =>
        issue.status === "pending" &&
        !issue.hasConflict &&
        !(direction === "zh-CN_en" && issue.risk === "high"),
    );
    if (eligible.length === 0) return;
    if (
      eligible.some((issue) => issue.risk === "medium") &&
      !window.confirm(
        `所选建议中包含中风险项，确定接受 ${eligible.length} 条建议吗？`,
      )
    )
      return;
    const ids = new Set(eligible.map((issue) => issue.id));
    commit(
      "批量接受",
      issues.map((issue) =>
        ids.has(issue.id)
          ? { ...issue, status: "accepted", acceptedText: issue.suggestedText }
          : issue,
      ),
    );
    onToast(`已接受 ${eligible.length} 条本土化建议`);
  };
  const batchIgnore = () => {
    const ids = new Set(selectedIssues.map((issue) => issue.id));
    if (!ids.size) return;
    commit(
      "批量忽略",
      issues.map((issue) =>
        ids.has(issue.id) ? { ...issue, status: "ignored" } : issue,
      ),
    );
    onToast(`已忽略 ${ids.size} 条建议`);
  };
  const importGlossary = async (file: File) => {
    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        setImportResult(await parseGlossaryExcel(file, direction));
      } else if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) {
        setImportResult(await parseGlossaryWord(file, direction));
      } else {
        setImportResult(
          parseGlossary(
            decodeUtf8(await file.arrayBuffer()),
            file.name,
            direction,
          ),
        );
      }
    } catch (error) {
      setImportResult({
        entries: [],
        errors: [
          {
            line: 1,
            reason: error instanceof Error ? error.message : "术语表读取失败",
          },
        ],
        duplicateCount: 0,
        conflicts: [],
      });
    }
  };
  const saveGlossary = (entry: GlossaryEntry) => {
    setGlossary((current) =>
      editor === "new"
        ? [...current, entry]
        : current.map((item) => (item.id === entry.id ? entry : item)),
    );
    setEditor(null);
    setRulesDirty(true);
  };
  const doExport = (name: string) => {
    const byEntry = new Map(issues.map((issue) => [issue.entryId, issue]));
    const output = entries.map((entry) => ({
      ...entry,
      workingText:
        localizationOutputText(byEntry.get(entry.id)) ?? entry.originalText,
    }));
    const blob = new Blob([serializeSrtWithLineEnding(output, lineEnding)], {
      type: "application/x-subrip;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExportOpen(false);
    onToast(
      direction === "zh-CN_en" ? "英文 SRT 已导出" : "台湾繁体 SRT 已导出",
    );
  };

  if (!started)
    return (
      <div className="localization-setup-page">
        <header className="upload-header">
          <Brand />
          <button
            className="text-button neutral"
            type="button"
            onClick={onReplace}
          >
            返回上传页
          </button>
        </header>
        <main className="localization-setup">
          <div className="setup-heading">
            <span className="eyebrow">字幕本土化</span>
            <h1>设置本土化规则</h1>
            <p>
              <strong>{fileName}</strong> · {entries.length} 条字幕 ·
              {direction === "zh-CN_en"
                ? " 简体中文 → 英文"
                : " 简体中文（中国大陆） → 繁体中文（中国台湾）"}
            </p>
          </div>
          <section className="setup-card direction-card">
            <div className="setup-card-heading">
              <div>
                <h2>语言方向</h2>
                <p>选择后会使用对应的规则、术语列和导出文件名。</p>
              </div>
              <Languages size={20} />
            </div>
            <div className="direction-options">
              <button
                className={direction === "zh-CN_zh-TW" ? "is-active" : ""}
                type="button"
                onClick={() => setDirection("zh-CN_zh-TW")}
              >
                <strong>简体中文 → 台湾繁体</strong>
                <span>字符转换、台湾用语与企业术语</span>
              </button>
              <button
                className={direction === "zh-CN_en" ? "is-active" : ""}
                type="button"
                onClick={() => setDirection("zh-CN_en")}
              >
                <strong>简体中文 → 英文</strong>
                <span>Word / Excel 中英对照、术语替换与人工补译</span>
              </button>
            </div>
          </section>
          <section className="setup-card">
            <div className="setup-card-heading">
              <div>
                <h2>
                  {direction === "zh-CN_en" ? "英文翻译规则" : "本土化规则"}
                </h2>
                <p>
                  {direction === "zh-CN_en"
                    ? "对照表覆盖内容生成建议，未覆盖中文必须人工补译。"
                    : "首轮默认全部开启，生成的每条修改仍需你确认。"}
                </p>
              </div>
              <span className="local-only-badge">仅浏览器本地处理</span>
            </div>
            {direction === "zh-CN_en" ? (
              <div className="translation-guardrails">
                <span>
                  <Check size={14} />
                  完整句对照优先于短术语
                </span>
                <span>
                  <Check size={14} />
                  URL、邮箱、版本号和型号保持不变
                </span>
                <span>
                  <AlertTriangle size={14} />
                  仍含中文的建议禁止直接接受
                </span>
              </div>
            ) : (
              <div className="setup-rules">
                {RULES.map((rule) => (
                  <Switch
                    key={rule.key}
                    checked={rules[rule.key]}
                    label={rule.label}
                    description={rule.description}
                    onChange={(checked) =>
                      setRules({ ...rules, [rule.key]: checked })
                    }
                  />
                ))}
              </div>
            )}
          </section>
          <section className="setup-card setup-glossary">
            <div>
              <BookOpen size={20} />
              <h2>
                {direction === "zh-CN_en" ? "中英对照表" : "企业术语表（可选）"}
              </h2>
              <p>
                可直接上传现有 Word、Excel、CSV 或
                JSON；系统会自动识别表头和对照列， 无需先整理成指定模板。
              </p>
            </div>
            <input
              ref={glossaryInput}
              className="sr-only"
              type="file"
              accept=".docx,.doc,.xlsx,.xls,.csv,.json"
              onChange={(event) =>
                event.target.files?.[0] && importGlossary(event.target.files[0])
              }
            />
            <button
              className="secondary-button"
              type="button"
              onClick={() => glossaryInput.current?.click()}
            >
              <Upload size={15} />
              导入术语表
            </button>
            {glossary.length > 0 && <span>{glossary.length} 条已加入</span>}
          </section>
          <div
            className="auto-detection-guide"
            aria-label="术语资料自动识别说明"
          >
            <CheckCircle2 size={17} />
            <div>
              <strong>直接使用现有术语资料</strong>
              <span>
                自动查找工作表、表格和双列对照关系；识别结果会先展示给你确认，导入后仍可编辑。
              </span>
            </div>
            <div className="format-chips" aria-label="支持的文件格式">
              <span>Word .docx</span>
              <span>Excel .xlsx</span>
              <span>CSV</span>
              <span>JSON</span>
            </div>
          </div>
          <div className="setup-actions">
            <button
              className="text-button neutral"
              type="button"
              onClick={onReplace}
            >
              更换字幕文件
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => run()}
            >
              <Search size={16} />
              开始生成建议
            </button>
          </div>
        </main>
        {importResult && (
          <ImportResultModal
            result={importResult}
            onClose={() => setImportResult(null)}
            onUse={() => {
              setGlossary((current) => [...current, ...importResult.entries]);
              setImportResult(null);
            }}
          />
        )}
      </div>
    );

  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const filtered = issues.filter(
    (issue) =>
      (view === "all" ||
        (view === "pending"
          ? issue.status === "pending"
          : issue.status !== "pending")) &&
      (statusFilter === "all" || issue.status === statusFilter) &&
      (typeFilter === "all" || issue.types.includes(typeFilter)) &&
      (riskFilter === "all" || issue.risk === riskFilter),
  );
  const selectable = filtered
    .filter(
      (issue) =>
        issue.status === "pending" &&
        !issue.hasConflict &&
        !(direction === "zh-CN_en" && issue.risk === "high"),
    )
    .map((issue) => issue.id);
  const filteredTerms = glossary.filter((entry) =>
    `${entry.sourceTerm} ${entry.targetTerm} ${entry.note ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const conflicts = detectGlossaryConflicts(glossary);
  const counts = {
    total: issues.length,
    done: issues.filter(
      (issue) => issue.status === "accepted" || issue.status === "edited",
    ).length,
    pending: issues.filter((issue) => issue.status === "pending").length,
    ignored: issues.filter((issue) => issue.status === "ignored").length,
  };
  const cancelTask = () => {
    const hasSessionWork =
      counts.done > 0 ||
      counts.ignored > 0 ||
      undoStack.length > 0 ||
      glossary.length > 0;
    if (
      !hasSessionWork ||
      window.confirm("取消本次任务？当前处理进度和本次导入的术语不会保存。")
    )
      onReplace();
  };
  return (
    <div className="workspace localization-workspace">
      <header className="workspace-toolbar">
        <Brand compact />
        <div className="file-summary">
          <strong>{fileName}</strong>
          <span>
            {entries.length} 条字幕 ·{" "}
            {direction === "zh-CN_en"
              ? "简体中文 → 英文"
              : "简体中文 → 台湾繁体"}
          </span>
        </div>
        <ReviewProgress
          processed={counts.done + counts.ignored}
          total={counts.total}
        />
        <div className="toolbar-actions">
          <button
            className="text-button neutral task-cancel-button"
            type="button"
            onClick={cancelTask}
          >
            <X size={16} />
            取消任务
          </button>
          <button
            className="icon-button"
            type="button"
            disabled={!undoStack.length}
            onClick={undo}
            title="撤销"
            aria-label="撤销"
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            disabled={!redoStack.length}
            onClick={redo}
            title="重做"
            aria-label="重做"
          >
            <Redo2 size={18} />
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={checking}
          >
            <CheckCircle2 size={16} />
            完成并导出
          </button>
        </div>
      </header>
      <div className="workspace-grid focused-grid">
        <ReviewNavigation
          view={view}
          onView={(next) => {
            setView(next);
            setStatusFilter("all");
          }}
          pending={counts.pending}
          processed={counts.done + counts.ignored}
          total={counts.total}
          filterCount={
            Number(typeFilter !== "all") +
            Number(riskFilter !== "all") +
            Number(statusFilter !== "all")
          }
        >
          <label>
            处理结果
            <select
              aria-label="处理结果"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as typeof statusFilter)
              }
            >
              <option value="all">全部结果</option>
              {Object.entries(STATUS_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            问题类型
            <select
              aria-label="问题类型"
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as typeof typeFilter)
              }
            >
              <option value="all">全部类型</option>
              {Object.entries(LOCALIZATION_TYPE_LABELS)
                .filter(
                  ([id]) =>
                    direction !== "zh-CN_en" ||
                    ["custom", "warning", "conflict"].includes(id),
                )
                .map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            风险等级
            <select
              aria-label="风险等级"
              value={riskFilter}
              onChange={(event) =>
                setRiskFilter(event.target.value as typeof riskFilter)
              }
            >
              <option value="all">全部风险</option>
              {Object.entries(RISK_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setTypeFilter("all");
              setRiskFilter("all");
            }}
          >
            清除筛选
          </button>
        </ReviewNavigation>
        <main className="review-column">
          <div className="review-header">
            <div>
              <h1>
                {direction === "zh-CN_en" ? "英文翻译建议" : "台湾繁体建议"}
              </h1>
              <p>
                {direction === "zh-CN_en"
                  ? "中英对照表负责术语和整句映射，未覆盖中文需手动补译"
                  : "对照原文与建议，逐条确认后导出"}
              </p>
              {issues.some(
                (issue) => issue.hasConflict && issue.status === "pending",
              ) && (
                <button
                  className="text-button risk-review-note"
                  type="button"
                  onClick={() => {
                    setView("pending");
                    setTypeFilter("conflict");
                    setRiskFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  还有{" "}
                  {
                    issues.filter(
                      (issue) =>
                        issue.hasConflict && issue.status === "pending",
                    ).length
                  }{" "}
                  项术语冲突，查看并人工确认
                </button>
              )}
            </div>
            <div className="review-tools">
              <button
                className="secondary-button small"
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  setTab("rules");
                  setToolsOpen(true);
                }}
              >
                <Settings2 size={15} />
                本土化规则{rulesDirty && <i className="dirty-dot" />}
              </button>
              <button
                className="secondary-button small"
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  setTab("glossary");
                  setToolsOpen(true);
                }}
              >
                <BookOpen size={15} />
                术语表 <span>{glossary.length}</span>
              </button>
            </div>
          </div>
          {rulesDirty && (
            <div className="workspace-dirty-note" role="status">
              <span>规则或术语已修改，当前建议尚未更新</span>
              <button
                className="text-button"
                type="button"
                disabled={checking}
                onClick={rerun}
              >
                重新运行检查
              </button>
            </div>
          )}
          <div className="review-selection-bar">
            <span>{filtered.length} 条建议 · 按字幕顺序</span>
            <div className="batch-actions">
              <label>
                <input
                  type="checkbox"
                  checked={
                    selectable.length > 0 &&
                    selectable.every((id) => selected.has(id))
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? new Set(selectable) : new Set(),
                    )
                  }
                />
                全选当前
              </label>
              <button
                className="secondary-button small"
                disabled={!selected.size}
                type="button"
                onClick={batchIgnore}
              >
                批量忽略
              </button>
              <button
                className="secondary-button small accent"
                disabled={!selected.size}
                type="button"
                onClick={batchAccept}
              >
                批量接受
              </button>
            </div>
          </div>
          <div className="review-scroll" aria-busy={checking}>
            {checking ? (
              <div className="checking-state">
                <span className="checking-icon">
                  <RotateCcw size={28} />
                </span>
                <h2>
                  {direction === "zh-CN_en"
                    ? "正在生成英文建议"
                    : "正在生成台湾繁体建议"}
                </h2>
                <p>
                  按规则优先级处理 {entries.length} 条字幕，不会发送到服务器
                </p>
                <div className="progress-track">
                  <span />
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="clean-state">
                <span>
                  <CheckCircle2 size={30} />
                </span>
                <h2>
                  {issues.length === 0
                    ? direction === "zh-CN_en"
                      ? "没有需要翻译的内容"
                      : "没有需要本土化的内容"
                    : "当前筛选下没有建议"}
                </h2>
                <p>
                  {issues.length === 0
                    ? direction === "zh-CN_en"
                      ? "字幕中没有待处理中文"
                      : "字幕已符合当前台湾繁体规则"
                    : "请调整左侧筛选条件"}
                </p>
              </div>
            ) : (
              filtered.map((issue) => {
                const entry = entryMap.get(issue.entryId);
                return entry ? (
                  <LocalizationCard
                    key={issue.id}
                    issue={issue}
                    entry={entry}
                    direction={direction}
                    selected={selected.has(issue.id)}
                    onSelect={(checked) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (checked) next.add(issue.id);
                        else next.delete(issue.id);
                        return next;
                      })
                    }
                    onAccept={() => {
                      updateIssue(issue, "accepted");
                      onToast(
                        direction === "zh-CN_en"
                          ? "已接受 1 条英文建议"
                          : "已接受 1 条本土化建议",
                      );
                    }}
                    onIgnore={() => updateIssue(issue, "ignored")}
                    onEdit={(text) => updateIssue(issue, "edited", text)}
                    onReopen={() => updateIssue(issue, "pending")}
                    onEditTerm={(sourceTerm) => {
                      const term = glossary.find(
                        (item) => item.sourceTerm === sourceTerm,
                      );
                      if (term) setEditor(term);
                      else {
                        setSearch(sourceTerm);
                        setTab("glossary");
                        setToolsOpen(true);
                      }
                    }}
                  />
                ) : null;
              })
            )}
          </div>
        </main>
      </div>
      {toolsOpen && (
        <ToolDrawer
          title={
            tab === "rules"
              ? "本土化规则"
              : `企业术语表 · ${glossary.length} 条`
          }
          onClose={() => setToolsOpen(false)}
        >
          <aside className="rules-panel localization-panel">
            <div className="panel-tabs">
              <button
                className={tab === "rules" ? "is-active" : ""}
                type="button"
                onClick={() => setTab("rules")}
              >
                <Settings2 size={14} />
                本土化规则
              </button>
              <button
                className={tab === "glossary" ? "is-active" : ""}
                type="button"
                onClick={() => setTab("glossary")}
              >
                <BookOpen size={14} />
                术语表
              </button>
            </div>
            {tab === "rules" ? (
              <>
                <div className="rules-scroll">
                  <div className="panel-heading">
                    <h2>
                      {direction === "zh-CN_en"
                        ? "简体中文 → 英文"
                        : "简体中文 → 台湾繁体"}
                    </h2>
                    <p>修改规则后需重新运行检查</p>
                  </div>
                  {direction === "zh-CN_en" ? (
                    <div className="translation-rule-summary">
                      <div>
                        <strong>完整句优先</strong>
                        <span>
                          整句对照优先于短术语，避免局部替换破坏译文。
                        </span>
                      </div>
                      <div>
                        <strong>长词优先</strong>
                        <span>专业术语按长度和优先级匹配。</span>
                      </div>
                      <div>
                        <strong>人工补译</strong>
                        <span>仍含中文的高风险项不能直接接受。</span>
                      </div>
                      <div>
                        <strong>技术片段保护</strong>
                        <span>URL、邮箱、版本号和型号保持不变。</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rule-group">
                      {RULES.map((rule) => (
                        <Switch
                          key={rule.key}
                          checked={rules[rule.key]}
                          label={rule.label}
                          description={rule.description}
                          onChange={(checked) => {
                            setRules({ ...rules, [rule.key]: checked });
                            setRulesDirty(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="rules-footer">
                  {rulesDirty && (
                    <div className="dirty-note">
                      规则已变化，现有建议尚未更新
                    </div>
                  )}
                  <button
                    className="primary-button wide"
                    type="button"
                    disabled={checking}
                    onClick={() => {
                      rerun();
                      setToolsOpen(false);
                    }}
                  >
                    <RotateCcw size={15} />
                    重新运行检查
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="glossary-toolbar">
                  <div className="glossary-search">
                    <Search size={14} />
                    <input
                      aria-label="搜索术语"
                      placeholder="搜索术语"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div>
                    <input
                      ref={glossaryInput}
                      className="sr-only"
                      type="file"
                      accept=".docx,.doc,.xlsx,.xls,.csv,.json"
                      onChange={(event) =>
                        event.target.files?.[0] &&
                        importGlossary(event.target.files[0])
                      }
                    />
                    <button
                      className="icon-button"
                      type="button"
                      title="导入 Word / Excel / CSV / JSON"
                      onClick={() => glossaryInput.current?.click()}
                    >
                      <Upload size={15} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      title="新增术语"
                      onClick={() => setEditor("new")}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
                <div className="glossary-list">
                  {conflicts.length > 0 && (
                    <div className="glossary-conflict">
                      <AlertTriangle size={15} />
                      {conflicts.length} 组冲突不会自动处理
                    </div>
                  )}
                  {filteredTerms.length === 0 ? (
                    <div className="glossary-empty">
                      <BookOpen size={24} />
                      <strong>暂无企业术语</strong>
                      <span>导入或新增后仅在当前会话生效</span>
                    </div>
                  ) : (
                    filteredTerms.map((term) => (
                      <div
                        className={`glossary-row ${term.enabled ? "" : "is-disabled"}`}
                        key={term.id}
                      >
                        <div>
                          <strong>{term.sourceTerm}</strong>
                          <span>
                            {term.action === "protect"
                              ? "保护不改"
                              : term.action === "warn"
                                ? "仅提醒"
                                : `→ ${term.targetTerm}`}
                          </span>
                          <small>
                            优先级 {term.priority} · {term.action}
                          </small>
                        </div>
                        <Switch
                          checked={term.enabled}
                          label={`${term.sourceTerm} 启用状态`}
                          hideLabel
                          onChange={(checked) => {
                            setGlossary((current) =>
                              current.map((item) =>
                                item.id === term.id
                                  ? { ...item, enabled: checked }
                                  : item,
                              ),
                            );
                            setRulesDirty(true);
                          }}
                        />
                        <button
                          className="text-button neutral"
                          type="button"
                          onClick={() => setEditor(term)}
                          aria-label={`编辑术语 ${term.sourceTerm}`}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          className="text-button neutral"
                          type="button"
                          aria-label={`删除术语 ${term.sourceTerm}`}
                          onClick={() => {
                            setGlossary((current) =>
                              current.filter((item) => item.id !== term.id),
                            );
                            setRulesDirty(true);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </aside>
        </ToolDrawer>
      )}
      {editor && (
        <GlossaryEditor
          initial={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSave={saveGlossary}
        />
      )}
      {importResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => setImportResult(null)}
          onUse={() => {
            setGlossary((current) => [...current, ...importResult.entries]);
            setImportResult(null);
            setRulesDirty(true);
          }}
        />
      )}
      {exportOpen && (
        <LocalizationExport
          defaultName={`${fileName.replace(/\.srt$/i, "")}_${direction === "zh-CN_en" ? "en" : "zh-TW"}.srt`}
          issues={issues}
          lineEnding={lineEnding}
          direction={direction}
          onClose={() => setExportOpen(false)}
          onExport={doExport}
        />
      )}
    </div>
  );
}
