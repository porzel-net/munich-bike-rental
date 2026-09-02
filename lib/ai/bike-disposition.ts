import {
  BIKE_SIZE_TOLERANCE_CM,
  getCompatibleBikeSizes,
  getRecommendedBikeSize,
  hasBikeSizeTable,
} from "@/lib/bikes/size-fit";

export const dispositionBikeCategories = ["gravel", "road", "city", "unknown"] as const;
export type DispositionBikeCategory = (typeof dispositionBikeCategories)[number];

export type DispositionAsset = {
  id: number;
  displayName: string;
  nickname?: string | null;
  modelKey: string;
  modelTitle: string;
  category: DispositionBikeCategory;
  size: string;
  location: string;
  state: "active" | "maintenance" | "retired";
  weekdayPriceCents: number;
  weekendPriceCents: number;
};

export type DispositionRequestedItem = {
  id: number;
  requestedLabel: string;
  heightCm: number;
};

export type DispositionBooking = {
  id: number;
  orderNumber: string;
  customerName: string;
  status: string;
  location: string;
  periodFrom: string;
  periodTo: string;
  pickupTime: string;
  dropoffTime: string;
  quotedTotalCents: number;
  requestedItems: DispositionRequestedItem[];
  allocations: Array<{ assetId: number; requestedItemId?: number | null }>;
};

export type BikeDispositionInput = {
  targetBookingId: number;
  assets: DispositionAsset[];
  bookings: DispositionBooking[];
};

export type DispositionSuggestionKind =
  | "exact_alternative"
  | "size_alternative"
  | "model_alternative"
  | "category_alternative"
  | "date_alternative"
  | "reallocation"
  | "priority_review"
  | "no_safe_option";

export type BikeDispositionSuggestion = {
  id: string;
  kind: DispositionSuggestionKind;
  priority: "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
  title: string;
  summary: string;
  requestedItemId: number;
  requestedLabel: string;
  targetAssetId?: number;
  targetAssetName?: string;
  affectedBookingId?: number;
  affectedBookingRef?: string;
  affectedCustomerName?: string;
  replacementAssetId?: number;
  replacementAssetName?: string;
  alternativePeriodFrom?: string;
  alternativePeriodTo?: string;
  fitNote: string;
  tradeoffs: string[];
  requiresManualConfirmation: true;
  changesData: false;
};

export type BikeDispositionPlan = {
  targetBookingId: number;
  targetBookingRef: string;
  targetCustomerName: string;
  targetStatus: string;
  generatedAt: string;
  suggestions: BikeDispositionSuggestion[];
  safetyNotes: string[];
};

const sizeOrder = new Map(["3XS", "2XS", "XS", "S", "M", "L", "XL", "2XL", "XXL"].map((size, index) => [size, index]));

const blockingStatuses = new Set(["offer_sent", "confirmed", "checked_out"]);

const safetyNotes = [
  "Read-only: Diese Analyse liest Bestand und Kalender, schreibt aber keine Buchung, Belegung oder Nachricht.",
  "Eine bestätigte Buchung wird niemals automatisch abgesagt oder herabgestuft.",
  "Jeder Vorschlag muss vor einer Kundenkommunikation und vor einer Datenänderung manuell geprüft werden.",
];

