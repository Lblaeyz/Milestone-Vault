import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'wouter';
import { useListAgreements } from '@workspace/api-client-react';
import { shortenAddress } from '@/lib/format';

export default function BuilderAgreements() {
  const { address } = useAccount();
  const { data: asBuilder } = useListAgreements(
    { builder: address?.toLowerCase() },
    { query: { enabled: !!address } }
  );
  const { data: asInvestor } = useListAgreements(
    { investor: address?.toLowerCase() },
    { query: { enabled: !!address } }
  );

  return (
    <div className="min-h-[100dvh] w-full flex flex-col">
      <header className="w-full flex justify-between items-start p-6 border-b border-border">
        <div>
          <Link href="/" className="text-xl font-medium tracking-tight hover:opacity-80 transition-opacity">MilestoneVault</Link>
          <div className="text-sm text-muted-foreground mt-1">Your Agreements</div>
        </div>
        <ConnectButton showBalance={false} />
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-6 flex flex-col gap-8">
        {!address ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 py-24">
            <p className="text-muted-foreground text-sm">Connect your wallet to view your agreements</p>
            <ConnectButton />
          </div>
        ) : (
          <>
            <AgreementSection title="As Builder" agreements={asBuilder ?? []} emptyText="No agreements found where you are the builder." />
            <AgreementSection title="As Investor" agreements={asInvestor ?? []} emptyText="No agreements found where you are the investor." />
          </>
        )}
      </main>
    </div>
  );
}

function AgreementSection({ title, agreements, emptyText }: {
  title: string;
  agreements: Array<{ contractAddress: string; projectName: string; builderAddress: string; investorAddress: string; description: string }>;
  emptyText: string;
}) {
  return (
    <section>
      <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">{title}</h2>
      <div className="border border-border divide-y divide-border">
        {agreements.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">{emptyText}</div>
        ) : agreements.map((a) => (
          <Link
            key={a.contractAddress}
            href={`/agreement/${a.contractAddress}`}
            className="flex items-center justify-between px-4 py-4 hover:bg-muted transition-colors block"
          >
            <div>
              <div className="font-medium text-sm">{a.projectName}</div>
              <div className="text-xs text-muted-foreground font-mono mt-1">{shortenAddress(a.contractAddress)}</div>
            </div>
            <div className="text-xs text-muted-foreground font-mono">→</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
