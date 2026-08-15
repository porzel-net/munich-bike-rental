import type { bookings, rentalAssets } from "../db/schema";

const HISTORICAL_REGIONAL_EXCEPTION = {
  location: "regensburg",
  modelTitle: "Endurace CF SL 8",
  size: "S",
  from: "2026-07-26",
  to: "2026-08-10",
} as const;

type BookingLike = Pick<typeof bookings.$inferSelect, "source" | "location" | "periodFrom" | "periodTo">;
type AssetLike = Pick<typeof rentalAssets.$inferSelect, "location" | "state"> & {
  modelTitle: string;
  size: string;
};

export function isHistoricalRegensburgEnduraceSAsset(asset: AssetLike) {
  return (
    asset.location === HISTORICAL_REGIONAL_EXCEPTION.location &&
    asset.modelTitle === HISTORICAL_REGIONAL_EXCEPTION.modelTitle &&
    asset.size.toLocaleLowerCase() === HISTORICAL_REGIONAL_EXCEPTION.size.toLocaleLowerCase()
  );
}

/** Allows the historically issued Regensburg Endurace S to be assigned to imported records only. */
export function isHistoricalRegensburgEnduraceSException(booking: BookingLike, asset: AssetLike) {
  return (
    booking.source === "legacy" &&
    booking.location === HISTORICAL_REGIONAL_EXCEPTION.location &&
    booking.periodFrom >= HISTORICAL_REGIONAL_EXCEPTION.from &&
    booking.periodTo <= HISTORICAL_REGIONAL_EXCEPTION.to &&
    isHistoricalRegensburgEnduraceSAsset(asset)
  );
}

export function isAssetSelectableForBooking(booking: BookingLike, asset: AssetLike) {
  return asset.state === "active" || isHistoricalRegensburgEnduraceSException(booking, asset);
}
