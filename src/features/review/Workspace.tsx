import {
  CheckCircle2,
  Redo2,
  RotateCcw,
  Settings2,
  Undo2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Brand } from "../../components/Brand";
import {
  ReviewNavigation,
  ReviewProgress,
  type ReviewView,
} from "../../components/ReviewNavigation";
import { ToolDrawer } from "../../components/ToolDrawer";
import { RULE_LABELS } from "../../lib/rules/checker";
import type {
  Issue,
  IssueStatus,
  RuleId,
  RulesConfig,
  SubtitleEntry,
} from "../../types";
import { IssueCard } from "./IssueCard";
import { RulesPanel } from "../rules/RulesPanel";

type TypeFilter = "all" | RuleId;

interface WorkspaceProps {
  fileName: string;
  entries: SubtitleEntry[];
  issues: Issue[];
  rules: RulesConfig;
  rulesDirty: boolean;
  checking: boolean;
  selected: Set<string>;
  canUndo: boolean;
  canRedo: boolean;
  onRuleChange: (ruleId: RuleId, checked: boolean) => void;
  onRunChecks: () => void;
  onSelect: (id: string, checked: boolean) => void;
  onSelectMany: (ids: string[], checked: boolean) => void;
  onAccept: (issue: Issue) => void;
  onIgnore: (issue: Issue) => void;
  onManual: (issue: Issue, text: string) => void;
  onReopen: (issue: Issue) => void;
  onBatchAccept: () => void;
  onBatchIgnore: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onReplace: () => void;
}

const typeFilters: Array<{ id: TypeFilter; label: string }> = [
  { id: "all", label: "全部类型" },
  ...Object.entries(RULE_LABELS).map(([id, label]) => ({
    id: id as RuleId,
    label,
  })),
];

