import { RotateCw } from "lucide-react";
import { Switch } from "../../components/Switch";
import type { RuleId, RulesConfig } from "../../types";

interface RulesPanelProps {
  rules: RulesConfig;
  dirty: boolean;
  checking: boolean;
  onChange: (ruleId: RuleId, checked: boolean) => void;
  onRun: () => void;
}

const contentRules: Array<{ id: RuleId; label: string; description: string }> =
  [
    {
      id: "removeTrailingPunctuation",
      label: "删除句末标点",
      description: "保留句中标点与闭合引号",
    },
    {
      id: "capitalizeEnglishStart",
      label: "英文句首大写",
      description: "只处理首个英文字母",
    },
    {
      id: "normalizeWhitespace",
      label: "清理多余空格",
      description: "逐行整理，不合并换行",
    },
  ];

const structureRules: Array<{
  id: RuleId;
  label: string;
  description: string;
}> = [
  {
    id: "checkSequence",
    label: "检查字幕序号",
    description: "重复、缺失或不连续",
  },
  {
    id: "checkTimecode",
    label: "检查时间码格式",
    description: "格式与起止时间",
  },
  {
    id: "checkEmptySubtitle",
    label: "检查空字幕",
    description: "保留原块，仅提示",
  },
  {
    id: "checkOverlap",
    label: "检查时间轴重叠",
    description: "精确显示重叠毫秒数",
  },
];

export function RulesPanel({
  rules,
  dirty,
  checking,
  onChange,
  onRun,
}: RulesPanelProps) {
  return (
    <aside className="rules-panel" aria-label="检查规则">
      <div className="rules-scroll">
        <div className="panel-heading">
          <h2>检查规则</h2>
          <p>内容规则只生成建议，不会直接修改</p>
        </div>
        <section className="rule-group">
          <div className="group-label">
            内容规范 <span>默认关闭</span>
          </div>
          {contentRules.map((rule) => (
            <Switch
              key={rule.id}
              checked={rules[rule.id]}
              onChange={(checked) => onChange(rule.id, checked)}
              label={rule.label}
              description={rule.description}
            />
          ))}
        </section>
        <section className="rule-group">
          <div className="group-label">
            字幕结构检查 <span>默认开启</span>
          </div>
          {structureRules.map((rule) => (
            <Switch
              key={rule.id}
              checked={rules[rule.id]}
              onChange={(checked) => onChange(rule.id, checked)}
              label={rule.label}
              description={rule.description}
            />
          ))}
        </section>
      </div>
      <div className="rules-footer">
        {dirty && (
          <div className="dirty-note" role="status">
            规则已更改，结果尚未更新
          </div>
        )}
        <button
          className={dirty ? "primary-button wide" : "secondary-button wide"}
          type="button"
          onClick={onRun}
          disabled={checking}
        >
          <RotateCw size={15} className={checking ? "spin" : ""} />{" "}
          {checking ? "正在检查" : "重新运行检查"}
        </button>
      </div>
    </aside>
  );
}
