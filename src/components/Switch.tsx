interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  hideLabel?: boolean;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  hideLabel = false,
}: SwitchProps) {
  return (
    <label className="switch-row">
      <span className={hideLabel ? "sr-only" : "switch-copy"}>
        <span className="switch-label">{label}</span>
        {description && (
          <span className="switch-description">{description}</span>
        )}
      </span>
      <input
        className="sr-only"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        className={`switch-control ${checked ? "is-on" : ""}`}
        aria-hidden="true"
      >
        <span />
      </span>
    </label>
  );
}
