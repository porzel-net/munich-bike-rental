export type BookingRequestedItemCommand = {
  requestedLabel: string;
  heightCm: number;
  needsPedals?: boolean;
  pedalType?: string | null;
  needsComputerMount?: boolean;
  computerMountType?: string | null;
  needsHelmet?: boolean;
  needsClothing?: boolean;
  needsBikepackingBag?: boolean;
  needsGlasses?: boolean;
  bottleHolderIncluded?: boolean;
  repairKitIncluded?: boolean;
  insuranceProtectionSelected?: boolean;
};
