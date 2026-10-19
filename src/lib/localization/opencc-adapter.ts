import OpenCC from "opencc-js/cn2t";
import OpenCCToSimplified from "opencc-js/t2cn";

export interface TraditionalChineseConverter {
  convert(text: string): string;
}

const convert = OpenCC.Converter({ from: "cn", to: "tw" });
const convertToSimplified = OpenCCToSimplified.Converter({
  from: "tw",
  to: "cn",
});

export const openCcTaiwanAdapter: TraditionalChineseConverter = {
  convert(text: string) {
    return convert(text);
  },
};

export function convertToTaiwanTraditional(text: string): string {
  return openCcTaiwanAdapter.convert(text);
}

/** Used only for matching user glossary variants; exported text stays Taiwan Traditional. */
export function convertToSimplifiedChinese(text: string): string {
  return convertToSimplified(text);
}
