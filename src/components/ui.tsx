import { clsx } from "clsx";
import React from "react";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-lg border border-line bg-white shadow-soft", className)} {...props} />;
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return (
    <button
      className={clsx(
        "focus-ring inline-flex min-h-10 items-center justify-center rounded px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" && "bg-ink text-white hover:bg-ink/90",
        variant === "secondary" && "border border-line bg-white text-ink hover:bg-paper",
        variant === "danger" && "bg-ember text-white hover:bg-ember/90",
        variant === "ghost" && "text-ink hover:bg-white",
        className
      )}
      {...props}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="focus-ring min-h-11 w-full rounded border border-line bg-white px-3 text-sm" {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="focus-ring min-h-28 w-full rounded border border-line bg-white px-3 py-2 text-sm" {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="focus-ring min-h-11 w-full rounded border border-line bg-white px-3 text-sm" {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={clsx("grid gap-1 text-sm font-medium text-ink", className)} {...props} />;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "green" | "red" | "yellow" | "neutral" | "blue" }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded px-2 py-1 text-xs font-medium",
        tone === "green" && "bg-emerald-50 text-emerald-700",
        tone === "red" && "bg-red-50 text-red-700",
        tone === "yellow" && "bg-amber-50 text-amber-700",
        tone === "blue" && "bg-sky-50 text-sky-700",
        tone === "neutral" && "bg-stone-100 text-stone-700"
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white/70 p-8 text-center">
      <p className="font-medium">{title}</p>
      {text ? <p className="mt-2 text-sm text-ink/60">{text}</p> : null}
    </div>
  );
}

export function statusTone(status: string) {
  if (["PUBLIC", "APPROVED", "ACTIVE", "AVAILABLE", "CLAIMED"].includes(status)) return "green" as const;
  if (["PENDING", "DRAFT", "PAUSED"].includes(status)) return "yellow" as const;
  if (["REJECTED", "DISABLED", "DELETED", "ENDED"].includes(status)) return "red" as const;
  return "neutral" as const;
}
