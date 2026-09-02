type FinancialDocumentRequirementCategory = {
  categoryType: string | null;
  euerLine: string | null;
};

export function requiresFinancialDocument(category: FinancialDocumentRequirementCategory) {
  if (!["expense", "fee"].includes(category.categoryType ?? "")) return false;
  return !["wages", "depreciation"].includes(category.euerLine ?? "");
}
