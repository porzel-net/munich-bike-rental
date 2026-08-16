"use client";

import { useMemo } from "react";

import { FixedAssetDisposalLauncher } from "@/components/fixed-asset-disposal-dialog";
import { PrivateAssetContributionLauncher } from "@/components/private-asset-contribution-dialog";
import { Card, CardDescription, CardTitle, CardContent } from "@/components/ui/card";
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
  bookValueCents: number;
};

type FinancialAccountOption = { id: number; code: string; name: string };

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function formatDate(value: string) {
  return date.format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function assetTypeLabel(value: string) {
  if (value === "bike") return "Fahrrad";
  if (value === "equipment") return "Ausstattung";
  return "Sonstiges";
}

export function FixedAssetsTable({
  assets,
  financialAccounts,
}: {
  assets: FixedAssetRow[];
  financialAccounts: FinancialAccountOption[];
}) {
  const rows = assets;
  const activeCount = useMemo(() => rows.filter((asset) => asset.status === "active").length, [rows]);

  return (
    <Card className="mt-6 overflow-hidden rounded-3xl border-border/60 bg-card p-0 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Anlageverzeichnis</CardTitle>
            <CardDescription>
              {activeCount} aktive Anlagegüter · AfA wird automatisch bis zum aktuellen Monat gebucht.
            </CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <PrivateAssetContributionLauncher />
          </div>
        </div>
        <Table className="[&_td]:px-6 [&_td]:py-5 [&_th]:px-6 [&_th]:py-4">
          <TableHeader>
            <TableRow>
              <TableHead>Anlagegut</TableHead>
              <TableHead>Anschaffung</TableHead>
              <TableHead>Nutzungsdauer</TableHead>
              <TableHead>AfA gebucht</TableHead>
              <TableHead>Buchwert</TableHead>
              <TableHead className="text-right">Wert</TableHead>
              <TableHead>Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="font-medium">{asset.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {assetTypeLabel(asset.assetType)} · {asset.status === "active" ? "aktiv" : "ausgeschieden"}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(asset.acquisitionDate)}</TableCell>
                  <TableCell>{asset.usefulLifeMonths} Monate</TableCell>
                  <TableCell>{euro.format(asset.postedDepreciationCents / 100)}</TableCell>
                  <TableCell>{euro.format(asset.bookValueCents / 100)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {euro.format(asset.acquisitionCostCents / 100)}
                  </TableCell>
                  <TableCell>
                    {asset.status === "active" ? (
                      <FixedAssetDisposalLauncher asset={asset} financialAccounts={financialAccounts} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Noch keine Anlagegüter erfasst.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
