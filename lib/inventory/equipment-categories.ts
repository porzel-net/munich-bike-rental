export const equipmentCategories = [
  "pedal",
  "computer-mount",
  "helmet",
  "clothing",
  "bag",
  "glasses",
  "bottle-holder",
  "repair-kit",
] as const;

export type EquipmentCategory = (typeof equipmentCategories)[number];

export const equipmentCategoryLabels: Record<EquipmentCategory, string> = {
  pedal: "Pedale",
  "computer-mount": "Computer-Halterung",
  helmet: "Helm",
  clothing: "Kleidung",
  bag: "Bikepacking-Tasche",
  glasses: "Rennradbrille",
  "bottle-holder": "Flaschenhalter",
  "repair-kit": "Reparaturset",
};

/** These items are attached to a bike, so their stock is not a booking limit. */
export const defaultUncountedEquipmentCategories = new Set<EquipmentCategory>(["bottle-holder", "repair-kit"]);

export function isEquipmentCategory(value: string): value is EquipmentCategory {
  return (equipmentCategories as readonly string[]).includes(value);
}
