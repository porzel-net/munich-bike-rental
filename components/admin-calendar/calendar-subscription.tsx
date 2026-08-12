"use client";

import { CalendarPlus, Check, Copy, MapPin } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export type CalendarFeedLink = {
  location: string;
  label: string;
  calendarUrl: string;
};

export function CalendarSubscription({ feeds }: { feeds: CalendarFeedLink[] }) {
  const [copiedLocation, setCopiedLocation] = useState<string | null>(null);

  async function copyUrl(feed: CalendarFeedLink) {
    try {
      await navigator.clipboard.writeText(feed.calendarUrl);
      setCopiedLocation(feed.location);
      window.setTimeout(() => setCopiedLocation(null), 1800);
    } catch {
      setCopiedLocation(null);
    }
  }

  return (
    <div className="calendar-subscription">
      <div className="calendar-subscription-copy">
        <CalendarPlus className="size-4" aria-hidden="true" />
        <div>
          <strong>Apple Kalender abonnieren</strong>
          <span>URL kopieren und in Apple Kalender als neues Kalenderabo einfügen.</span>
        </div>
      </div>
      <div className="calendar-subscription-feeds">
        {feeds.map((feed) => {
          const copied = copiedLocation === feed.location;
          return (
            <div className="calendar-subscription-feed" key={feed.location}>
              <strong>
                <MapPin className="size-3.5" aria-hidden="true" />
                {feed.label}
              </strong>
              <div className="calendar-subscription-feed-actions">
                <Button type="button" variant="ghost" size="sm" onClick={() => copyUrl(feed)}>
                  {copied ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                  {copied ? "Kopiert" : "URL kopieren"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
