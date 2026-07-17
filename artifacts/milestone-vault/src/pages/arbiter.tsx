import { useCallback, useState } from 'react';
import { useAccount, useReadContracts, useWriteContract, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'wouter';
import { Shell } from '@/lib/shell';
import { useListDisputedAgreements } from '@workspace/api-client-react';
import MilestoneVaultAbi from '@/contracts/MilestoneVault.json';
import { formatMON, shortenAddress } from '@/lib/format';
import { ARBITER_ADDRESS, RequestStatus, RequestType } from '@/contracts/config';

export default function ArbiterPanel() {
  const { address, isConnected } = useAccount();
  const isArbiter = !!address && address.toLowerCase() === ARBITER_ADDRESS.toLowerCase();

  const { data: allAgreements, isLoading } = useListDisputedAgreements({
    query: { enabled: isArbiter }
  });

  // "Not connected" state — ask them to connect
  if (!isConnected) {
    return (
      <Shell nav={{ arbiterBadge: true }}>
        <div className="max-w-2xl mx-auto px-6 py-24 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, #D4A34E 10%, transparent)', border: '1px solid color-mix(in srgb, #D4A34E 30%, transparent)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="var(--signal-amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="font-heading text-2xl mb-2">Arbiter Panel</h1>
            <p className="text-muted-foreground text-sm">Connect the arbiter wallet to review and resolve disputes.</p>
          </div>
          <ConnectButton />
          <p className="text-xs text-muted-foreground font-mono">Expected: {shortenAddress(ARBITER_ADDRESS)}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell nav={{ arbiterBadge: true }}>
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-heading text-3xl">Active Disputes</h1>
            {allAgreements && allAgreements.length > 0 && (
              <span className="badge badge-red">{allAgreements.length} open</span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Agreements with disputed payout requests. Review evidence and issue a ruling.
          </p>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1,2].map(i => <div key={i} className="vault-card p-6 h-32 animate-pulse" />)}
          </div>
        ) : !allAgreements || allAgreements.length === 0 ? (
          <div className="vault-card p-16 text-center">
            <div className="text-4xl mb-4">⚖️</div>
            <h2 className="font-heading text-xl mb-2">No active disputes</h2>
            <p className="text-muted-foreground text-sm">Disputes will appear here when builders raise them on-chain.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {allAgreements.map(agreement => (
              <DisputeCard key={agreement.contractAddress} agreement={agreement} />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

// ── Individual dispute card (expand/collapse) ─────────────────────────────────
function DisputeCard({ agreement }: { agreement: any }) {
  const [expanded, setExpanded] = useState(false);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  const { data: readData, refetch } = useReadContracts({
    contracts: [
      { address: agreement.contractAddress as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'getRequests' },
      { address: agreement.contractAddress as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'remainingLocked' },
      { address: agreement.contractAddress as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'investor' },
      { address: agreement.contractAddress as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'builder' },
    ]
  });

  const reqs = readData?.[0]?.result as any[] | undefined;
  const remainingLocked = readData?.[1]?.result as bigint | undefined;
  const investor = readData?.[2]?.result as string | undefined;
  const builder = readData?.[3]?.result as string | undefined;

  const disputedReqs = reqs?.filter(r => r.status === RequestStatus.Disputed) ?? [];

  // Skip cards with no active disputes on-chain
  if (disputedReqs.length === 0) return null;

  const withTx = async (key: string, fn: () => Promise<`0x${string}`>, successMsg: string) => {
    if (!publicClient) return;
    setPendingAction(key);
    setTxError(null);
    setTxSuccess(null);
    try {
      const hash = await fn();
      await publicClient.waitForTransactionReceipt({ hash });
      await refetch();
      setTxSuccess(successMsg);
    } catch (err: any) {
      setTxError(err.shortMessage ?? err.message ?? 'Transaction failed');
    } finally {
      setPendingAction(null);
    }
  };

  const handleResolve = (requestId: number, releaseToBuilder: boolean) =>
    withTx(
      `resolve-${requestId}-${releaseToBuilder}`,
      () => writeContractAsync({
        address: agreement.contractAddress as `0x${string}`,
        abi: MilestoneVaultAbi.abi,
        functionName: 'resolveDispute',
        args: [BigInt(requestId), releaseToBuilder],
      }),
      releaseToBuilder ? 'Funds released to builder.' : 'Dispute denied — funds stay locked.'
    );

  const anyPending = pendingAction !== null;
  const isLoading = (key: string) => pendingAction === key;

  return (
    <div className="vault-card" style={{ borderColor: 'color-mix(in srgb, #E5484D 35%, transparent)' }}>
      {/* Summary row — always visible */}
      <button
        className="w-full p-5 flex items-start justify-between gap-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="font-heading text-lg font-medium">{agreement.projectName}</span>
            <span className="badge badge-red">{disputedReqs.length} dispute{disputedReqs.length > 1 ? 's' : ''}</span>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground font-mono flex-wrap">
            <span>
              Vault:{' '}
              <Link
                href={`/agreement/${agreement.contractAddress}`}
                onClick={e => e.stopPropagation()}
                className="text-foreground hover:text-signal-amber transition-colors"
              >
                {shortenAddress(agreement.contractAddress)}
              </Link>
            </span>
            {builder && <span>Builder: {shortenAddress(builder)}</span>}
            {investor && <span>Client: {shortenAddress(investor)}</span>}
            <span className="tabular-nums">Locked: {formatMON(remainingLocked)}</span>
          </div>
          {agreement.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{agreement.description}</p>
          )}
        </div>
        <svg
          className={`shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Expanded: full plea + resolve buttons */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {disputedReqs.map(r => {
            const id = Number(r.id);
            const typeLabel = r.reqType === RequestType.Milestone
              ? `Milestone #${Number(r.milestoneIndex) + 1}`
              : 'Ad-hoc';

            return (
              <div key={id} className="p-5 flex flex-col gap-4">
                {/* Request summary */}
                <div className="flex items-start gap-3 flex-wrap justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge badge-red">Disputed</span>
                      <span className="badge badge-muted">{typeLabel}</span>
                      <span className="font-mono tabular-nums text-lg font-medium">{formatMON(r.amount)}</span>
                    </div>
                    {r.reason ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
                          {r.reason.startsWith('http') ? 'Evidence' : 'Reason'}
                        </span>
                        {r.reason.startsWith('http') ? (
                          <a
                            href={r.reason}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-mono break-all hover:text-signal-amber underline underline-offset-2"
                            style={{ color: 'var(--signal-amber)' }}
                          >
                            {r.reason}
                          </a>
                        ) : (
                          <p className="text-sm font-mono break-all">{r.reason}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No evidence provided</p>
                    )}
                  </div>
                </div>

                {/* Arbiter ruling */}
                {!txSuccess ? (
                  <div className="flex flex-col gap-3 pt-1">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Issue ruling</div>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => handleResolve(id, true)}
                        disabled={anyPending}
                        className="btn-green"
                      >
                        {isLoading(`resolve-${id}-true`) ? 'Confirming…' : '✓ Release to Builder'}
                      </button>
                      <button
                        onClick={() => handleResolve(id, false)}
                        disabled={anyPending}
                        className="btn-red"
                      >
                        {isLoading(`resolve-${id}-false`) ? 'Confirming…' : '✗ Deny Request'}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      "Release to Builder" sends <strong className="text-foreground tabular-nums">{formatMON(r.amount)}</strong> from escrow.
                      "Deny" keeps funds locked in the vault.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-signal-green text-sm font-medium py-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {txSuccess}
                  </div>
                )}

                {txError && (
                  <div className="text-xs text-signal-red font-mono p-3 border border-signal-red/30 bg-signal-red/5">
                    Error: {txError}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
