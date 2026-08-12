export const bookingImportLocations = ["munich", "regensburg", "lindau", "friedrichshafen", "konstanz"] as const;

export type BookingImportLocation = (typeof bookingImportLocations)[number];
export type BookingImportLocale = "de" | "en";

export type RequestedBikeImport = {
  requestedLabel: string;
  heightCm: number;
  needsPedals: boolean;
  pedalType: string | null;
  needsComputerMount: boolean;
  computerMountType: string | null;
  needsHelmet: boolean;
  needsClothing: boolean;
  needsBikepackingBag: boolean;
  needsGlasses: boolean;
  bottleHolderIncluded: true;
  repairKitIncluded: true;
};

export type BookingRequestImport = {
  name: string;
  email: string;
  phone: string;
  location: BookingImportLocation;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  message: string;
  locale: BookingImportLocale;
  requestedItems: RequestedBikeImport[];
  missingFields: string[];
  inferredFields: string[];
  _source: {
    emailId: string;
    subject: string | null;
    sentAt: string | null;
    from: string | null;
    recipients: string;
    inReplyTo: string | null;
    referencesHeader: string | null;
    threadMessageId: string;
    bodyText: string;
  };
};

export type BookingImportMail = {
  id: string;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  replyToEmail: string | null;
  sentAt: Date | null;
  bodyText: string | null;
  bodyHtml: string | null;
  folderName: string;
  recipients?: string;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  threadMessageId?: string;
};
