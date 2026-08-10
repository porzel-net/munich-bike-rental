import { Badge } from "@/components/ui/badge";

type BookingAssigneeBadgeProps = {
  assigneeName: string | null;
};

export function BookingAssigneeBadge({ assigneeName }: BookingAssigneeBadgeProps) {
  if (!assigneeName) {
    return <Badge variant="destructive">Kein Sachbearbeiter</Badge>;
  }

  return (
    <Badge variant="outline" className="max-w-56 gap-1">
      <span className="text-muted-foreground">Sachbearbeiter:</span>
      <span className="truncate">{assigneeName}</span>
    </Badge>
  );
}
