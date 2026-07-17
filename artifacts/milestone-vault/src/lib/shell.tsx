import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'wouter';

// ── Logo wordmark ─────────────────────────────────────────────────────────────
export function VaultLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;
  const textClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl';
  return (
    <span className={`flex items-center gap-2 ${textClass} font-heading font-semibold tracking-tight`}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="11" width="18" height="12" rx="2" fill="var(--signal-amber)" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="var(--signal-amber)" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="17" r="1.5" fill="#12141A"/>
        <rect x="11.25" y="17" width="1.5" height="2.5" rx="0.75" fill="#12141A"/>
      </svg>
      MilestoneVault
    </span>
  );
}

// ── Top navigation bar ────────────────────────────────────────────────────────
interface NavProps {
  /** Optional back link href */
  back?: string;
  /** Optional back label */
  backLabel?: string;
  /** Show amber "Arbiter Panel" badge next to logo */
  arbiterBadge?: boolean;
}

export function TopNav({ back, backLabel = '← Back', arbiterBadge }: NavProps) {
  return (
    <header className="w-full flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <VaultLogo />
        </Link>
        {arbiterBadge && (
          <span className="badge badge-amber hidden sm:inline-flex">Arbiter Panel</span>
        )}
        {back && (
          <Link href={back} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2">
            {backLabel}
          </Link>
        )}
      </div>
      <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
    </header>
  );
}

// ── Page shell wrapper ────────────────────────────────────────────────────────
export function Shell({
  children,
  nav,
}: {
  children: React.ReactNode;
  nav?: NavProps;
}) {
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <TopNav {...nav} />
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
}
