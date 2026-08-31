const receiptRequiredCategoryCodes = new Set(["spare_parts_consumables"]);

export function requiresFinancialDocument(categoryCode: string) {
  return receiptRequiredCategoryCodes.has(categoryCode);
}
