import { AlertTriangle, Check, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ExportModalProps {
  defaultName: string;
  counts: {
    accepted: number;
    ignored: number;
    pending: number;
    structural: number;
  };
  exportError: string | null;
  onClose: () => void;
  onExport: (name: string) => void;
}

export function ExportModal({
  defaultName,
  counts,
  exportError,
  onClose,
  onExport,
}: ExportModalProps) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请输入导出文件名");
      return;
    }
    onExport(
      trimmed.toLowerCase().endsWith(".srt") ? trimmed : `${trimmed}.srt`,
    );
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="export-title">确认导出字幕</h2>
            <p>请确认处理结果和文件信息</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭导出弹窗"
            title="关闭"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="summary-grid">
          <div className="summary-item accepted">
            <span>已接受修改</span>
            <strong>{counts.accepted}</strong>
          </div>
          <div className="summary-item">
            <span>已忽略建议</span>
            <strong>{counts.ignored}</strong>
          </div>
          <div className="summary-item pending">
            <span>尚未处理</span>
            <strong>{counts.pending}</strong>
          </div>
          <div className="summary-item structural">
            <span>结构问题</span>
            <strong>{counts.structural}</strong>
          </div>
        </div>
        {(counts.pending > 0 || counts.structural > 0) && (
          <div className="export-warning">
            <AlertTriangle size={18} />
            <div>
              <strong>仍有问题未处理</strong>
              <p>你可以返回继续检查，也可以保留当前内容直接导出。</p>
            </div>
          </div>
        )}
        {exportError && (
          <div className="export-error" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>导出失败</strong>
              <p>
                {exportError} 字幕内容仍保留在当前页面，你可以重新尝试导出。
              </p>
            </div>
          </div>
        )}
        <div className="form-field">
          <label htmlFor="export-name">文件名</label>
          <input
            ref={inputRef}
            id="export-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            aria-describedby={error ? "filename-error" : undefined}
          />
          {error && (
            <span id="filename-error" className="field-error" role="alert">
              {error}
            </span>
          )}
        </div>
        <dl className="export-meta">
          <div>
            <dt>文件格式</dt>
            <dd>SRT</dd>
          </div>
          <div>
            <dt>字符编码</dt>
            <dd>UTF-8，无 BOM</dd>
          </div>
          <div>
            <dt>换行格式</dt>
            <dd>Windows CRLF</dd>
          </div>
        </dl>
        <div className="locked-option">
          <span>
            <Check size={13} />
          </span>
          <div>
            <strong>保留原字幕时间轴</strong>
            <p>结构问题只提示，不会自动调整</p>
          </div>
        </div>
        <p className="no-overwrite">导出会生成新文件，不会覆盖原文件</p>
        <div className="modal-actions">
          <button
            className="text-button neutral"
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <button className="secondary-button" type="button" onClick={onClose}>
            返回继续检查
          </button>
          <button className="primary-button" type="button" onClick={submit}>
            <Download size={16} />
            {exportError ? "重新导出" : "继续导出"}
          </button>
        </div>
      </section>
    </div>
  );
}
