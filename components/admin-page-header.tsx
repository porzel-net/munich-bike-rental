import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function AdminPageHeader({ title, description, actions, className = "" }: AdminPageHeaderProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 ${className}`.trim()}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </div>
  );
}