export function Workspace(props: WorkspaceProps) {
  const [view, setView] = useState<ReviewView>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | IssueStatus>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [rulesOpen, setRulesOpen] = useState(false);
  const entryMap = useMemo(
    () => new Map(props.entries.map((entry) => [entry.id, entry])),
    [props.entries],
  );
  const filtered = props.issues.filter(
    (issue) =>
      (view === "all" ||
        (view === "pending"
          ? ["pending", "structural"].includes(issue.status)
          : ["accepted", "ignored", "manual"].includes(issue.status))) &&
      (statusFilter === "all" || issue.status === statusFilter) &&
      (typeFilter === "all" || issue.ruleId === typeFilter),
  );
  const selectableIds = filtered
    .filter(
      (issue) =>
        issue.category === "content" &&
        (issue.status === "pending" || issue.status === "ignored") &&
        issue.suggestedValue,
    )
    .map((issue) => issue.id);
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => props.selected.has(id));
  const selectedIssues = props.issues.filter((issue) =>
    props.selected.has(issue.id),
  );
  const selectedContentCount = selectedIssues.filter(
    (issue) => issue.category === "content",
  ).length;
  const counts = {
    total: props.issues.length,
    pending: props.issues.filter((issue) => issue.status === "pending").length,
    accepted: props.issues.filter(
      (issue) => issue.status === "accepted" || issue.status === "manual",
    ).length,
    ignored: props.issues.filter((issue) => issue.status === "ignored").length,
    structural: props.issues.filter((issue) => issue.status === "structural")
      .length,
  };

  const title =
    view === "pending"
      ? "待处理的问题"
      : view === "processed"
        ? "已处理的问题"
        : "全部检查结果";
  const cancelTask = () => {
    const hasSessionWork = counts.accepted > 0 || counts.ignored > 0;
    if (
      !hasSessionWork ||
      window.confirm("取消本次任务？当前处理进度不会保存。")
    )
      props.onReplace();
  };

  return (
    <div className="workspace">
      <header className="workspace-toolbar">
        <Brand compact />
        <div className="file-summary">
          <strong title={props.fileName}>{props.fileName}</strong>
          <span>共 {props.entries.length} 条字幕 · 基础检查</span>
        </div>
        <ReviewProgress
          processed={counts.accepted + counts.ignored}
          total={counts.total}
          structural={counts.structural}
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
            onClick={props.onUndo}
            disabled={!props.canUndo || props.checking}
            aria-label="撤销上一次操作"
            title="撤销上一次操作"
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={props.onRedo}
            disabled={!props.canRedo || props.checking}
            aria-label="重做上一次操作"
            title="重做上一次操作"
          >
            <Redo2 size={18} />
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={props.onExport}
            disabled={props.checking}
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
          pending={counts.pending + counts.structural}
          processed={counts.accepted + counts.ignored}
          total={counts.total}
          filterCount={
            Number(typeFilter !== "all") + Number(statusFilter !== "all")
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
              <option value="pending">待确认</option>
              <option value="accepted">已接受</option>
              <option value="ignored">已忽略</option>
              <option value="manual">手动编辑</option>
              <option value="structural">结构问题</option>
            </select>
          </label>
          <label>
            问题类型
            <select
              aria-label="问题类型"
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as TypeFilter)
              }
            >
              {typeFilters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setTypeFilter("all");
              setStatusFilter("all");
            }}
          >
            清除筛选
          </button>
        </ReviewNavigation>

        <main className="review-column">
          <div className="review-header">
            <div>
              <h1>{title}</h1>
              <p>逐条确认系统建议，原字幕不会被直接覆盖</p>
            </div>
            <div className="review-tools">
              <button
                className="secondary-button small"
                type="button"
                onClick={() => setRulesOpen(true)}
                aria-haspopup="dialog"
              >
                <Settings2 size={15} />
                检查规则{props.rulesDirty && <i className="dirty-dot" />}
              </button>
            </div>
          </div>
          {props.rulesDirty && (
            <div className="workspace-dirty-note" role="status">
              <span>规则已修改，当前结果尚未更新</span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  props.onRunChecks();
                  setRulesOpen(false);
                }}
                disabled={props.checking}
              >
                重新运行检查
              </button>
            </div>
          )}
          <div className="review-selection-bar">
            <span>{filtered.length} 项检查结果 · 按字幕顺序</span>
            <div className="batch-actions">
              <label>
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={selectableIds.length === 0}
                  onChange={(event) =>
                    props.onSelectMany(selectableIds, event.target.checked)
                  }
                />
                全选当前
              </label>
              <span>
                {selectedContentCount > 0
                  ? `已选 ${selectedContentCount} 项`
                  : "选择建议后可批量处理"}
              </span>
              <button
                className="secondary-button small"
                type="button"
                disabled={selectedContentCount === 0 || props.checking}
                onClick={props.onBatchIgnore}
              >
                批量忽略
              </button>
              <button
                className="secondary-button small accent"
                type="button"
                disabled={selectedContentCount === 0 || props.checking}
                onClick={props.onBatchAccept}
              >
                批量接受
              </button>
            </div>
          </div>

          <div className="review-scroll" aria-busy={props.checking}>
            {props.checking ? (
              <div className="checking-state">
                <span className="checking-icon">
                  <RotateCcw size={28} />
                </span>
                <h2>正在检查 {props.entries.length} 条字幕</h2>
                <p>正在重新计算文本规范和时间轴结构</p>
                <div className="progress-track">
                  <span />
                </div>
                <small>正在检查时间轴重叠</small>
              </div>
            ) : filtered.length === 0 ? (
              <div className="clean-state">
                <span>
                  <CheckCircle2 size={30} />
                </span>
                <h2>
                  {props.issues.length === 0
                    ? "没有发现需要处理的问题"
                    : "当前筛选下没有问题"}
                </h2>
                <p>
                  {props.issues.length === 0
                    ? "该字幕已通过当前启用的全部检查规则"
                    : "调整左侧筛选条件查看其他检查结果"}
                </p>
                {props.issues.length === 0 && (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={props.onExport}
                  >
                    导出 SRT
                  </button>
                )}
              </div>
            ) : (
              filtered.map((issue) => {
                const entry = entryMap.get(issue.entryId);
                return entry ? (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    entry={entry}
                    selected={props.selected.has(issue.id)}
                    onSelect={(checked) => props.onSelect(issue.id, checked)}
                    onAccept={() => props.onAccept(issue)}
                    onIgnore={() => props.onIgnore(issue)}
                    onManual={(text) => props.onManual(issue, text)}
                    onReopen={() => props.onReopen(issue)}
                  />
                ) : null;
              })
            )}
          </div>
        </main>
      </div>
      {rulesOpen && (
        <ToolDrawer title="检查规则" onClose={() => setRulesOpen(false)}>
          <RulesPanel
            rules={props.rules}
            dirty={props.rulesDirty}
            checking={props.checking}
            onChange={props.onRuleChange}
            onRun={() => {
              props.onRunChecks();
              setRulesOpen(false);
            }}
          />
        </ToolDrawer>
      )}
    </div>
  );
}
