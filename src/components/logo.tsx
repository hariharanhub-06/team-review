import { cn } from "@/lib/utils";

/**
 * HH Team brand mark — an "HH" monogram set inside an engineering gear,
 * with a drafting-compass tick. Reads cleanly from 20px up.
 */
export function LogoMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="HH Team"
    >
      <defs>
        <linearGradient id="hhLogoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="0.5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="14" fill="url(#hhLogoBg)" />

      {/* gear teeth */}
      <g fill="#ffffff" opacity="0.85">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <rect
            key={deg}
            x="29.4"
            y="4.5"
            width="5.2"
            height="7.5"
            rx="1.4"
            transform={`rotate(${deg} 32 32)`}
          />
        ))}
      </g>

      {/* gear ring */}
      <circle
        cx="32"
        cy="32"
        r="20"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.6"
        opacity="0.9"
      />

      {/* HH monogram */}
      <g fill="#ffffff">
        <rect x="19.5" y="24" width="3.3" height="16" rx="0.6" />
        <rect x="27.2" y="24" width="3.3" height="16" rx="0.6" />
        <rect x="19.5" y="30.4" width="11" height="3.2" />

        <rect x="33.5" y="24" width="3.3" height="16" rx="0.6" />
        <rect x="41.2" y="24" width="3.3" height="16" rx="0.6" />
        <rect x="33.5" y="30.4" width="11" height="3.2" />
      </g>
    </svg>
  );
}

/** Full lockup: mark + "HH Team" wordmark. */
export function Logo({
  size = 36,
  showText = true,
  subtitle = "Engineering Work Tracker",
  className,
}: {
  size?: number;
  showText?: boolean;
  subtitle?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showText && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-base font-bold tracking-tight text-foreground">
            HH <span className="text-primary">Team</span>
          </p>
          {subtitle && (
            <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
