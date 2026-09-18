"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusItems = [
  { value: "all", label: "Alle Status" },
  { value: "queued", label: "In Warteschlange" },
  { value: "leased", label: "Wird versendet" },
  { value: "sent", label: "Versendet" },
  { value: "failed", label: "Fehlgeschlagen" },
];

export function MailOutboxFilter({ search, status }: { search: string; status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(search);

  const updateParam = useCallback(
    (key: "q" | "status", nextValue: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!nextValue || nextValue === "all") params.delete(key);
      else params.set(key, nextValue);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const nextSearch = searchValue.trim();
    if ((searchParams.get("q") ?? "") === nextSearch) return;
    const timeout = window.setTimeout(() => updateParam("q", nextSearch || null), 350);
    return () => window.clearTimeout(timeout);
  }, [searchValue, searchParams, updateParam]);

  return (
    <div className="flex min-w-0 w-full flex-1 flex-wrap items-center gap-1.5 sm:flex-nowrap">
      <InputGroup className="w-full bg-input/50 sm:w-96">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Empfänger, Betreff oder Buchung suchen …"
          aria-label="E-Mail-Postausgang durchsuchen"
        />
      </InputGroup>
      <div className="ml-auto flex w-full justify-end gap-1.5 sm:w-auto">
        <Select items={statusItems} value={status} onValueChange={(value) => updateParam("status", value)}>
          <SelectTrigger
            size="sm"
            className="min-w-0 flex-1 bg-card sm:w-48 sm:flex-none"
            aria-label="Nach Status filtern"
          >
            <SelectValue className="text-sm font-normal">
              {statusItems.find((item) => item.value === status)?.label ?? "Alle Status"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {search || status !== "all" ? (
          <Button type="button" variant="ghost" className="bg-card hover:bg-card" onClick={() => router.push(pathname)}>
            Zurücksetzen
          </Button>
        ) : null}
      </div>
    </div>
  );
}
