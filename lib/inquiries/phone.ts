const INTERNATIONAL_PHONE_PATTERN = /^\+[1-9]\d{0,2}(?:[\s().-]?\d){7,14}$/;

export function isValidInternationalPhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  return digits.length >= 8 && digits.length <= 15 && INTERNATIONAL_PHONE_PATTERN.test(trimmed);
}
