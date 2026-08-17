import * as React from "react";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { BookingAiAnalysisButton } from "@/components/booking-ai-analysis-button";
import { BookingAssigneeBadge } from "@/components/booking-assignee-badge";
import { BookingAssigneeCard } from "@/components/booking-assignee-card";
import { BookingCommandActions } from "@/components/booking-command-actions";
import { BookingEditDialog } from "@/components/booking-edit-dialog";
import { BookingMailThreadSync } from "@/components/booking-mail-thread-sync";
import { RepeatBookingDialog } from "@/components/repeat-booking-dialog";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemGroup, ItemHeader, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAssignedLocation, getServerSession, isAdmin } from "@/lib/auth/session";
import { hasAssetConflict } from "@/lib/bookings/availability";
import { getAssignableBookingUsers } from "@/lib/bookings/assignees";
import { getBookingPaymentStatus } from "@/lib/bookings/service";
import { formatEuro } from "@/lib/bookings/money";
import { bookingPresentation, paymentPresentation } from "@/lib/bookings/presentation";
import { getDatabase } from "@/lib/db/client";
import { getLatestEmailActionReview, isEmailActionEligible, reviewQuestions } from "@/lib/inquiries/email-action";
import { getLocationInventory } from "@/lib/inventory/repository";
import { bikeMatchesRequestedLabel } from "@/lib/inventory/display-name";
import {
  isAssetSelectableForBooking,
  isHistoricalRegensburgEnduraceSAsset,
} from "@/lib/bookings/historical-availability";
import { getDailyBikePriceCents } from "@/lib/inventory/pricing";
import { formatReceivedAt } from "@/lib/bookings/order-number";
import { allocateInvoiceNumber } from "@/lib/bookings/invoice-number";
import {
  getComputerMountTypeLabel,
  getPedalTypeLabel,
  rentalLocationLabels,
  type RentalLocation,
} from "@/lib/inquiries/catalog";
import {
  bikeModels,
  bikeVariants,
  bookingFeedback,
  bookingOfferItems,
  bookingOffers,
  bookingRequestedItems,
  bookings,
  financialAccounts,
  authUser,
  journalEntries,
  rentalAssets,
} from "@/lib/db/schema";
import type { BookingAssigneeUser } from "@/lib/bookings/assignees";

