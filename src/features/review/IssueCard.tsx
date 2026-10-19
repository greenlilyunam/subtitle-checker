import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleAlert,
  Edit3,
  RotateCcw,
  X,
} from "lucide-react";
import { RULE_LABELS } from "../../lib/rules/checker";
import type { Issue, SubtitleEntry } from "../../types";

interface IssueCardProps {
  issue: Issue;
  entry: SubtitleEntry;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onAccept: () => void;
  onIgnore: () => void;
  onManual: (text: string) => void;
  onReopen: () => void;
}

const STATUS_LABELS: Record<Issue["status"], string> = {
  pending: "待确认",
  accepted: "已接受",
  ignored: "已忽略",
  manual: "已手动编辑",
  structural: "结构问题",
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
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix += 1;
  return {
    beforeStart: before.slice(0, prefix),
    removed: before.slice(
      prefix,
      suffix ? before.length - suffix : before.length,
    ),
    added: after.slice(prefix, suffix ? after.length - suffix : after.length),
    end: suffix ? before.slice(before.length - suffix) : "",
  };
}

function DiffView({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => diffParts(before, after), [before, after]);
  return (
    <div className="diff-stack">
      <div className="caption-block original-block">
        <span className="caption-label">原字幕</span>
        <p>
          {parts.beforeStart}
          {parts.removed && <del title="将删除">{parts.removed}</del>}
          {parts.end}
        </p>
      </div>
      <div className="caption-block suggestion-block">
        <span className="caption-label">修改后</span>
        <p>
          {parts.beforeStart}
          {parts.added && <ins title="将新增">{parts.added}</ins>}
          {parts.end}
        </p>
      </div>
      <div className="diff-legend">
        <span>
          <i className="removed-dot" />
          删除内容
        </span>
        <span>
          <i className="added-dot" />
          新增内容
        </span>
      </div>
    </div>
  );
}

export function IssueCard({
  issue,
  entry,
  selected,
  onSelect,
  onAccept,
  onIgnore,
  onManual,
  onReopen,
}: IssueCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.workingText);
  const [showRaw, setShowRaw] = useState(false);
  const selectable =
    issue.category === "content" &&
    (issue.status === "pending" || issue.status === "ignored") &&
    Boolean(issue.suggestedValue);
  useEffect(() => setDraft(entry.workingText), [entry.workingText]);

  const cancelEdit = () => {
    setDraft(entry.workingText);
    setEditing(false);
  };
  const saveEdit = () => {
    onManual(draft);
    setEditing(false);
  };

  return (
    <article
      className={`issue-card status-${issue.status} category-${issue.category}`}
    >
      <div className="proof-track" aria-hidden="true">
        <span />
      </div>
      <div className="issue-card-inner">
        <header className="issue-header">
          <label
            className={`issue-select ${!selectable ? "is-disabled" : ""}`}
            title={
              !selectable && issue.category === "structure"
                ? "结构问题不能自动修改"
                : undefined
            }
          >
            <input
              type="checkbox"
              checked={selected}
              disabled={!selectable}
              onChange={(event) => onSelect(event.target.checked)}
              aria-label={`选择字幕 ${entry.sequenceRaw || entry.order + 1} 的${RULE_LABELS[issue.ruleId]}问题`}
            />
          </label>
          <span className="entry-number">
            #{entry.sequenceRaw || entry.order + 1}
          </span>
          <code className="timecode">{entry.timecodeRaw || "缺少时间码"}</code>
          <span className={`rule-badge ${issue.category}`}>
            {issue.category === "structure" ? (
              <CircleAlert size={12} />
            ) : (
              <AlertTriangle size={12} />
            )}
            {RULE_LABELS[issue.ruleId]}
          </span>
          <span className={`status-badge ${issue.status}`}>
            {issue.status === "accepted" && <Check size={12} />}
            {issue.status === "ignored" && <X size={12} />}
            {STATUS_LABELS[issue.status]}
          </span>
        </header>

        <div className="issue-reason">
          <strong>{issue.message}</strong>
          {issue.detail &&
            (issue.category === "structure" ? (
              <span>{issue.detail}</span>
            ) : (
              <details className="reason-details">
                <summary>查看详情</summary>
                <span>{issue.detail}</span>
              </details>
            ))}
        </div>

        {editing ? (
          <div className="manual-editor">
            <label htmlFor={`edit-${issue.id}`}>手动编辑字幕</label>
            <textarea
              id={`edit-${issue.id}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelEdit();
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey))
                  saveEdit();
              }}
            />
            <p>按 Ctrl / ⌘ + Enter 保存，Esc 取消</p>
            <div className="edit-actions">
              <button
                className="secondary-button small"
                type="button"
                onClick={cancelEdit}
              >
                取消
              </button>
              <button
                className="primary-button small"
                type="button"
                onClick={saveEdit}
              >
                保存修改
              </button>
            </div>
          </div>
        ) : issue.category === "content" &&
          issue.suggestedValue !== undefined ? (
          <DiffView
            before={issue.originalValue}
            after={
              issue.status === "manual"
                ? entry.workingText
                : issue.suggestedValue
            }
          />
        ) : (
          <div className="structure-detail">
            <div>
              <span className="caption-label">相关原始值</span>
              <code>{issue.originalValue || "空内容"}</code>
            </div>
            <p>结构问题只提示，不会自动修改序号或时间码。</p>
            <button
              className="text-button"
              type="button"
              onClick={() => setShowRaw((value) => !value)}
              aria-expanded={showRaw}
            >
              查看原始字幕 <ChevronDown size={14} />
            </button>
            {showRaw && <pre>{entry.rawBlock}</pre>}
          </div>
        )}

        <footer className="issue-actions">
          {issue.status === "accepted" ||
          issue.status === "ignored" ||
          issue.status === "manual" ? (
            <button
              className="secondary-button small"
              type="button"
              onClick={onReopen}
            >
              <RotateCcw size={14} />
              重新处理
            </button>
          ) : issue.category === "content" ? (
            <>
              <button
                className="text-button neutral"
                type="button"
                onClick={() => setEditing(true)}
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
              {issue.suggestedValue && (
                <button
                  className="primary-button small"
                  type="button"
                  onClick={onAccept}
                >
                  接受修改
                </button>
              )}
            </>
          ) : null}
        </footer>
      </div>
    </article>
  );
}
