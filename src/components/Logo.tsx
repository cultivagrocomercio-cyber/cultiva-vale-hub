import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("h-9 w-9", className)} aria-hidden="true">
      <rect width="40" height="40" rx="12" className="fill-primary" />
      <path
        d="M11 29c0-9.5 6.5-16.5 18-17-.4 11.5-7.3 18-17 17.5"
        className="fill-leaf-light"
      />
      <path d="M12 28.5 27 14" className="stroke-primary" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 23.5c2 .3 3.6 0 5.2-1.2M15 26.4c2.6.5 5 .1 7.6-1.8" className="stroke-primary" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="29.5" cy="11.5" r="2.4" className="fill-accent" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5", className)} aria-label="Cultiva Vale Marketplace — início">
      <LeafMark />
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-lg font-semibold tracking-tight text-foreground">Cultiva Vale</span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Marketplace</span>
        </span>
      )}
    </Link>
  );
}
