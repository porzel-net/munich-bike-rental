function slugPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function createBikeKey(title: string, size: string) {
  return `${slugPart(title)}-${slugPart(size)}`;
}

export function getBikeKeyForUpdate(input: {
  existingBikeKey: string;
  existingTitle: string;
  existingSize: string | null;
  nextTitle: string;
  nextSize: string;
}) {
  const nextTitle = input.nextTitle.trim();
  const nextSize = input.nextSize.trim();
  if (input.existingTitle === nextTitle && input.existingSize === nextSize) return input.existingBikeKey;
  return createBikeKey(nextTitle, nextSize);
}
