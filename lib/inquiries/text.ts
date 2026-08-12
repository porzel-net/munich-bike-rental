const windows1252Bytes = new Map([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
]);

function suspiciousCount(value: string) {
  return (value.match(/[ÃÂâ�]/g) ?? []).length + (value.match(/[\u0080-\u009f]/g) ?? []).length;
}

function asWindows1252Bytes(value: string) {
  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const byte = codePoint <= 0xff ? codePoint : windows1252Bytes.get(character);
    if (byte === undefined) return null;
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

/** Repairs text that was decoded as latin1/windows-1252 instead of UTF-8. */
export function repairMojibake(value: string) {
  if (!suspiciousCount(value)) return value;
  const candidates = [Buffer.from(value, "latin1").toString("utf8")];
  const windowsBytes = asWindows1252Bytes(value);
  if (windowsBytes) candidates.push(windowsBytes.toString("utf8"));
  return candidates.reduce((best, candidate) =>
    suspiciousCount(candidate) < suspiciousCount(best) ? candidate : best,
  );
}
