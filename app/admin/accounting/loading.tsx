export default function AccountingLoading() {
  return (
    <main className="flex flex-1 flex-col p-8 lg:p-12">
      <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm">
        <p className="font-medium">EÜR wird geladen …</p>
        <p className="text-muted-foreground">Stripe-Zahlungen werden automatisch synchronisiert.</p>
      </div>
    </main>
  );
}
