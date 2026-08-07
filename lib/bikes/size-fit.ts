type SizeRange = {
  size: string;
  minCm: number;
  maxCm: number;
};

const enduraceSizeRanges: SizeRange[] = [
  { size: "2XS", minCm: 158, maxCm: 164 },
  { size: "XS", minCm: 164, maxCm: 170 },
  { size: "S", minCm: 170, maxCm: 177 },
  { size: "M", minCm: 177, maxCm: 184 },
  { size: "L", minCm: 184, maxCm: 191 },
  { size: "XL", minCm: 191, maxCm: 197 },
];

function parseBikeLabel(label: string) {
  const match = label.trim().match(/^(.*)\s-\s(2XS|XS|S|M|L|XL|2XL)$/i);
  return match ? { model: match[1], size: match[2].toUpperCase() } : null;
}

export function getBikeSizeWarning(label: string, heightCm: number) {
  const parsed = parseBikeLabel(label);
  if (!parsed || !Number.isFinite(heightCm) || !/endurace/i.test(parsed.model)) return null;

  const selectedRange = enduraceSizeRanges.find((range) => range.size === parsed.size);
  if (!selectedRange || (heightCm >= selectedRange.minCm && heightCm <= selectedRange.maxCm)) return null;

  const recommendedRange = enduraceSizeRanges.find((range) => heightCm >= range.minCm && heightCm <= range.maxCm);
  return {
    selectedSize: selectedRange.size,
    selectedRange,
    recommendedRange: recommendedRange ?? null,
  };
}
