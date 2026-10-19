import {
  CheckCheck,
  CircleDashed,
  List,
  SlidersHorizontal,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export type ReviewView = "pending" | "processed" | "all";

export function ReviewNavigation({
  view,
  onView,
  pending,
  processed,
  total,
  filterCount,
  children,
}: {
  view: ReviewView;
  onView: (view: ReviewView) => void;
  pending: number;
  processed: number;
  total: number;
  filterCount: number;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const filterId = useId();
  return (
    <aside className="filter-panel review-navigation" aria-label="问题筛选">
      <div className="filter-title">
        <h2>校对列表</h2>
      </div>
      <div className="filter-scroll">
        <nav className="filter-group" aria-label="处理状态">
          {(
            [
              ["pending", "待处理", pending, CircleDashed],
              ["processed", "已处理", processed, CheckCheck],
              ["all", "全部", total, List],
            ] as const
          ).map(([id, label, count, Icon]) => (
            <button
              key={id}
              type="button"
              className={view === id ? "is-active" : ""}
              aria-pressed={view === id}
              onClick={() => onView(id)}
            >
              <Icon size={15} />
              <span>{label}</span>
              <b>{count}</b>
            </button>
          ))}
        </nav>
        <div className="advanced-filters">
          <button
            className="filter-toggle"
            type="button"
            aria-label="筛选"
            aria-expanded={expanded}
            aria-controls={filterId}
            onClick={() => setExpanded(!expanded)}
          >
            <SlidersHorizontal size={15} />
            <span>筛选</span>
            {filterCount > 0 && <b>{filterCount}</b>}
          </button>
          {expanded && (
            <div id={filterId} className="filter-fields">
              {children}
            </div>
          )}
        </div>
      </div>
      <p className="navigation-footnote">
        逐条确认，随时撤销
        <br />
        所有文件仅在本地处理
      </p>
    </aside>
  );
}

export function ReviewProgress({
  processed,
  total,
  structural = 0,
}: {
  processed: number;
  total: number;
  structural?: number;
}) {
  return (
    <div className="review-progress">
      <div>
        <span>
          已处理{" "}
          <strong>
            {processed} / {total}
          </strong>
        </span>
        <small>
          {structural > 0
            ? `${structural} 项结构问题待人工检查`
            : `剩余 ${Math.max(0, total - processed)} 条`}
        </small>
      </div>
      <progress
        aria-label="校对处理进度"
        value={processed}
        max={Math.max(1, total)}
      />
    </div>
  );
}
