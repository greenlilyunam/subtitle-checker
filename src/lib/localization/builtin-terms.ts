import type {
  LocalizationAction,
  LocalizationRisk,
  LocalizationType,
} from "../../types/localization";

export interface BuiltinTerm {
  source: string;
  target: string;
  action: LocalizationAction;
  risk: LocalizationRisk;
  type: LocalizationType;
  group: "regional" | "software";
  reason: string;
}

const regional = (
  source: string,
  target: string,
  risk: LocalizationRisk,
  reason: string,
  action: LocalizationAction = "replace",
): BuiltinTerm => ({
  source,
  target,
  risk,
  reason,
  action,
  type: "regional",
  group: "regional",
});
const software = (
  source: string,
  target: string,
  risk: LocalizationRisk,
  reason: string,
  action: LocalizationAction = "replace",
): BuiltinTerm => ({
  source,
  target,
  risk,
  reason,
  action,
  type: "technical",
  group: "software",
});

// The product copy guide intentionally keeps these accepted Taiwan forms stable,
// even when the underlying OpenCC dictionary prefers a different glyph variant.
export const BUILTIN_PROTECT_TERMS = ["部署", "平台"];

export const BUILTIN_TERMS: BuiltinTerm[] = [
  regional(
    "视频会议",
    "視訊會議",
    "medium",
    "“视频会议”不能机械处理为“影片會議”，建议使用台湾常见表达“視訊會議”",
    "suggest",
  ),
  regional(
    "物理连接",
    "物理連接",
    "medium",
    "物理连接不套用网络语境的“連線”，仅进行字符转换",
    "warn",
  ),
  regional(
    "网络连接",
    "網路連線",
    "medium",
    "网络连接在台湾技术语境中常用“網路連線”",
  ),
  software(
    "生成工单",
    "建立工單",
    "medium",
    "工作流创建语境建议使用“建立工單”",
    "suggest",
  ),
  software("生成", "建立", "low", "建立工单或内容时，台湾企业语境常用“建立”"),
  software(
    "报警信息",
    "警示資訊",
    "medium",
    "企业软件语境默认建议使用“警示資訊”",
    "suggest",
  ),
  software("数据库", "資料庫", "low", "数据库在台湾软件语境中使用“資料庫”"),
  regional("摄像头", "攝影機", "medium", "监控硬件语境建议使用“攝影機”"),
  software(
    "移动端",
    "行動版",
    "medium",
    "产品端别在台湾常用“行動版”",
    "suggest",
  ),
  software("电脑端", "電腦版", "medium", "产品端别建议使用“電腦版”", "suggest"),
  regional("视频", "影片", "medium", "一般内容语境中“视频”建议使用“影片”"),
  software("软件", "軟體", "low", "台湾软件产品语境中通常使用“軟體”"),
  regional("通过", "透過", "low", "表示方法或渠道时，台湾常用“透過”"),
  regional("硬盘", "硬碟", "low", "计算机语境中台湾常用“硬碟”"),
  regional("信息", "資訊", "low", "信息内容在台湾企业语境中使用“資訊”"),
  regional("数据", "資料", "low", "数据内容在台湾企业语境中使用“資料”"),
  regional("网络", "網路", "low", "网络在台湾技术语境中使用“網路”"),
  software(
    "接入",
    "介接",
    "medium",
    "系统或设备整合语境建议使用“介接”",
    "suggest",
  ),
  software("默认", "預設", "low", "软件设置语境中使用“預設”"),
  software("支持", "支援", "low", "功能支持在台湾软件语境中使用“支援”"),
  software("用户", "使用者", "low", "软件产品语境中使用“使用者”"),
  software("账号", "帳號", "low", "登入语境中使用“帳號”"),
  software("登录", "登入", "low", "账号登录在台湾软件语境中使用“登入”"),
  software(
    "后台",
    "管理後台",
    "medium",
    "管理系统语境建议使用“管理後台”",
    "suggest",
  ),
  software("打开", "開啟", "low", "开启页面或功能时使用“開啟”"),
  software("点击", "點選", "low", "界面操作在台湾常用“點選”"),
  regional("这里", "此處", "medium", "位置指示默认建议使用“此處”", "suggest"),
  regional("连接", "連線", "medium", "网络连接语境中建议使用“連線”"),
  software("算法", "演算法", "low", "技术语境中使用“演算法”"),
  software("识别", "辨識", "low", "AI 与图像识别语境中使用“辨識”"),
  software("检测", "偵測", "medium", "设备或系统检测语境建议使用“偵測”"),
  software("创建", "建立", "low", "创建账户或工单时使用“建立”"),
  regional("记录", "紀錄", "low", "名词或动词默认建议使用“紀錄”"),
  software("运维", "維運", "low", "IT 与设备运维语境中使用“維運”"),
  regional("联系", "聯絡", "low", "联系人员时台湾常用“聯絡”"),
  regional("访问", "前往", "medium", "访问网址的语境建议使用“前往”", "suggest"),
  regional(
    "邮件",
    "電子郵件",
    "medium",
    "正式文案中建议使用“電子郵件”",
    "suggest",
  ),
  software("工单", "工單", "low", "工单只需进行台湾繁体字符转换"),
];

export const LOCALIZATION_TYPE_LABELS: Record<LocalizationType, string> = {
  character: "简繁字符",
  regional: "台湾用词",
  technical: "企业/技术用语",
  format: "标点与空格",
  custom: "自定义术语",
  warning: "疑似漏改",
  conflict: "术语冲突",
};

export const LOCALIZATION_SOURCE_LABELS = {
  "custom-glossary": "企业术语表",
  "builtin-glossary": "内置用语",
  character: "字符转换",
  format: "格式规则",
  conflict: "术语冲突",
  "risk-scan": "风险扫描",
} as const;