function normalize(value: string) {
  return value.toLocaleLowerCase("de-DE").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

export function inferBikeCategory(modelKeyOrTitle: string): DispositionBikeCategory {
  const value = normalize(modelKeyOrTitle);
  if (/(?:grail|gravel|cross|cyclocross)/.test(value)) return "gravel";
  if (/(?:endurace|aeroad|ultimate|rennrad|road)/.test(value)) return "road";
  if (/(?:city|urban|trekking|touring)/.test(value)) return "city";
  return "unknown";
}

function parseRequestedModel(label: string) {
  const match = label.trim().match(/^(.*?)(?:\s+-\s+(3XS|2XS|XS|S|M|L|XL|2XL|XXL))?$/i);
  return {
    model: (match?.[1] ?? label).trim(),
    requestedSize: match?.[2]?.toUpperCase() ?? null,
  };
}

function sameModel(requestedModel: string, asset: DispositionAsset) {
  const requested = normalize(requestedModel);
  return requested === normalize(asset.modelTitle) || requested === normalize(asset.modelKey);
}

function sizeDistance(left: string | null, right: string) {
  if (!left) return 0;
  const leftIndex = sizeOrder.get(left.toUpperCase());
  const rightIndex = sizeOrder.get(right.toUpperCase());
  return leftIndex === undefined || rightIndex === undefined ? 0 : Math.abs(leftIndex - rightIndex);
}

function intervalOverlaps(
  left: Pick<DispositionBooking, "periodFrom" | "periodTo" | "pickupTime" | "dropoffTime">,
  right: Pick<DispositionBooking, "periodFrom" | "periodTo" | "pickupTime" | "dropoffTime">,
) {
  const leftFrom = `${left.periodFrom}T${left.pickupTime}`;
  const leftTo = `${left.periodTo}T${left.dropoffTime}`;
  const rightFrom = `${right.periodFrom}T${right.pickupTime}`;
  const rightTo = `${right.periodTo}T${right.dropoffTime}`;
  return leftFrom < rightTo && rightFrom < leftTo;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftBookingPeriod(booking: DispositionBooking, days: number): DispositionBooking {
  return {
    ...booking,
    periodFrom: shiftDate(booking.periodFrom, days),
    periodTo: shiftDate(booking.periodTo, days),
  };
}

function itemForAllocation(booking: DispositionBooking, allocation: DispositionBooking["allocations"][number]) {
  return (
    booking.requestedItems.find((item) => item.id === allocation.requestedItemId) ??
    booking.requestedItems[booking.allocations.indexOf(allocation)] ??
    booking.requestedItems[0]
  );
}

function fitForAsset(item: DispositionRequestedItem, asset: DispositionAsset) {
  if (!hasBikeSizeTable(asset.modelTitle)) {
    return {
      fits: true,
      note: "Größentabelle für dieses Modell fehlt; Körpergröße manuell prüfen.",
      confidence: "low" as const,
    };
  }
  const compatibleSizes = getCompatibleBikeSizes(asset.modelTitle, item.heightCm, BIKE_SIZE_TOLERANCE_CM);
  const recommended = getRecommendedBikeSize(asset.modelTitle, item.heightCm);
  if (!recommended && !compatibleSizes.length) {
    return {
      fits: false,
      note: `Für ${item.heightCm} cm ist keine Größe dieses Modells hinterlegt.`,
      confidence: "low" as const,
    };
  }
  return compatibleSizes.includes(asset.size)
    ? {
        fits: true,
        note:
          compatibleSizes.length > 1
            ? `${compatibleSizes.join(" oder ")} passen zur Größenprüfung für ${item.heightCm} cm (Toleranz ±${BIKE_SIZE_TOLERANCE_CM} cm).`
            : `${asset.size} passt zur Größenprüfung für ${item.heightCm} cm (Toleranz ±${BIKE_SIZE_TOLERANCE_CM} cm).`,
        confidence: "high" as const,
      }
    : {
        fits: false,
        note: `Für ${item.heightCm} cm wird bei diesem Modell ${recommended} empfohlen.`,
        confidence: "high" as const,
      };
}

function classifyCandidate(
  requestedModel: string,
  requestedSize: string | null,
  heightCm: number,
  requestedCategory: DispositionBikeCategory,
  asset: DispositionAsset,
) {
  const exactModel = sameModel(requestedModel, asset);
  const exactSize = requestedSize ? asset.size.toUpperCase() === requestedSize : false;
  const compatibleSizes = getCompatibleBikeSizes(asset.modelTitle, heightCm, BIKE_SIZE_TOLERANCE_CM);
  if (
    exactModel &&
    (exactSize || (!requestedSize && (compatibleSizes.includes(asset.size) || !hasBikeSizeTable(asset.modelTitle))))
  ) {
    return { kind: "exact_alternative" as const, rank: 0 };
  }
  if (exactModel) return { kind: "size_alternative" as const, rank: 10 + sizeDistance(requestedSize, asset.size) };
  if (requestedCategory !== "unknown" && asset.category === requestedCategory) {
    return { kind: "model_alternative" as const, rank: 25 };
  }
  if (requestedCategory !== "unknown" && asset.category !== "unknown") {
    return { kind: "category_alternative" as const, rank: 60 };
  }
  return { kind: "model_alternative" as const, rank: 35 };
}

type Candidate = {
  asset: DispositionAsset;
  kind: Exclude<DispositionSuggestionKind, "reallocation" | "priority_review" | "no_safe_option">;
  rank: number;
  fitNote: string;
  confidence: "high" | "medium" | "low";
};

function candidatesForItem(
  item: DispositionRequestedItem,
  assets: DispositionAsset[],
  requestedBooking: DispositionBooking,
  bookings: DispositionBooking[],
  ignoredBookingIds: ReadonlySet<number> = new Set(),
  ignoredAssetIds: ReadonlySet<number> = new Set(),
): Candidate[] {
  const { model, requestedSize } = parseRequestedModel(item.requestedLabel);
  const requestedCategory = inferBikeCategory(model);
  return assets
    .filter(
      (asset) =>
        asset.state === "active" && asset.location === requestedBooking.location && !ignoredAssetIds.has(asset.id),
    )
    .map((asset) => {
      const fit = fitForAsset(item, asset);
      const classification = classifyCandidate(model, requestedSize, item.heightCm, requestedCategory, asset);
      const occupied = bookings.some(
        (booking) =>
          !ignoredBookingIds.has(booking.id) &&
          booking.id !== requestedBooking.id &&
          booking.location === requestedBooking.location &&
          blockingStatuses.has(booking.status) &&
          intervalOverlaps(requestedBooking, booking) &&
          booking.allocations.some((allocation) => allocation.assetId === asset.id),
      );
      return { asset, ...classification, fitNote: fit.note, confidence: fit.confidence, occupied, fits: fit.fits };
    })
    .filter((candidate) => candidate.fits && !candidate.occupied)
    .sort((left, right) => left.rank - right.rank || left.asset.id - right.asset.id);
}

function makeSuggestion(
  item: DispositionRequestedItem,
  candidate: Candidate,
  sequence: number,
): BikeDispositionSuggestion {
  const targetName = candidate.asset.nickname
    ? `${candidate.asset.displayName} (${candidate.asset.nickname})`
    : candidate.asset.displayName;
  const isCrossCategory = candidate.kind === "category_alternative";
  return {
    id: `suggestion-${sequence}`,
    kind: candidate.kind,
    priority: candidate.rank <= 10 ? "high" : candidate.rank <= 35 ? "medium" : "low",
    confidence: isCrossCategory ? "medium" : candidate.confidence,
    title:
      candidate.kind === "exact_alternative"
        ? "Exaktes Fahrrad verfügbar"
        : candidate.kind === "size_alternative"
          ? "Andere Rahmengröße anbieten"
          : candidate.kind === "model_alternative"
            ? "Anderes Modell derselben Kategorie anbieten"
            : candidate.kind === "category_alternative"
              ? "Andere Fahrradkategorie vorsichtig prüfen"
              : "Alternative prüfen",
    summary: isCrossCategory
      ? `${targetName} ist verfügbar, aber eine andere Kategorie (${candidate.asset.category}) als die Anfrage (${inferBikeCategory(parseRequestedModel(item.requestedLabel).model)}). Vorher Einsatzprofil mit dem Kunden klären.`
      : `${targetName} ist im angefragten Zeitraum verfügbar und passt zur Größenprüfung.`,
    requestedItemId: item.id,
    requestedLabel: item.requestedLabel,
    targetAssetId: candidate.asset.id,
    targetAssetName: targetName,
    fitNote: candidate.fitNote,
    tradeoffs: [
      ...(candidate.kind === "size_alternative"
        ? ["Körpergröße und Sitzposition vor Zusage nochmals bestätigen."]
        : []),
      ...(candidate.kind === "model_alternative"
        ? ["Ausstattung und Fahrprofil können vom Wunschmodell abweichen."]
        : []),
      ...(isCrossCategory ? ["Gravel und Rennrad sind nicht für jedes Einsatzprofil gleichwertig."] : []),
    ],
    requiresManualConfirmation: true,
    changesData: false,
  };
}

function bestCandidateSet(candidates: Candidate[]) {
  const bestKind = candidates[0]?.kind;
  if (!bestKind) return [];
  // Keep one physical representative per visible model/size combination.
  // Several inventory units can otherwise render as duplicate cards. When
  // an exact size exists, include compatible adjacent sizes too, so boundary
  // heights such as 178 cm can receive both S and M as choices.
  const allowedKinds =
    bestKind === "exact_alternative" ? new Set(["exact_alternative", "size_alternative"]) : new Set([bestKind]);
  const uniqueRecommendations: Candidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!allowedKinds.has(candidate.kind)) continue;
    const key = `${normalize(candidate.asset.modelTitle)}::${candidate.asset.size.toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRecommendations.push(candidate);
  }
  const limit =
    bestKind === "exact_alternative" || bestKind === "size_alternative" || bestKind === "model_alternative" ? 3 : 1;
  return uniqueRecommendations.slice(0, limit);
}

function collapseFallbackSuggestions(suggestions: BikeDispositionSuggestion[]) {
  const fallbackSuggestions = suggestions.filter(
    (suggestion) => suggestion.kind === "no_safe_option" || suggestion.kind === "priority_review",
  );
  if (fallbackSuggestions.length < 2) return suggestions;

  const concreteSuggestions = suggestions.filter(
    (suggestion) => suggestion.kind !== "no_safe_option" && suggestion.kind !== "priority_review",
  );
  const prioritized = fallbackSuggestions.find((suggestion) => suggestion.kind === "priority_review");
  const first = prioritized ?? fallbackSuggestions[0];
  const labelCounts = new Map<string, number>();
  for (const suggestion of fallbackSuggestions) {
    labelCounts.set(suggestion.requestedLabel, (labelCounts.get(suggestion.requestedLabel) ?? 0) + 1);
  }
  const labels = [...labelCounts.entries()].map(([label, count]) => (count > 1 ? `${count}× ${label}` : label));
  const requestedItemCount = fallbackSuggestions.length;
  const affectedBookingIds = [...new Set(fallbackSuggestions.map((suggestion) => suggestion.affectedBookingId))];
  const sameAffectedBooking = affectedBookingIds.length === 1 && affectedBookingIds[0] !== undefined;
  const isPriorityReview = Boolean(prioritized);

  return [
    ...concreteSuggestions,
    {
      ...first,
      id: `suggestion-${isPriorityReview ? "priority-review" : "no-safe-option"}-booking`,
      title: isPriorityReview
        ? "Manuelle Priorisierungsprüfung für die Buchung erforderlich"
        : "Keine sichere Alternative für die Buchung gefunden",
      summary: isPriorityReview
        ? `Für ${requestedItemCount} angefragte Fahrräder wurde keine sichere Umbelegung gefunden. Die wirtschaftliche Priorisierung bleibt eine manuelle Prüfung; eine Absage wird nicht empfohlen.`
        : `Für ${requestedItemCount} angefragte Fahrräder ist im Zeitraum keine passende, aktive oder regelkonform umbelegbare Kombination verfügbar.`,
      requestedLabel: labels.join(" · "),
      affectedBookingId: sameAffectedBooking ? affectedBookingIds[0] : undefined,
      affectedBookingRef: sameAffectedBooking ? first.affectedBookingRef : undefined,
      affectedCustomerName: sameAffectedBooking ? first.affectedCustomerName : undefined,
      fitNote: `Keine sichere Größen- und Verfügbarkeitskombination für: ${labels.join(" · ")}.`,
      tradeoffs: [...new Set(fallbackSuggestions.flatMap((suggestion) => suggestion.tradeoffs))],
    },
  ];
}

export function evaluateBikeDisposition(input: BikeDispositionInput, now = new Date()): BikeDispositionPlan {
  const target = input.bookings.find((booking) => booking.id === input.targetBookingId);
  if (!target) throw new Error("Zielbuchung für die Dispositionsanalyse fehlt.");

  const basePlan = {
    targetBookingId: target.id,
    targetBookingRef: target.orderNumber,
    targetCustomerName: target.customerName,
    targetStatus: target.status,
    generatedAt: now.toISOString(),
    safetyNotes,
  };
  const suggestions: BikeDispositionSuggestion[] = [];
  let sequence = 1;
  const usedTargetAssetIds = new Set<number>();
  for (const item of target.requestedItems) {
    const available = candidatesForItem(
      item,
      input.assets,
      target,
      input.bookings,
      new Set([target.id]),
      usedTargetAssetIds,
    );
    for (const candidate of bestCandidateSet(available)) suggestions.push(makeSuggestion(item, candidate, sequence++));
    if (available[0]) usedTargetAssetIds.add(available[0].asset.id);

    const hasStrongDirectAlternative = available.some(
      (candidate) => candidate.kind === "exact_alternative" || candidate.kind === "model_alternative",
    );
    const occupiedRequestedAssets = hasStrongDirectAlternative
      ? []
      : input.bookings
          .filter(
            (booking) =>
              booking.id !== target.id &&
              booking.location === target.location &&
              blockingStatuses.has(booking.status) &&
              intervalOverlaps(target, booking),
          )
          .flatMap((booking) =>
            booking.allocations
              .filter((allocation) => {
                if (available.some((candidate) => candidate.asset.id === allocation.assetId)) return false;
                const allocatedAsset = input.assets.find((asset) => asset.id === allocation.assetId);
                if (!allocatedAsset) return false;
                const { model, requestedSize } = parseRequestedModel(item.requestedLabel);
                const fit = fitForAsset(item, allocatedAsset);
                const match = classifyCandidate(
                  model,
                  requestedSize,
                  item.heightCm,
                  inferBikeCategory(model),
                  allocatedAsset,
                );
                return allocatedAsset.state === "active" && fit.fits && match.kind !== "category_alternative";
              })
              .map((allocation) => ({ booking, allocation })),
          );

    for (const { booking: affectedBooking, allocation } of occupiedRequestedAssets) {
      const affectedItem = itemForAllocation(affectedBooking, allocation);
      if (!affectedItem) continue;
      const replacement = candidatesForItem(
        affectedItem,
        input.assets,
        affectedBooking,
        input.bookings,
        new Set([affectedBooking.id, target.id]),
        new Set([allocation.assetId]),
      )[0];
      if (!replacement) continue;
      const requestedCandidate = input.assets.find((asset) => asset.id === allocation.assetId);
      if (!requestedCandidate) continue;
      suggestions.push({
        id: `suggestion-${sequence++}`,
        kind: "reallocation",
        priority: "medium",
        confidence: replacement.confidence,
        title: "Bestehende Buchung auf Ersatzfahrrad umplanen",
        summary: `${affectedBooking.orderNumber} könnte nach manueller Prüfung auf ${replacement.asset.displayName} wechseln. Dadurch würde ${requestedCandidate.displayName} für die neue Anfrage frei.`,
        requestedItemId: item.id,
        requestedLabel: item.requestedLabel,
        targetAssetId: requestedCandidate.id,
        targetAssetName: requestedCandidate.displayName,
        affectedBookingId: affectedBooking.id,
        affectedBookingRef: affectedBooking.orderNumber,
        affectedCustomerName: affectedBooking.customerName,
        replacementAssetId: replacement.asset.id,
        replacementAssetName: replacement.asset.displayName,
        fitNote: `Ersatz für ${affectedBooking.customerName}: ${replacement.fitNote}`,
        tradeoffs: [
          "Bestehenden Kunden aktiv kontaktieren und Zustimmung einholen.",
          "Angebot, Preis und Zubehör der bestehenden Buchung manuell gegenprüfen.",
        ],
        requiresManualConfirmation: true,
        changesData: false,
      });
    }

    if (!available.length) {
      const dateAlternatives: Array<{ days: number; candidate: Candidate; period: DispositionBooking }> = [];
      for (const days of [1, -1, 2, -2, 3, -3, 7, -7]) {
        const shiftedTarget = shiftBookingPeriod(target, days);
        const shiftedCandidates = candidatesForItem(
          item,
          input.assets,
          shiftedTarget,
          input.bookings,
          new Set([target.id]),
          new Set(usedTargetAssetIds),
        );
        const candidate = shiftedCandidates[0];
        if (candidate) dateAlternatives.push({ days, candidate, period: shiftedTarget });
      }
      const uniqueDateAlternatives = dateAlternatives.filter(
        ({ candidate }, index, all) =>
          all.findIndex((entry) => entry.candidate.asset.id === candidate.asset.id) === index,
      );
      for (const { candidate, period } of uniqueDateAlternatives.slice(0, 2)) {
        suggestions.push({
          id: `suggestion-${sequence++}`,
          kind: "date_alternative",
          priority: "medium",
          confidence: candidate.confidence,
          title: "Anderen Zeitraum anbieten",
          summary:
            candidate.kind === "category_alternative"
              ? `${candidate.asset.displayName} (${candidate.asset.category}) wäre vom ${period.periodFrom} bis ${period.periodTo} verfügbar; das ist eine andere Kategorie als angefragt.`
              : `${candidate.asset.displayName} wäre vom ${period.periodFrom} bis ${period.periodTo} verfügbar.`,
          requestedItemId: item.id,
          requestedLabel: item.requestedLabel,
          targetAssetId: candidate.asset.id,
          targetAssetName: candidate.asset.displayName,
          alternativePeriodFrom: period.periodFrom,
          alternativePeriodTo: period.periodTo,
          fitNote: candidate.fitNote,
          tradeoffs: [
            "Kunden fragen, ob der vorgeschlagene Zeitraum möglich ist; Preise und Abholung neu berechnen.",
            ...(candidate.kind === "category_alternative"
              ? ["Gravel und Rennrad sind nicht für jedes Einsatzprofil gleichwertig."]
              : []),
          ],
          requiresManualConfirmation: true,
          changesData: false,
        });
      }
    }

    const relevantConflictBookingIds = new Set(occupiedRequestedAssets.map(({ booking }) => booking.id));
    const conflicts = input.bookings.filter(
      (booking) =>
        booking.id !== target.id &&
        relevantConflictBookingIds.has(booking.id) &&
        booking.location === target.location &&
        blockingStatuses.has(booking.status) &&
        intervalOverlaps(target, booking) &&
        booking.allocations.some((allocation) => input.assets.some((asset) => asset.id === allocation.assetId)),
    );
    const economicallyLargerConflict = conflicts.find((booking) => booking.quotedTotalCents > target.quotedTotalCents);
    const hasReallocationSuggestion = suggestions.some(
      (suggestion) => suggestion.requestedItemId === item.id && suggestion.kind === "reallocation",
    );
    if (economicallyLargerConflict && !hasReallocationSuggestion) {
      suggestions.push({
        id: `suggestion-${sequence++}`,
        kind: "priority_review",
        priority: "low",
        confidence: "high",
        title: "Manuelle Priorisierungsprüfung erforderlich",
        summary: `Keine sichere Umbelegung gefunden. Die bestehende Buchung ${economicallyLargerConflict.orderNumber} ist wirtschaftlich höher bewertet; der Agent empfiehlt ausdrücklich keine Absage.`,
        requestedItemId: item.id,
        requestedLabel: item.requestedLabel,
        affectedBookingId: economicallyLargerConflict.id,
        affectedBookingRef: economicallyLargerConflict.orderNumber,
        affectedCustomerName: economicallyLargerConflict.customerName,
        fitNote: "Wirtschaftlicher Hinweis, keine automatische Entscheidung.",
        tradeoffs: [
          "Keine Absage, Statusänderung oder Preisentscheidung durch den Agenten.",
          "Kunden und wirtschaftliche Folgen manuell prüfen; Zeitraumwechsel bleibt eine Alternative.",
        ],
        requiresManualConfirmation: true,
        changesData: false,
      });
    }

    if (!suggestions.some((suggestion) => suggestion.requestedItemId === item.id)) {
      suggestions.push({
        id: `suggestion-${sequence++}`,
        kind: "no_safe_option",
        priority: "low",
        confidence: "high",
        title: economicallyLargerConflict
          ? "Manuelle Priorisierungsprüfung erforderlich"
          : "Keine sichere Alternative gefunden",
        summary: "Im Zeitraum ist kein passendes, aktives Fahrrad oder regelkonformer Umbelegungsplan verfügbar.",
        requestedItemId: item.id,
        requestedLabel: item.requestedLabel,
        affectedBookingId: conflicts[0]?.id,
        affectedBookingRef: conflicts[0]?.orderNumber,
        affectedCustomerName: conflicts[0]?.customerName,
        fitNote: "Keine sichere Größen- und Verfügbarkeitskombination.",
        tradeoffs: [
          "Keine Absage, Statusänderung oder Preisentscheidung durch den Agenten.",
          "Kunden und wirtschaftliche Folgen manuell prüfen; Zeitraumwechsel bleibt eine Alternative.",
        ],
        requiresManualConfirmation: true,
        changesData: false,
      });
    }
  }

  const uniqueSuggestions = suggestions.filter(
    (suggestion, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.kind === suggestion.kind &&
          candidate.requestedItemId === suggestion.requestedItemId &&
          candidate.targetAssetId === suggestion.targetAssetId &&
          candidate.affectedBookingId === suggestion.affectedBookingId,
      ) === index,
  );
  return {
    ...basePlan,
    suggestions: collapseFallbackSuggestions(uniqueSuggestions),
  };
}