const nextActionCopy: Record<string, { title: string; description: string }> = {
  inquiry_received: {
    title: "Angebot erstellen",
    description: "Prüfe die Anfrage und stelle ein passendes Fahrradangebot zusammen.",
  },
  offer_sent: {
    title: "Angebot prüfen oder überarbeiten",
    description: "Das Angebot wurde versendet. Du kannst es anpassen oder die Buchung stornieren.",
  },
  expired: {
    title: "Angebot neu erstellen",
    description: "Das bisherige Angebot ist abgelaufen und kann neu versendet werden.",
  },
  confirmed: {
    title: "Fahrradausgabe vorbereiten",
    description: "Bei der Übergabe kannst du die Ausgabe direkt dokumentieren.",
  },
  checked_out: {
    title: "Buchung abschließen",
    description: "Nach der Rückgabe wird die Buchung endgültig abgeschlossen.",
  },
  completed: {
    title: "Vorgang abgeschlossen",
    description: "Für diese Buchung ist keine weitere Statusaktion erforderlich.",
  },
  rejected: {
    title: "Anfrage abgeschlossen",
    description: "Diese Anfrage wurde abgelehnt und kann nicht weiter bearbeitet werden.",
  },
  cancelled: {
    title: "Buchung abgeschlossen",
    description: "Diese Buchung wurde storniert und kann nicht weiter bearbeitet werden.",
  },
};

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const id = Number((await params).id);
  const db = getDatabase();
  const booking = Number.isInteger(id) ? db.select().from(bookings).where(eq(bookings.id, id)).get() : undefined;
  if (!session || !booking || (!isAdmin(session.user) && getAssignedLocation(session.user) !== booking.location))
    notFound();
  const assignee = booking.assignedUserId
    ? ((db
        .select({
          id: authUser.id,
          name: authUser.name,
          email: authUser.email,
          role: authUser.role,
          locationKey: authUser.locationKey,
        })
        .from(authUser)
        .where(eq(authUser.id, booking.assignedUserId))
        .get() as BookingAssigneeUser | undefined) ?? null)
    : null;
  const hasAssignedCaseworker = Boolean(assignee);
  const eligibleAssignees = isAdmin(session.user)
    ? getAssignableBookingUsers(db, booking.location as RentalLocation)
    : [];
  const canSelfAssign = !isAdmin(session.user) && assignee === null;

  const items = db.select().from(bookingRequestedItems).where(eq(bookingRequestedItems.bookingId, id)).all();
  const offers = db
    .select()
    .from(bookingOffers)
    .where(eq(bookingOffers.bookingId, id))
    .orderBy(desc(bookingOffers.offerNumber))
    .all();
  const feedback = db.select().from(bookingFeedback).where(eq(bookingFeedback.bookingId, id)).get() ?? null;
  const entries = db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.bookingId, id))
    .orderBy(desc(journalEntries.occurredAt))
    .all();
  const paymentAccounts = db
    .select({
      id: financialAccounts.id,
      name: financialAccounts.name,
      iban: financialAccounts.iban,
      type: financialAccounts.type,
    })
    .from(financialAccounts)
    .where(eq(financialAccounts.status, "active"))
    .orderBy(financialAccounts.name)
    .all();
  const latestEmailActionReview = getLatestEmailActionReview(db, booking.id);
  const emailActionQuestions = reviewQuestions(latestEmailActionReview);
  const emailActionEligible = isEmailActionEligible(booking.createdAt, []);
  const hasPendingEmailAction =
    latestEmailActionReview?.status === "needs_action" ||
    latestEmailActionReview?.status === "error" ||
    (!latestEmailActionReview && booking.status === "inquiry_received" && emailActionEligible);
  const emailActionStatusLabel = !latestEmailActionReview
    ? booking.status === "inquiry_received" && emailActionEligible
      ? "Antwort erforderlich"
      : emailActionEligible
        ? "Noch nicht geprüft"
        : "Außerhalb des Prüfzeitraums"
    : latestEmailActionReview.status === "error"
      ? "Manuelle Prüfung nötig"
      : hasPendingEmailAction
        ? "Antwort erforderlich"
        : "Alle Fragen beantwortet";
  const emailActionBadgeVariant: "outline" | "destructive" | "success" = !latestEmailActionReview
    ? "outline"
    : hasPendingEmailAction
      ? "destructive"
      : "success";
  const payment = getBookingPaymentStatus(db, booking.id);
  const paymentView = paymentPresentation(payment.status, payment.openCents);
  const statusView = bookingPresentation[booking.status];
  const commercialEditingAllowed = booking.status === "inquiry_received" || booking.status === "offer_sent";
  const importedPriceEditingAllowed =
    booking.source === "legacy" && ["confirmed", "completed"].includes(booking.status);
  const locationLabel =
    rentalLocationLabels.de[booking.location as keyof typeof rentalLocationLabels.de] ?? booking.location;
  const availableAssets = db
    .select({
      id: rentalAssets.id,
      location: rentalAssets.location,
      label: rentalAssets.displayName,
      nickname: rentalAssets.nickname,
      modelTitle: bikeModels.title,
      size: bikeVariants.size,
      priceCents: rentalAssets.dailyPriceCents,
      state: rentalAssets.state,
    })
    .from(rentalAssets)
    .innerJoin(bikeVariants, eq(rentalAssets.variantId, bikeVariants.id))
    .innerJoin(bikeModels, eq(bikeVariants.modelId, bikeModels.id))
    .where(eq(rentalAssets.location, booking.location))
    .all()
    .filter((asset) => {
      const candidate = { ...asset, modelTitle: asset.modelTitle, size: asset.size };
      // The status dialog can change the period after the asset list is loaded.
      // Keep this historical asset visible so the entered 26.07.–10.08. period can be saved.
      return (
        isAssetSelectableForBooking(booking, candidate) ||
        (booking.source === "legacy" && isHistoricalRegensburgEnduraceSAsset(candidate))
      );
    })
    .map((asset) => ({ ...asset, modelLabel: `${asset.modelTitle} - ${asset.size}` }));
  const unavailableAssetIds = availableAssets
    .filter((asset) => hasAssetConflict(db, booking, asset.id))
    .map((asset) => asset.id);
  const unavailableAssetIdSet = new Set(unavailableAssetIds);
  const requestedQuantities = new Map<string, number>();
  for (const item of items)
    requestedQuantities.set(item.requestedLabel, (requestedQuantities.get(item.requestedLabel) ?? 0) + 1);
  const likelyUnavailable =
    booking.status === "inquiry_received" &&
    [...requestedQuantities].some(([requestedLabel, quantity]) => {
      const matchingAssets = availableAssets.filter((asset) => bikeMatchesRequestedLabel(asset, requestedLabel));
      const availableQuantity = matchingAssets.filter((asset) => !unavailableAssetIdSet.has(asset.id)).length;
      return availableQuantity < quantity;
    });
  const locationInventory = getLocationInventory(db, booking.location);
  const latestOffer = offers[0];
  const hasActiveOffer = offers.some((offer) => offer.status === "sent");
  const acceptedOffer = offers.find((offer) => offer.status === "accepted");
  const canGenerateInvoice = payment.status === "settled" && Boolean(acceptedOffer && booking.invoiceNumber);
  const suggestedInvoiceNumber =
    booking.invoiceNumber ??
    (() => {
      try {
        return allocateInvoiceNumber(db);
      } catch {
        return null;
      }
    })();
  const nextAction =
    nextActionCopy[booking.status] ??
    ({ title: "Buchung prüfen", description: "Wähle die passende Aktion für diese Buchung." } as const);
  const bookingInfoColumns: Array<Array<{ label: string; value: React.ReactNode }>> = [
    [
      { label: "Buchungsnummer", value: <Kbd>{booking.orderNumber}</Kbd> },
      { label: "Eingang", value: formatReceivedAt(booking.orderNumber) ?? booking.createdAt.toLocaleString("de-DE") },
      { label: "Kunde", value: booking.customerName },
      { label: "E-Mail", value: booking.customerEmail },
      { label: "Telefonnummer", value: booking.customerPhone },
      { label: "Anzahl Fahrräder", value: String(items.length) },
      { label: "Buchungswert", value: formatEuro(latestOffer?.totalCents ?? booking.quotedTotalCents) },
      ...(booking.invoiceNumber ? [{ label: "Rechnungsnummer", value: <Kbd>{booking.invoiceNumber}</Kbd> }] : []),
    ],
    [
      { label: "Zeitraum", value: `${booking.periodFrom} – ${booking.periodTo}` },
      { label: "Abholung", value: booking.pickupTime },
      { label: "Rückgabe", value: booking.dropoffTime },
      { label: "Standort", value: `${locationLabel} · ${booking.communicationLocale.toUpperCase()}` },
      { label: "Status", value: <Badge variant={statusView.badge}>{statusView.label}</Badge> },
      { label: "Zahlungsstatus", value: <Badge variant={paymentView.badge}>{paymentView.label}</Badge> },
    ],
  ];
  const offered = latestOffer
    ? db
        .select({ item: bookingOfferItems, asset: rentalAssets })
        .from(bookingOfferItems)
        .innerJoin(rentalAssets, eq(bookingOfferItems.assetId, rentalAssets.id))
        .where(eq(bookingOfferItems.offerId, latestOffer.id))
        .all()
    : [];

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={session.user} isAdmin={isAdmin(session.user)} variant="inset" />
      <SidebarInset className="min-w-0 overflow-hidden">
        <SiteHeader title="Buchung bearbeiten" />
        <main className="min-w-0 max-w-full overflow-x-hidden flex flex-1 flex-col gap-6 p-8 lg:p-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/admin/bookings" />}>
                ← Buchungsübersicht
              </Button>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  {hasPendingEmailAction ? (
                    <span
                      aria-label="Offene Kundenfrage"
                      className="size-3 rounded-full bg-red-500 ring-2 ring-red-100"
                    />
                  ) : null}
                  <h1 className="text-2xl font-semibold tracking-tight">{booking.orderNumber}</h1>
                </div>
                <Badge variant={statusView.badge}>{statusView.label}</Badge>
                <Badge variant={paymentView.badge}>{paymentView.label}</Badge>
                {likelyUnavailable && (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  >
                    Wahrscheinlich nicht annehmbar
                  </Badge>
                )}
                <BookingAssigneeBadge assigneeName={assignee?.name ?? null} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {locationLabel} · Kommunikation {booking.communicationLocale.toUpperCase()} · {booking.periodFrom}{" "}
                {booking.pickupTime} – {booking.periodTo} {booking.dropoffTime}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {hasAssignedCaseworker && booking.source !== "legacy" && (
                <BookingAiAnalysisButton bookingId={booking.id} />
              )}
              {hasAssignedCaseworker ? (
                <RepeatBookingDialog
                  assets={availableAssets}
                  pricingByLocation={{ [booking.location]: locationInventory }}
                  initialValues={{
                    name: booking.customerName,
                    email: booking.customerEmail,
                    phone: booking.customerPhone,
                    location: booking.location,
                    locale: booking.communicationLocale,
                    items: items.map((item) => ({
                      requestedLabel: item.requestedLabel,
                      heightCm: String(item.heightCm),
                      needsPedals: item.needsPedals,
                      pedalType: item.pedalType ?? "",
                      needsComputerMount: item.needsComputerMount,
                      computerMountType: item.computerMountType ?? "",
                      needsHelmet: item.needsHelmet,
                      needsClothing: item.needsClothing,
                    })),
                  }}
                />
              ) : null}
              {hasAssignedCaseworker && canGenerateInvoice ? (
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<a href={`/api/admin/bookings/${booking.id}/invoice`} target="_blank" rel="noreferrer" />}
                >
                  Rechnung als PDF
                </Button>
              ) : null}
              {hasAssignedCaseworker ? (
                <>
                  {!["completed", "rejected", "cancelled", "expired"].includes(booking.status) ||
                  importedPriceEditingAllowed ? (
                    <BookingEditDialog
                      bookingId={booking.id}
                      expectedVersion={booking.version}
                      customerName={booking.customerName}
                      customerEmail={booking.customerEmail}
                      customerPhone={booking.customerPhone}
                      periodFrom={booking.periodFrom}
                      periodTo={booking.periodTo}
                      pickupTime={booking.pickupTime}
                      dropoffTime={booking.dropoffTime}
                      customerMessage={booking.customerMessage}
                      communicationLocale={booking.communicationLocale}
                      requestedItems={items}
                      commercialEditingAllowed={commercialEditingAllowed}
                      priceEditingAllowed={importedPriceEditingAllowed}
                      quotedTotalCents={importedPriceEditingAllowed ? booking.quotedTotalCents : undefined}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <Card
            className={
              hasPendingEmailAction
                ? "border-red-200 bg-red-50/40 dark:border-red-950 dark:bg-red-950/20"
                : latestEmailActionReview?.status === "no_action"
                  ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-950 dark:bg-emerald-950/20"
                  : ""
            }
          >
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Antwortstatus</CardTitle>
                <Badge variant={emailActionBadgeVariant}>{emailActionStatusLabel}</Badge>
              </div>
            </CardHeader>
            {hasPendingEmailAction ? (
              <CardContent className="space-y-3 pt-0">
                <p className="text-sm leading-6">
                  {latestEmailActionReview?.summary ??
                    "Neue Buchungsanfrage: Bitte prüfe den Eingang und beantworte die Anfrage."}
                </p>
                {emailActionQuestions.length ? (
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Offene Punkte</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {emailActionQuestions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {latestEmailActionReview ? (
                  <p className="text-xs text-muted-foreground">
                    Quelle:{" "}
                    {latestEmailActionReview.source === "inquiry_rule"
                      ? "Eingangsregel"
                      : (latestEmailActionReview.model ?? "KI-Fallback")}
                    {latestEmailActionReview.createdAt
                      ? ` · geprüft am ${new Date(latestEmailActionReview.createdAt).toLocaleString("de-DE")}`
                      : ""}
                  </p>
                ) : null}
              </CardContent>
            ) : null}
          </Card>

          {feedback ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Kundenfeedback</CardTitle>
                    <CardDescription className="mt-1">Kurze Bewertung nach der Fahrradausgabe.</CardDescription>
                  </div>
                  <Badge variant={feedback?.submittedAt ? "success" : "outline"}>
                    {feedback?.submittedAt ? "Eingegangen" : feedback ? "Noch offen" : "Wird nach Ausgabe angelegt"}
                  </Badge>
                </div>
              </CardHeader>
              {feedback.submittedAt ? (
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {(
                      [
                        ["Fahrrad & Ausstattung", feedback.bikeRating],
                        ["Übergabe", feedback.handoverRating],
                        ["Kommunikation", feedback.communicationRating],
                        ["Preis-Leistung", feedback.priceRating],
                        ["Gesamterlebnis", feedback.overallRating],
                      ] as Array<[string, number | null]>
                    ).map(([label, rating]) => (
                      <div className="rounded-2xl border bg-muted/25 p-4" key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-2 text-lg font-semibold text-amber-600">
                          {"★".repeat(rating ?? 0)}
                          <span className="text-muted-foreground/30">{"★".repeat(5 - (rating ?? 0))}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{rating}/5 Sterne</p>
                      </div>
                    ))}
                  </div>
                  {feedback.comment ? (
                    <div className="rounded-2xl border bg-muted/25 p-4">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Kommentar</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{feedback.comment}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Kein zusätzlicher Kommentar.</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Eingegangen am{" "}
                    {feedback.submittedAt.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </CardContent>
              ) : (
                <CardContent className="text-sm text-muted-foreground">
                  Der Feedback-Link wurde versendet. Sobald die Rückmeldung eingeht, erscheint sie hier.
                </CardContent>
              )}
            </Card>
          ) : null}

          <Card>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-sm font-medium">Buchungsinformationen</div>
                </div>
                <div className="grid gap-x-8 sm:grid-cols-2">
                  {bookingInfoColumns.map((column, columnIndex) => (
                    <ItemGroup className="gap-2 text-muted-foreground" data-size="xs" key={columnIndex}>
                      {column.map(({ label, value }, index) => (
                        <React.Fragment key={label}>
                          {index > 0 && <ItemSeparator />}
                          <Item variant="default" size="xs" className="border-0 px-0 py-0">
                            <ItemHeader>
                              <ItemTitle className="font-normal">{label}</ItemTitle>
                              <ItemActions className="min-w-0 max-w-[70%] justify-end text-right">
                                <span className="break-words">{value}</span>
                              </ItemActions>
                            </ItemHeader>
                          </Item>
                        </React.Fragment>
                      ))}
                    </ItemGroup>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => {
                    const match = offered.find(({ item: offeredItem }) => offeredItem.requestedItemId === item.id);
                    const requestedDailyPriceCents = getDailyBikePriceCents(locationInventory, item.requestedLabel);
                    const accessories = [
                      item.needsPedals ? (item.pedalType ? getPedalTypeLabel(item.pedalType, "de") : "Pedale") : null,
                      item.needsComputerMount
                        ? item.computerMountType
                          ? getComputerMountTypeLabel(item.computerMountType, "de")
                          : "Computerhalterung"
                        : null,
                      item.needsHelmet ? "Helm" : null,
                      item.needsClothing ? "Kleidung" : null,
                      item.needsBikepackingBag ? "Bikepackingtasche" : null,
                      item.needsGlasses ? "Rennradbrille" : null,
                      item.bottleHolderIncluded ? "Flaschenhalter inklusive" : null,
                      item.repairKitIncluded ? "Reparaturset inklusive" : null,
                    ].filter((value): value is string => Boolean(value));
                    const priceCents = match?.item.itemPriceCents ?? requestedDailyPriceCents;
                    const concreteBikeDiffers = match && match.asset.displayName !== item.requestedLabel;

                    return (
                      <div className="h-full rounded-xl border p-4" key={item.id}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                              Fahrrad {item.position}
                            </p>
                            <p className="mt-1 font-medium">{item.requestedLabel}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.heightCm} cm
                              {accessories.length ? ` · ${accessories.join(" · ")}` : " · Kein Zubehör"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-muted-foreground">Preis/Tag</p>
                            <p className="mt-1 font-medium">
                              {priceCents !== undefined ? formatEuro(priceCents) : "—"}
                            </p>
                          </div>
                        </div>
                        {concreteBikeDiffers ? (
                          <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                            <span className="text-muted-foreground">Konkretes Fahrrad:</span> {match.asset.displayName}
                          </p>
                        ) : null}
                        {!match && latestOffer ? (
                          <p className="mt-3 text-sm text-muted-foreground">Noch nicht zugeordnet.</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Nachricht</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {booking.customerMessage || "Keine Nachricht hinterlegt."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/15">
            <CardHeader className="border-b border-border/60 pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Nächste Aktion</CardTitle>
                  <CardDescription className="mt-1">
                    Die wichtigsten Schritte für diese Buchung direkt an einem Ort.
                  </CardDescription>
                </div>
                <Badge variant={statusView.badge}>{statusView.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4 sm:p-5">
                <p className="text-xs font-medium tracking-wide text-primary uppercase">Empfohlener nächster Schritt</p>
                <p className="mt-2 text-base font-semibold">{nextAction.title}</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{nextAction.description}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/25 p-3 sm:px-4">
                <div>
                  <p className="text-sm font-medium">Zuständigkeit</p>
                  <p className="text-sm text-muted-foreground">
                    {assignee ? `${assignee.name} bearbeitet diese Buchung.` : "Noch niemand zugewiesen."}
                  </p>
                </div>
                <BookingAssigneeCard
                  bookingId={booking.id}
                  bookingLocationLabel={locationLabel}
                  assignee={assignee}
                  eligibleUsers={eligibleAssignees}
                  currentUserId={session.user.id}
                  isAdmin={isAdmin(session.user)}
                  canSelfAssign={canSelfAssign}
                />
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Aktionen</h3>
                </div>
                <BookingCommandActions
                  bookingId={booking.id}
                  bookingTotalCents={latestOffer?.totalCents ?? booking.quotedTotalCents}
                  invoiceNumber={suggestedInvoiceNumber}
                  periodFrom={booking.periodFrom}
                  periodTo={booking.periodTo}
                  pickupTime={booking.pickupTime}
                  dropoffTime={booking.dropoffTime}
                  status={booking.status}
                  customerName={booking.customerName}
                  senderName={session.user.name}
                  paymentAccounts={paymentAccounts}
                  isLegacy={booking.source === "legacy"}
                  canExecuteActions={
                    hasAssignedCaseworker && (isAdmin(session.user) || booking.assignedUserId === session.user.id)
                  }
                  isAdmin={isAdmin(session.user)}
                  hasActiveOffer={hasActiveOffer}
                  offers={offers.map((offer) => ({
                    id: offer.id,
                    label: `Angebot #${offer.offerNumber} · ${offer.status === "sent" ? "versendet" : offer.status === "expired" ? "abgelaufen" : offer.status === "accepted" ? "bestätigt" : "zurückgezogen"}`,
                    status: offer.status,
                    totalCents: offer.totalCents,
                  }))}
                  confirmedBookingEdit={
                    hasAssignedCaseworker && booking.status === "confirmed"
                      ? {
                          expectedVersion: booking.version,
                          customerName: booking.customerName,
                          customerEmail: booking.customerEmail,
                          customerPhone: booking.customerPhone,
                          periodFrom: booking.periodFrom,
                          periodTo: booking.periodTo,
                          pickupTime: booking.pickupTime,
                          dropoffTime: booking.dropoffTime,
                          customerMessage: booking.customerMessage,
                          communicationLocale: booking.communicationLocale,
                          requestedItems: items,
                        }
                      : undefined
                  }
                  requestedItems={items.map((item) => ({
                    id: item.id,
                    label: `${item.position}. ${item.requestedLabel} (${item.heightCm} cm)`,
                    requestedLabel: item.requestedLabel,
                    heightCm: item.heightCm,
                    accessories: {
                      needsPedals: item.needsPedals,
                      pedalType: item.pedalType,
                      needsComputerMount: item.needsComputerMount,
                      computerMountType: item.computerMountType,
                      needsHelmet: item.needsHelmet,
                      needsClothing: item.needsClothing,
                      needsBikepackingBag: item.needsBikepackingBag,
                      needsGlasses: item.needsGlasses,
                      bottleHolderIncluded: item.bottleHolderIncluded,
                      repairKitIncluded: item.repairKitIncluded,
                    },
                  }))}
                  availableAssets={availableAssets}
                  unavailableAssetIds={unavailableAssetIds}
                  journalEntries={entries.map((entry) => ({ id: entry.id, label: `${entry.kind}: ${entry.reason}` }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mailverlauf</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingMailThreadSync bookingId={booking.id} />
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
