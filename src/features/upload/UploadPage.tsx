import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  LockKeyhole,
  UploadCloud,
} from "lucide-react";
import { Brand } from "../../components/Brand";
import type { TaskMode } from "../../types/localization";

interface UploadPageProps {
  onFile: (file: File) => void;
  isParsing: boolean;
  error: string | null;
  mode: TaskMode;
  onModeChange: (mode: TaskMode) => void;
}

export function UploadPage({
  onFile,
  isParsing,
  error,
  mode,
  onModeChange,
}: UploadPageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const receiveFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="upload-page">
      <header className="upload-header">
        <Brand />
        <button
          className="text-button"
          type="button"
          onClick={() => setShowHelp((value) => !value)}
          aria-expanded={showHelp}
        >
          使用说明
        </button>
      </header>
      <main className="upload-main">
        <div className="mode-picker" aria-label="任务模式">
          <button
            className={mode === "basic" ? "is-active" : ""}
            type="button"
            onClick={() => onModeChange("basic")}
          >
            <strong>基础检查</strong>
            <span>标点、空格与结构</span>
          </button>
          <button
            className={mode === "localization" ? "is-active" : ""}
            type="button"
            onClick={() => onModeChange("localization")}
          >
            <strong>字幕本土化</strong>
            <span>简体中文 → 台湾繁体 / 英文</span>
          </button>
        </div>
        <div className="upload-intro">
          <span className="eyebrow">
            {mode === "basic"
              ? "交付前的最后一道检查"
              : "可控、逐条确认的本土化"}
          </span>
          <h1>
            {mode === "basic"
              ? "上传字幕，快速完成交付前检查"
              : "将现有简体中文字幕本土化为台湾繁体或英文"}
          </h1>
          <p>
            {mode === "basic"
              ? "自动发现标点、英文大小写、空格和时间轴格式问题，所有修改均由你确认"
              : "离线生成字符、地区用语和企业术语建议，不翻译、不自由改写、不调整时间轴"}
          </p>
        </div>

        {showHelp && (
          <section className="help-strip" aria-label="使用说明">
            <CheckCircle2 size={18} />
            <span>
              {mode === "basic"
                ? "导入一个 SRT，开启需要的规则，逐条确认后导出新文件。原文件不会被覆盖。"
                : "导入简体中文 SRT，选择台湾繁体或英文方向，导入术语表并逐条确认。"}
            </span>
          </section>
        )}

        {mode === "localization" && (
          <section className="pre-upload-note" aria-label="企业术语资料说明">
            <FileUp size={19} />
            <div>
              <strong>已有企业术语表？原文件可以直接用</strong>
              <span>
                上传 SRT 后可继续添加 Word、Excel、CSV 或
                JSON；系统会自动识别对照列，无需预先套模板。
              </span>
            </div>
          </section>
        )}

        <section
          className={`drop-zone ${dragging ? "is-dragging" : ""} ${error ? "has-error" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            receiveFiles(event.dataTransfer.files);
          }}
          onClick={() => !isParsing && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".srt,application/x-subrip"
            onChange={(event) => receiveFiles(event.target.files)}
            aria-label="选择 SRT 文件"
          />
          {isParsing ? (
            <>
              <span className="upload-icon is-loading">
                <UploadCloud size={30} />
              </span>
              <h2>正在读取字幕文件</h2>
              <p>解析字幕序号、时间码和文本内容…</p>
              <div className="loading-line" aria-label="解析中" />
            </>
          ) : error ? (
            <>
              <span className="upload-icon error">
                <AlertCircle size={30} />
              </span>
              <h2>无法读取这个字幕文件</h2>
              <p className="upload-error" role="alert">
                {error}
              </p>
              <button
                className="primary-button"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                重新选择文件
              </button>
              <details
                className="format-example"
                onClick={(event) => event.stopPropagation()}
              >
                <summary>查看 SRT 格式示例</summary>
                <pre>{`1\n00:00:01,000 --> 00:00:03,000\n字幕文本`}</pre>
              </details>
            </>
          ) : (
            <>
              <span className="upload-icon">
                <FileUp size={30} />
              </span>
              <h2>{dragging ? "松开以上传字幕文件" : "拖放 SRT 文件到这里"}</h2>
              <p>或点击选择文件</p>
              <button
                className="primary-button"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                选择 SRT 文件
              </button>
              <span className="upload-note">
                <LockKeyhole size={14} /> 当前仅支持单个 .srt
                文件，文件将在本地处理
              </span>
            </>
          )}
        </section>

        <ol className="steps" aria-label="处理步骤">
          {(mode === "basic"
            ? ["导入 SRT", "检查并确认修改", "导出新字幕"]
            : ["导入简体 SRT", "设置规则与术语", "确认并导出字幕"]
          ).map((label, index) => (
            <li key={label}>
              <span>{index + 1}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
        <p className="privacy-note">
          <LockKeyhole size={13} />{" "}
          字幕只在当前浏览器标签页中处理，不会上传或生成账号记录
        </p>
      </main>
    </div>
  );
}
