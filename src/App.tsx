import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ExportModal } from "./features/export/ExportModal";
import { Workspace } from "./features/review/Workspace";
import { UploadPage } from "./features/upload/UploadPage";
import { LocalizationSession } from "./features/localization/LocalizationSession";
import {
  applyEnabledContentRules,
  CONTENT_RULE_ORDER,
} from "./lib/rules/content";
import { runChecks } from "./lib/rules/checker";
import { readSrtFile } from "./lib/srt/parser";
import { toUtf8Blob } from "./lib/srt/serializer";
import { popUndo, pushUndo } from "./lib/undo/stack";
import type {
  ContentRuleId,
  Issue,
  ReviewSnapshot,
  RuleId,
  RulesConfig,
  SubtitleEntry,
} from "./types";
import { DEFAULT_RULES } from "./types";
import type { TaskMode } from "./types/localization";

interface Toast {
  id: number;
  message: string;
}

export default function App() {
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<TaskMode>("basic");
  const [lineEnding, setLineEnding] = useState<"\n" | "\r\n">("\r\n");
  const [entries, setEntries] = useState<SubtitleEntry[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [rules, setRules] = useState<RulesConfig>(DEFAULT_RULES);
  const [rulesDirty, setRulesDirty] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<ReviewSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<ReviewSnapshot[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const snapshot = (label: string): ReviewSnapshot => ({
    entries,
    issues,
    selectedIssueIds: [...selected],
    label,
  });
  const addToast = (message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      4000,
    );
  };
  const beginTransaction = (label: string) => {
    setUndoStack((stack) => pushUndo(stack, snapshot(label)));
    setRedoStack([]);
  };

  const handleFile = async (file: File) => {
    setIsParsing(true);
    setUploadError(null);
    try {
      const parsed = await readSrtFile(file);
      const nextIssues =
        mode === "basic" ? runChecks(parsed.entries, DEFAULT_RULES) : [];
      setFileName(file.name);
      setEntries(parsed.entries);
      setIssues(nextIssues);
      setRules(DEFAULT_RULES);
      setLineEnding(parsed.lineEnding);
      setRulesDirty(false);
      setSelected(new Set());
      setUndoStack([]);
      setRedoStack([]);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "文件不是有效的 SRT 格式",
      );
    } finally {
      setIsParsing(false);
    }
  };

  const changeRule = (ruleId: RuleId, checked: boolean) => {
    setRules((current) => ({ ...current, [ruleId]: checked }));
    setRulesDirty(true);
  };
  const rerun = () => {
    setChecking(true);
    setSelected(new Set());
    window.setTimeout(() => {
      setIssues((current) => runChecks(entries, rules, current));
      setRulesDirty(false);
      setChecking(false);
    }, 220);
  };

  const acceptIssue = (issue: Issue) => {
    if (!issue.suggestedValue) return;
    beginTransaction(
      `字幕 #${entries.find((entry) => entry.id === issue.entryId)?.sequenceRaw ?? ""} 的修改`,
    );
    const nextEntries = entries.map((entry) =>
      entry.id === issue.entryId
        ? { ...entry, workingText: issue.suggestedValue as string }
        : entry,
    );
    const marked = issues.map((candidate) =>
      candidate.id === issue.id
        ? { ...candidate, status: "accepted" as const }
        : candidate,
    );
    setEntries(nextEntries);
    setIssues(runChecks(nextEntries, rules, marked));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(issue.id);
      return next;
    });
    addToast(
      `已接受字幕 #${entries.find((entry) => entry.id === issue.entryId)?.sequenceRaw ?? ""} 的修改`,
    );
  };

  const ignoreIssue = (issue: Issue) => {
    beginTransaction(
      `字幕 #${entries.find((entry) => entry.id === issue.entryId)?.sequenceRaw ?? ""} 的忽略操作`,
    );
    setIssues((current) =>
      current.map((candidate) =>
        candidate.id === issue.id
          ? { ...candidate, status: "ignored" }
          : candidate,
      ),
    );
    setSelected((current) => {
      const next = new Set(current);
      next.delete(issue.id);
      return next;
    });
    addToast("已忽略 1 条修改建议");
  };

  const manualEdit = (issue: Issue, text: string) => {
    beginTransaction(
      `字幕 #${entries.find((entry) => entry.id === issue.entryId)?.sequenceRaw ?? ""} 的手动编辑`,
    );
    const nextEntries = entries.map((entry) =>
      entry.id === issue.entryId ? { ...entry, workingText: text } : entry,
    );
    const marked = issues.map((candidate) =>
      candidate.id === issue.id
        ? {
            ...candidate,
            status: "manual" as const,
            suggestedValue: text,
            message: "已手动编辑字幕文本",
          }
        : candidate,
    );
    setEntries(nextEntries);
    setIssues(runChecks(nextEntries, rules, marked));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(issue.id);
      return next;
    });
    addToast(
      `字幕 #${entries.find((entry) => entry.id === issue.entryId)?.sequenceRaw ?? ""} 已更新`,
    );
  };

  const reopenIssue = (issue: Issue) => {
    beginTransaction("重新处理修改建议");
    if (issue.status === "ignored") {
      setIssues((current) =>
        current.map((candidate) =>
          candidate.id === issue.id
            ? { ...candidate, status: "pending" }
            : candidate,
        ),
      );
      return;
    }
    const nextEntries = entries.map((entry) =>
      entry.id === issue.entryId
        ? { ...entry, workingText: issue.originalValue }
        : entry,
    );
    const remaining = issues.filter((candidate) => candidate.id !== issue.id);
    setEntries(nextEntries);
    setIssues(runChecks(nextEntries, rules, remaining));
  };

  const batchIgnore = () => {
    const ids = selected;
    if (ids.size === 0) return;
    beginTransaction("批量忽略");
    const count = issues.filter(
      (issue) => ids.has(issue.id) && issue.category === "content",
    ).length;
    setIssues((current) =>
      current.map((issue) =>
        ids.has(issue.id) && issue.category === "content"
          ? { ...issue, status: "ignored" }
          : issue,
      ),
    );
    setSelected(new Set());
    addToast(`已忽略 ${count} 条修改建议`);
  };

  const batchAccept = () => {
    const chosen = issues.filter(
      (issue) =>
        selected.has(issue.id) &&
        issue.category === "content" &&
        issue.suggestedValue,
    );
    if (chosen.length === 0) return;
    beginTransaction("批量接受");
    const rulesByEntry = new Map<string, ContentRuleId[]>();
    chosen.forEach((issue) =>
      rulesByEntry.set(issue.entryId, [
        ...(rulesByEntry.get(issue.entryId) ?? []),
        issue.ruleId as ContentRuleId,
      ]),
    );
    const nextEntries = entries.map((entry) => {
      const enabled = CONTENT_RULE_ORDER.filter((ruleId) =>
        rulesByEntry.get(entry.id)?.includes(ruleId),
      );
      return enabled.length
        ? {
            ...entry,
            workingText: applyEnabledContentRules(entry.workingText, enabled),
          }
        : entry;
    });
    const marked = issues.map((issue) =>
      selected.has(issue.id) && issue.category === "content"
        ? { ...issue, status: "accepted" as const }
        : issue,
    );
    setEntries(nextEntries);
    setIssues(runChecks(nextEntries, rules, marked));
    setSelected(new Set());
    addToast(`已接受 ${chosen.length} 条修改建议`);
  };

  const undo = () => {
    const result = popUndo(undoStack);
    if (!result.snapshot) return;
    setRedoStack((stack) => pushUndo(stack, snapshot(result.snapshot!.label)));
    setUndoStack(result.stack);
    setEntries(result.snapshot.entries);
    setIssues(result.snapshot.issues);
    setSelected(new Set(result.snapshot.selectedIssueIds));
    addToast(`已撤销${result.snapshot.label}`);
  };

  const redo = () => {
    const result = popUndo(redoStack);
    if (!result.snapshot) return;
    setUndoStack((stack) => pushUndo(stack, snapshot(result.snapshot!.label)));
    setRedoStack(result.stack);
    setEntries(result.snapshot.entries);
    setIssues(result.snapshot.issues);
    setSelected(new Set(result.snapshot.selectedIssueIds));
    addToast(`已重做${result.snapshot.label}`);
  };

  const reset = () => {
    setToasts([]);
    setFileName("");
    setEntries([]);
    setIssues([]);
    setSelected(new Set());
    setUndoStack([]);
    setRedoStack([]);
    setUploadError(null);
    setExportOpen(false);
    setExportError(null);
  };

  const exportCounts = useMemo(
    () => ({
      accepted: issues.filter(
        (issue) => issue.status === "accepted" || issue.status === "manual",
      ).length,
      ignored: issues.filter((issue) => issue.status === "ignored").length,
      pending: issues.filter((issue) => issue.status === "pending").length,
      structural: issues.filter((issue) => issue.status === "structural")
        .length,
    }),
    [issues],
  );
  const defaultExportName = `${fileName.replace(/\.srt$/i, "")}_checked.srt`;
  const download = (name: string) => {
    try {
      setExportError(null);
      const url = URL.createObjectURL(toUtf8Blob(entries));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setExportOpen(false);
      addToast("新的 SRT 文件已导出");
    } catch {
      setExportError("浏览器未能生成下载文件。");
      addToast("导出失败，字幕内容仍保留在当前页面，请重试");
    }
  };

  return (
    <>
      {!fileName ? (
        <UploadPage
          mode={mode}
          onModeChange={setMode}
          onFile={handleFile}
          isParsing={isParsing}
          error={uploadError}
        />
      ) : mode === "localization" ? (
        <LocalizationSession
          fileName={fileName}
          entries={entries}
          lineEnding={lineEnding}
          onReplace={reset}
          onToast={addToast}
        />
      ) : (
        <Workspace
          fileName={fileName}
          entries={entries}
          issues={issues}
          rules={rules}
          rulesDirty={rulesDirty}
          checking={checking}
          selected={selected}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onRuleChange={changeRule}
          onRunChecks={rerun}
          onSelect={(id, checked) =>
            setSelected((current) => {
              const next = new Set(current);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            })
          }
          onSelectMany={(ids, checked) =>
            setSelected((current) => {
              const next = new Set(current);
              ids.forEach((id) => {
                if (checked) next.add(id);
                else next.delete(id);
              });
              return next;
            })
          }
          onAccept={acceptIssue}
          onIgnore={ignoreIssue}
          onManual={manualEdit}
          onReopen={reopenIssue}
          onBatchAccept={batchAccept}
          onBatchIgnore={batchIgnore}
          onUndo={undo}
          onRedo={redo}
          onExport={() => {
            setExportError(null);
            setExportOpen(true);
          }}
          onReplace={reset}
        />
      )}
      {mode === "basic" && exportOpen && (
        <ExportModal
          defaultName={defaultExportName}
          counts={exportCounts}
          exportError={exportError}
          onClose={() => setExportOpen(false)}
          onExport={download}
        />
      )}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <Check size={16} />
            {toast.message}
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() =>
                setToasts((current) =>
                  current.filter((item) => item.id !== toast.id),
                )
              }
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
