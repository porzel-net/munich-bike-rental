"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type FixedAssetRow = {
  id: number;
  assetNumber: string;
  name: string;
  assetType: string;
  acquisitionDate: string;
  inServiceDate: string;
  acquisitionCostCents: number;
  usefulLifeMonths: number;
  status: string;
  postedDepreciationCents: number;
};

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function formatDate(value: string) {
  return date.format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatThroughMonth(value: string) {
  return `${value.slice(5, 7)} ${value.slice(0, 4)}`;
}

function assetTypeLabel(value: string) {
  if (value === "bike") return "Fahrrad";
  if (value === "equipment") return "Ausstattung";
  return "Sonstiges";
}

export function FixedAssetsTable({ assets }: { assets: FixedAssetRow[] }) {
  const router = useRouter();
  const rows = assets;
  const [busy, setBusy] = useState(false);
  const throughMonth = new Date().toISOString().slice(0, 7);
  const activeCount = useMemo(() => rows.filter((asset) => asset.status === "active").length, [rows]);

  async function postDepreciation() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/financial/assets/depreciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ throughMonth }),
      });
      const result = (await response.json().catch(() => null)) as { posted?: number; message?: string } | null;
      if (!response.ok) throw new Error(result?.message || "AfA konnte nicht gebucht werden.");
      toast.success(
        result?.posted ? `${result.posted} AfA-Perioden wurden gebucht.` : "Keine neuen AfA-Perioden fällig.",
      );
      if (result?.posted) {
        router.refresh();
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "AfA konnte nicht gebucht werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Anlageverzeichnis</CardTitle>
          <CardDescription>{activeCount} aktive Anlagegüter · AfA wird monatsweise geführt.</CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={postDepreciation} disabled={busy || !activeCount}>
          {busy ? "Wird gebucht…" : `AfA bis ${formatThroughMonth(throughMonth)}`}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Inventarnummer</TableHead>
            <TableHead>Anlagegut</TableHead>
            <TableHead>Anschaffung</TableHead>
            <TableHead>Nutzungsdauer</TableHead>
            <TableHead>AfA gebucht</TableHead>
            <TableHead className="text-right">Wert</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell className="font-mono text-xs">{asset.assetNumber}</TableCell>
                <TableCell>
                  <div className="font-medium">{asset.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {assetTypeLabel(asset.assetType)} · {asset.status === "active" ? "aktiv" : "ausgeschieden"}
                  </div>
                </TableCell>
                <TableCell>{formatDate(asset.acquisitionDate)}</TableCell>
                <TableCell>{asset.usefulLifeMonths} Monate</TableCell>
                <TableCell>{euro.format(asset.postedDepreciationCents / 100)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {euro.format(asset.acquisitionCostCents / 100)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                Noch keine Anlagegüter erfasst.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
