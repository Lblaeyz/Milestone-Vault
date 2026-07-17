import { useAccount } from 'wagmi';
import { Link, useLocation } from 'wouter';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Shell } from '@/lib/shell';
import { useListAgreements } from '@workspace/api-client-react';
import { formatMON, shortenAddress } from '@/lib/format';
import { AgreementStatus, AGREEMENT_STATUS_LABELS } from '@/contracts/config';

function statusBadgeClass(status: number): string {
  if (status === AgreementStatus.Completed) return 'badge badge-green';
  if (status === AgreementStatus.Active)    return 'badge badge-green';
  if (status === AgreementStatus.Disputed)  return 'badge badge-red';
  if (status === AgreementStatus.Funded || status === AgreementStatus.Created) return 'badge badge-amber';
  return 'badge badge-muted';
}

export default function InvestorDashboard() {
  const { address, isConnected } = useAccount();
  const [, navigate] = useLocation();

  const { data: agreements, isLoading } = useListAgreements(
    { investor: address },
    { query: { enabled: !!address } }
  );

  if (!isConnected || !address) {
    return (
      <Shell nav={{}}>
        <div className="max-w-2xl mx-auto px-6 py-24 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 flex items-center justify-center" style={{ background: 'color-mix(in srgb, #D4A34E 10%, transparent)', border: '1px solid color-mix(in srgb, #D4A34E 25%, transparent)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="7" width="20" height="15" rx="2" stroke="var(--signal-amber)" strokeWidth="1.5"/>
              <path d="M16 7V5a4 4 0 0 0-8 0v2" stroke="var(--signal-amber)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="font-heading text-2xl mb-2">Investor Dashboard</h1>
            <p className="text-muted-foreground text-sm">Connect your wallet to view and manage your funded projects.</p>
          </div>
          <ConnectButton />
        </div>
      </Shell>
    );
  }

  return (
    <Shell nav={{}}>
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl">Your Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Projects you've funded as investor · <span className="font-mono">{shortenAddress(address)}</span>
            </p>
          </div>
          <Link href="/create" className="btn-primary">
            + New Project
          </Link>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="vault-card p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : !agreements || agreements.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {agreements.map(ag => (
              <AgreementRow key={ag.contractAddress} agreement={ag} role="investor" />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function EmptyState() {
  return (
    <div className="vault-card p-16 flex flex-col items-center gap-6 text-center">
      <div className="w-20 h-20 flex items-center justify-center rounded-full"
        style={{ background: 'color-mix(in srgb, #D4A34E 8%, transparent)', border: '1px solid color-mix(in srgb, #D4A34E 20%, transparent)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="7" width="20" height="15" rx="2" stroke="var(--signal-amber)" strokeWidth="1.5"/>
          <path d="M16 7V5a4 4 0 0 0-8 0v2" stroke="var(--signal-amber)" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="12" cy="14.5" r="1.5" fill="var(--signal-amber)"/>
        </svg>
      </div>
      <div>
        <h2 className="font-heading text-xl mb-2">Fund your first project</h2>
        <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
          Create an escrow agreement, set milestones, and deposit MON. Share the link with your builder — they accept on-chain.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <Link href="/create" className="btn-primary">Create Agreement</Link>
        <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" className="btn-ghost text-sm">
          Get test MON ↗
        </a>
      </div>
    </div>
  );
}

function AgreementRow({ agreement, role }: { agreement: any; role: 'investor' | 'builder' }) {
  const status = agreement.status as number | undefined;

  return (
    <Link href={`/agreement/${agreement.contractAddress}`}>
      <div className="vault-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-signal-amber/40 transition-colors cursor-pointer group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="font-heading text-lg font-medium group-hover:text-signal-amber transition-colors truncate">
              {agreement.projectName}
            </span>
            {status !== undefined && (
              <span className={statusBadgeClass(status)}>
                {AGREEMENT_STATUS_LABELS[status as AgreementStatus] ?? 'Unknown'}
              </span>
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground font-mono flex-wrap">
            <span title={agreement.contractAddress}>Vault: {shortenAddress(agreement.contractAddress)}</span>
            {role === 'investor' && agreement.builderAddress && (
              <span>Builder: {shortenAddress(agreement.builderAddress)}</span>
            )}
            {role === 'builder' && agreement.investorAddress && (
              <span>Client: {shortenAddress(agreement.investorAddress)}</span>
            )}
          </div>
          {agreement.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{agreement.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground text-sm group-hover:text-foreground transition-colors shrink-0">
          <span className="text-xs hidden sm:block">Open</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </Link>
  );
}

export { AgreementRow };
