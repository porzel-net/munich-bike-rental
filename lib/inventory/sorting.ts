type SortableBike = {
  id: number;
  location: string;
  title: string;
  size: string;
};

const bikeSizeOrder = new Map(
  ["3XS", "2XS", "XS", "S", "M", "L", "XL", "2XL", "XXL"].map((size, index) => [size, index]),
);
const bikeCollator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

function compareBikeSizes(left: string, right: string) {
  const leftSize = left.trim().toUpperCase();
  const rightSize = right.trim().toUpperCase();
  const leftIndex = bikeSizeOrder.get(leftSize);
  const rightIndex = bikeSizeOrder.get(rightSize);

  if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
  if (leftIndex !== undefined) return -1;
  if (rightIndex !== undefined) return 1;
  return bikeCollator.compare(left, right);
}

export function compareInventoryBikes(left: SortableBike, right: SortableBike) {
  const locationComparison = bikeCollator.compare(left.location, right.location);
  if (locationComparison !== 0) return locationComparison;

  const modelComparison = bikeCollator.compare(left.title, right.title);
  if (modelComparison !== 0) return modelComparison;

  const sizeComparison = compareBikeSizes(left.size, right.size);
  if (sizeComparison !== 0) return sizeComparison;

  return left.id - right.id;
}
