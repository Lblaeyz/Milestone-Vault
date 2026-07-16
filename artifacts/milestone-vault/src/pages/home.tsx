import { Link } from 'wouter';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Home() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center">
      <header className="w-full flex justify-between items-start p-6 border-b border-border">
        <div>
          <div className="text-xl font-medium tracking-tight">MilestoneVault</div>
          <div className="text-sm text-muted-foreground mt-1">Trustless milestone escrow on Monad Testnet</div>
        </div>
        <ConnectButton showBalance={false} />
      </header>

      <main className="flex-1 w-full max-w-3xl flex flex-col items-center justify-center p-6 gap-8">
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Link href="/create" className="px-8 py-3 bg-primary text-primary-foreground font-medium text-center hover:opacity-90 transition-opacity">
            I'm an Investor
          </Link>
          <Link href="/agreements" className="px-8 py-3 border border-border text-foreground font-medium text-center hover:bg-muted transition-colors">
            I'm a Builder
          </Link>
          <Link href="/arbiter" className="px-8 py-3 border border-border/50 text-muted-foreground font-medium text-center hover:bg-muted transition-colors text-sm">
            Arbiter Panel
          </Link>
        </div>

        <div className="text-center flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            New to Monad? Get test MON at <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" className="underline underline-offset-4 text-foreground">faucet.monad.xyz</a>
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            All agreement dashboards are publicly viewable without a wallet — only writes require one.
          </p>
        </div>
      </main>
    </div>
  );
}
