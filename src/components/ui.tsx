import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------------- Button ---------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "success";
  size?: "sm" | "md" | "lg" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-muted text-foreground hover:bg-accent",
    outline: "border border-border bg-transparent hover:bg-accent",
    ghost: "bg-transparent hover:bg-accent",
    destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
    success: "bg-[hsl(var(--success))] text-white hover:opacity-90",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-6 text-base",
    icon: "h-9 w-9",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

/* ---------------- Input ---------------- */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

/* ---------------- Textarea ---------------- */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/* ---------------- Select ---------------- */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

/* ---------------- Label ---------------- */
export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

/* ---------------- Card ---------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  );
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-2", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}

/* ---------------- Badge ---------------- */
export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}) {
  const tones: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
    warning: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-primary/15 text-primary",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

/* ---------------- StatCard ---------------- */
export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const toneColor =
    tone === "success"
      ? "text-[hsl(var(--success))]"
      : tone === "warning"
      ? "text-[hsl(var(--warning))]"
      : tone === "destructive"
      ? "text-destructive"
      : "text-foreground";
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", toneColor)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/* ---------------- Star rating ---------------- */
/** Renders a 0–100 score as 5 stars with smooth fractional fill. */
export function StarRating({
  score,
  size = 16,
  showValue = false,
  className,
}: {
  score: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, score || 0));
  const stars = "★★★★★";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 align-middle", className)}
      title={`${(pct / 20).toFixed(1)} / 5 stars`}
    >
      <span
        className="relative inline-block whitespace-nowrap leading-none"
        style={{ fontSize: size }}
        aria-hidden
      >
        <span className="text-muted-foreground/30">{stars}</span>
        <span
          className="absolute inset-0 overflow-hidden whitespace-nowrap text-[hsl(var(--warning))]"
          style={{ width: `${pct}%` }}
        >
          {stars}
        </span>
      </span>
      {showValue && (
        <span className="text-xs font-medium text-muted-foreground">
          {(pct / 20).toFixed(1)}
        </span>
      )}
    </span>
  );
}

/* ---------------- Status badge helper ---------------- */
export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge>—</Badge>;
  const map: Record<string, "success" | "warning" | "destructive" | "info" | "default"> = {
    COMPLETED: "success",
    DONE: "success",
    IN_PROGRESS: "info",
    IN_REVIEW: "warning",
    TODO: "default",
    BLOCKED: "destructive",
    REJECTED: "destructive",
  };
  const labels: Record<string, string> = {
    IN_REVIEW: "In Review",
    IN_PROGRESS: "In Progress",
    REJECTED: "Rejected",
  };
  const label = labels[status] ?? status.replace(/_/g, " ");
  return <Badge tone={map[status] ?? "default"}>{label}</Badge>;
}
