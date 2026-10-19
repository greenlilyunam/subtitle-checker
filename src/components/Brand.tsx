import { Captions } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="字幕检查器">
      <span className="brand-mark" aria-hidden="true">
        <Captions size={18} strokeWidth={2.2} />
      </span>
      <span className="brand-name">字幕检查器</span>
      {!compact && <span className="brand-tagline">字幕交付前检查工具</span>}
    </div>
  );
}
