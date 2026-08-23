export type SizeRange = {
  size: string;
  minCm: number;
  maxCm: number;
};

export const canyonSizeRanges: Record<string, SizeRange[]> = {
  endurace: [
    { size: "3XS", minCm: 152, maxCm: 158 },
    { size: "2XS", minCm: 160, maxCm: 166 },
    { size: "XS", minCm: 166, maxCm: 172 },
    { size: "S", minCm: 172, maxCm: 178 },
    { size: "M", minCm: 178, maxCm: 184 },
    { size: "L", minCm: 184, maxCm: 190 },
    { size: "XL", minCm: 190, maxCm: 196 },
    { size: "2XL", minCm: 196, maxCm: 202 },
  ],
  grail: [
    { size: "2XS", minCm: 163, maxCm: 169 },
    { size: "XS", minCm: 167, maxCm: 175 },
    { size: "S", minCm: 172, maxCm: 181 },
    { size: "M", minCm: 179, maxCm: 187 },
    { size: "L", minCm: 185, maxCm: 193 },
    { size: "XL", minCm: 190, maxCm: 199 },
    { size: "2XL", minCm: 196, maxCm: 202 },
  ],
  ultimate: [
    { size: "3XS", minCm: 154, maxCm: 160 },
    { size: "2XS", minCm: 160, maxCm: 166 },
    { size: "XS", minCm: 166, maxCm: 172 },
    { size: "S", minCm: 172, maxCm: 178 },
    { size: "M", minCm: 178, maxCm: 184 },
    { size: "L", minCm: 184, maxCm: 190 },
    { size: "XL", minCm: 190, maxCm: 196 },
    { size: "2XL", minCm: 196, maxCm: 202 },
  ],
  aeroad: [
    { size: "3XS", minCm: 154, maxCm: 160 },
    { size: "2XS", minCm: 160, maxCm: 166 },
    { size: "XS", minCm: 166, maxCm: 172 },
    { size: "S", minCm: 172, maxCm: 178 },
    { size: "M", minCm: 178, maxCm: 184 },
    { size: "L", minCm: 184, maxCm: 190 },
    { size: "XL", minCm: 190, maxCm: 196 },
    { size: "2XL", minCm: 196, maxCm: 202 },
  ],
};

function parseBikeLabel(label: string) {
  const match = label.trim().match(/^(.*)\s-\s(3XS|2XS|XS|S|M|L|XL|2XL|XXL)$/i);
  return match ? { model: match[1], size: match[2].toUpperCase() } : null;
}

function rangesForModel(model: string) {
  const family = Object.keys(canyonSizeRanges).find((key) => model.toLocaleLowerCase().includes(key));
  return family ? canyonSizeRanges[family] : null;
}

export function hasBikeSizeTable(label: string) {
  return rangesForModel(label) !== null;
}

export function getRecommendedBikeSize(label: string, heightCm: number) {
  if (!Number.isFinite(heightCm)) return null;
  const ranges = rangesForModel(label);
  return ranges?.find((range) => heightCm >= range.minCm && heightCm <= range.maxCm)?.size ?? null;
}

export function getRecommendedHeight(label: string) {
  const parsed = parseBikeLabel(label);
  const range = parsed ? rangesForModel(parsed.model)?.find((item) => item.size === parsed.size) : null;
  return range ? Math.floor((range.minCm + range.maxCm + 1) / 2) : null;
}

export function getBikeSizeWarning(label: string, heightCm: number) {
  const parsed = parseBikeLabel(label);
  if (!parsed || !Number.isFinite(heightCm)) return null;

  const selectedRange = rangesForModel(parsed.model)?.find((range) => range.size === parsed.size);
  if (!selectedRange || (heightCm >= selectedRange.minCm && heightCm <= selectedRange.maxCm)) return null;

  const recommendedRange = rangesForModel(parsed.model)?.find(
    (range) => heightCm >= range.minCm && heightCm <= range.maxCm,
  );
  return {
    selectedSize: selectedRange.size,
    selectedRange,
    recommendedRange: recommendedRange ?? null,
  };
}
