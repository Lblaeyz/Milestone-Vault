import { useAccount } from 'wagmi';
import { Link } from 'wouter';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ARBITER_ADDRESS } from '@/contracts/config';
import { VaultLogo } from '@/lib/shell';

export default function Home() {
  const { address, isConnected } = useAccount();
  const isArbiter = isConnected && !!address && address.toLowerCase() === ARBITER_ADDRESS.toLowerCase();

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-border">
        <VaultLogo size="lg" />
        <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-16">
        <div className="max-w-xl text-center flex flex-col gap-5">
          <div className="inline-flex items-center gap-2 text-xs text-signal-amber uppercase tracking-widest font-mono mx-auto">
            <span className="w-6 h-px bg-signal-amber/60" />
            Monad Testnet
            <span className="w-6 h-px bg-signal-amber/60" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-heading font-semibold leading-[1.1] tracking-tight">
            Escrow that works<br />
            <span style={{ color: 'var(--signal-amber)' }}>for both sides.</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
            Investors lock funds. Builders deliver milestones. Every approval, rejection, and dispute lives on-chain — no middleman, no trust required.
          </p>
        </div>

        {/* Role cards */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl">
          {/* Investor */}
          <Link
            href="/investor"
            className="group flex-1 vault-card p-6 flex flex-col gap-4 hover:border-signal-amber/50 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'color-mix(in srgb, #D4A34E 12%, transparent)', border: '1px solid color-mix(in srgb, #D4A34E 30%, transparent)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="7" width="20" height="15" rx="2" stroke="var(--signal-amber)" strokeWidth="1.5"/>
                  <path d="M16 7V5a4 4 0 0 0-8 0v2" stroke="var(--signal-amber)" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="14.5" r="1.5" fill="var(--signal-amber)"/>
                </svg>
              </div>
              <svg className="opacity-30 group-hover:opacity-70 transition-opacity" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M7 17L17 7M17 7H7M17 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="font-heading text-xl font-semibold mb-1">I'm an Investor</div>
              <div className="text-muted-foreground text-sm leading-relaxed">Fund projects, set milestones, and approve payouts as work is delivered.</div>
            </div>
            <div className="text-xs text-signal-amber font-medium mt-auto">View my projects →</div>
          </Link>

          {/* Builder */}
          <Link
            href="/builder"
            className="group flex-1 vault-card p-6 flex flex-col gap-4 hover:border-signal-green/50 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'color-mix(in srgb, #2FBF9C 12%, transparent)', border: '1px solid color-mix(in srgb, #2FBF9C 30%, transparent)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="var(--signal-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <svg className="opacity-30 group-hover:opacity-70 transition-opacity" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M7 17L17 7M17 7H7M17 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="font-heading text-xl font-semibold mb-1">I'm a Builder</div>
              <div className="text-muted-foreground text-sm leading-relaxed">Accept agreements, complete milestones, and request payouts with on-chain proof.</div>
            </div>
            <div className="text-xs text-signal-green font-medium mt-auto">View my agreements →</div>
          </Link>
        </div>

        {/* Arbiter — only shown when connected wallet matches */}
        {isArbiter && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-xs text-muted-foreground font-mono">Arbiter wallet detected</div>
            <Link
              href="/arbiter"
              className="badge badge-amber hover:opacity-80 transition-opacity cursor-pointer"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor"/>
              </svg>
              Open Arbiter Panel
            </Link>
          </div>
        )}

        {/* Footer note */}
        <div className="text-center flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Need test MON?{' '}
            <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4 hover:opacity-80">
              faucet.monad.xyz
            </a>
          </p>
          <p className="text-xs text-muted-foreground">Agreement dashboards are publicly readable — only writes need a wallet.</p>
        </div>
      </main>
    </div>
  );
}
