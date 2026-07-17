import { useState, useEffect, useCallback } from 'react';
import {
  useAccount, useReadContracts, useWriteContract,
  usePublicClient, useWatchContractEvent
} from 'wagmi';
import { useParams, Link } from 'wouter';
import { parseEther, parseEventLogs } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Shell } from '@/lib/shell';
import { formatMON, shortenAddress } from '@/lib/format';
import MilestoneVaultAbi from '@/contracts/MilestoneVault.json';
import {
  AgreementStatus, MilestoneStatus, RequestType, RequestStatus,
  AGREEMENT_STATUS_LABELS, MILESTONE_STATUS_LABELS, ARBITER_ADDRESS
} from '@/contracts/config';
import {
  useGetAgreement, useCreateRequestMeta,
  getGetAgreementQueryKey
} from '@workspace/api-client-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChainEvent {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function agreementStatusBadge(s: AgreementStatus | undefined) {
  if (s === undefined) return <span className="badge badge-muted">—</span>;
  if (s === AgreementStatus.Active || s === AgreementStatus.Completed)
    return <span className="badge badge-green">{AGREEMENT_STATUS_LABELS[s]}</span>;
  if (s === AgreementStatus.Disputed)
    return <span className="badge badge-red">{AGREEMENT_STATUS_LABELS[s]}</span>;
  return <span className="badge badge-amber">{AGREEMENT_STATUS_LABELS[s]}</span>;
}

function milestoneBarColor(s: MilestoneStatus) {
  if (s === MilestoneStatus.Approved)  return 'var(--signal-green)';
  if (s === MilestoneStatus.Requested) return 'var(--signal-amber)';
  if (s === MilestoneStatus.Rejected)  return 'var(--signal-red)';
  return 'rgba(242,240,234,0.12)';
}

function requestStatusBadge(r: any) {
  if (r.status === RequestStatus.Approved) return <span className="badge badge-green">Approved</span>;
  if (r.status === RequestStatus.Rejected) return <span className="badge badge-red">Rejected</span>;
  if (r.status === RequestStatus.Disputed) return <span className="badge badge-red">Disputed</span>;
  return <span className="badge badge-amber">Pending</span>;
}

function describeEvent(e: ChainEvent, inv: string, bld: string): string {
  const a = e.args;
  switch (e.eventName) {
    case 'Deposited':
      return `${shortenAddress(inv)} deposited ${formatMON(a.amount as bigint)}`;
    case 'AgreementAccepted':
      return `${shortenAddress(bld || String(a.builder || ''))} accepted the agreement`;
    case 'RequestCreated':
      return `Builder submitted a ${(a.reqType as number) === 0 ? 'milestone' : 'ad-hoc'} request for ${formatMON(a.amount as bigint)}`;
    case 'RequestApproved':
      return `Investor approved ${formatMON(a.amount as bigint)}`;
    case 'RequestRejected':
      return `Investor rejected request #${Number(a.requestId) + 1}`;
    case 'DisputeRaised':
      return `Builder raised a dispute on request #${Number(a.requestId) + 1}`;
    case 'DisputeResolved':
      return `Arbiter resolved dispute: ${(a.releasedToBuilder as boolean) ? 'released to builder' : 'denied'}`;
    default:
      return e.eventName;
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AgreementDashboard() {
  const { address } = useParams<{ address: string }>();
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();

  // Off-chain metadata
  const { data: meta } = useGetAgreement(address || '', {
    query: { enabled: !!address, retry: false, queryKey: getGetAgreementQueryKey(address || '') }
  });

  // All on-chain reads batched
  const { data: contractData, refetch } = useReadContracts({
    contracts: [
      { address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'totalDeposited' },
      { address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'totalReleased' },
      { address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'remainingLocked' },
      { address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'status' },
      { address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'investor' },
      { address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'builder' },
      { address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'getMilestones' },
      { address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'getRequests' },
    ]
  });

  const totalDeposited  = contractData?.[0]?.result as bigint | undefined;
  const totalReleased   = contractData?.[1]?.result as bigint | undefined;
  const remainingLocked = contractData?.[2]?.result as bigint | undefined;
  const vaultStatus     = contractData?.[3]?.result as AgreementStatus | undefined;
  const investor        = contractData?.[4]?.result as string | undefined;
  const builder         = contractData?.[5]?.result as string | undefined;
  const milestones      = contractData?.[6]?.result as any[] | undefined;
  const requests        = contractData?.[7]?.result as any[] | undefined;

  const isBuilder  = !!userAddress && userAddress.toLowerCase() === builder?.toLowerCase();
  const isInvestor = !!userAddress && userAddress.toLowerCase() === investor?.toLowerCase();
  const isArbiter  = !!userAddress && userAddress.toLowerCase() === ARBITER_ADDRESS.toLowerCase();
  const isParticipant = isBuilder || isInvestor || isArbiter;

  // Active requests (non-approved) shown at top
  const activeRequests = requests?.filter(r => r.status !== RequestStatus.Approved) ?? [];

  // ── Tx state ──────────────────────────────────────────────────────────────────
  const { writeContractAsync } = useWriteContract();
  const createRequestMeta = useCreateRequestMeta();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [txError, setTxError]             = useState<string | null>(null);

  // ── Activity feed ─────────────────────────────────────────────────────────────
  const [events, setEvents] = useState<ChainEvent[]>([]);

  const fetchEvents = useCallback(async () => {
    if (!address || !publicClient) return;
    try {
      const logs = await publicClient.getLogs({
        address: address as `0x${string}`,
        fromBlock: 0n,
        toBlock: 'latest',
      });
      const parsed = parseEventLogs({ abi: MilestoneVaultAbi.abi as any, logs, strict: false });
      const items: ChainEvent[] = parsed
        .map((e, idx) => ({
          eventName: e.eventName,
          args: e.args as Record<string, unknown>,
          blockNumber: e.blockNumber ?? 0n,
          transactionHash: e.transactionHash as `0x${string}`,
          logIndex: e.logIndex ?? idx,
        }))
        .sort((a, b) => {
          if (a.blockNumber !== b.blockNumber) return Number(b.blockNumber - a.blockNumber);
          return b.logIndex - a.logIndex;
        });
      setEvents(items);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  }, [address, publicClient]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const liveRefresh = useCallback(() => {
    refetch();
    fetchEvents();
  }, [refetch, fetchEvents]);

  useWatchContractEvent({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, eventName: 'Deposited',         onLogs: liveRefresh });
  useWatchContractEvent({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, eventName: 'AgreementAccepted', onLogs: liveRefresh });
  useWatchContractEvent({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, eventName: 'RequestCreated',    onLogs: liveRefresh });
  useWatchContractEvent({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, eventName: 'RequestApproved',   onLogs: liveRefresh });
  useWatchContractEvent({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, eventName: 'RequestRejected',   onLogs: liveRefresh });
  useWatchContractEvent({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, eventName: 'DisputeRaised',     onLogs: liveRefresh });
  useWatchContractEvent({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, eventName: 'DisputeResolved',   onLogs: liveRefresh });

  // ── Generic tx helper ─────────────────────────────────────────────────────────
  const withTx = useCallback(async (
    key: string,
    fn: () => Promise<`0x${string}`>,
    onSuccess?: () => void,
  ) => {
    if (!publicClient) return;
    setPendingAction(key);
    setTxError(null);
    try {
      const hash = await fn();
      await publicClient.waitForTransactionReceipt({ hash });
      await Promise.all([refetch(), fetchEvents()]);
      onSuccess?.();
    } catch (err: any) {
      setTxError(err.shortMessage ?? err.message ?? 'Transaction failed');
    } finally {
      setPendingAction(null);
    }
  }, [publicClient, refetch, fetchEvents]);

  // ── Action state ──────────────────────────────────────────────────────────────
  const [evidenceUrl, setEvidenceUrl]           = useState('');
  const [activeMilestoneIdx, setActiveMilestoneIdx] = useState<number | null>(null);
  const [showAdHoc, setShowAdHoc]               = useState(false);
  const [adHocAmount, setAdHocAmount]           = useState('');
  const [adHocReason, setAdHocReason]           = useState('');

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleAccept = () =>
    withTx('accept', () =>
      writeContractAsync({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'acceptAgreement' })
    );

  const handleRequestPayout = (idx: number) =>
    withTx(`req-${idx}`, () =>
      writeContractAsync({
        address: address as `0x${string}`, abi: MilestoneVaultAbi.abi,
        functionName: 'requestMilestonePayout', args: [BigInt(idx), evidenceUrl],
      }),
      () => {
        setActiveMilestoneIdx(null);
        setEvidenceUrl('');
        createRequestMeta.mutate({
          address: address!,
          data: { onchainRequestId: requests?.length ?? 0, requestType: 'milestone', milestoneIndex: idx, evidenceUrl },
        });
      }
    );

  const handleAdHocRequest = () =>
    withTx('adhoc', () =>
      writeContractAsync({
        address: address as `0x${string}`, abi: MilestoneVaultAbi.abi,
        functionName: 'requestAdHoc', args: [parseEther(adHocAmount || '0'), adHocReason],
      }),
      () => {
        setShowAdHoc(false);
        setAdHocAmount('');
        setAdHocReason('');
        createRequestMeta.mutate({
          address: address!,
          data: { onchainRequestId: requests?.length ?? 0, requestType: 'adhoc', reason: adHocReason },
        });
      }
    );

  const handleApprove = (id: number) =>
    withTx(`approve-${id}`, () =>
      writeContractAsync({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'approveRequest', args: [BigInt(id)] })
    );

  const handleReject = (id: number) =>
    withTx(`reject-${id}`, () =>
      writeContractAsync({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'rejectRequest', args: [BigInt(id)] })
    );

  const handleDispute = (id: number) =>
    withTx(`dispute-${id}`, () =>
      writeContractAsync({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'raiseDispute', args: [BigInt(id)] })
    );

  const handleResolveDispute = (id: number, release: boolean) =>
    withTx(`resolve-${id}-${release}`, () =>
      writeContractAsync({ address: address as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'resolveDispute', args: [BigInt(id), release] })
    );

  if (!address) return null;

  const isLoading = (key: string) => pendingAction === key;
  const anyPending = pendingAction !== null;

  return (
    <Shell nav={{ back: isInvestor ? '/investor' : isBuilder ? '/builder' : undefined, backLabel: '← Dashboard' }}>
      {/* ── Dispute Banner ── */}
      {vaultStatus === AgreementStatus.Disputed && (
        <div className="w-full border-b flex items-center justify-center gap-2 py-3 px-6 text-sm font-medium"
          style={{ background: 'color-mix(in srgb, #E5484D 8%, transparent)', borderColor: 'color-mix(in srgb, #E5484D 35%, transparent)', color: 'var(--signal-red)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Under arbitration
          {isArbiter && <span className="badge badge-amber ml-2">You are arbiter</span>}
        </div>
      )}

      {/* ── Accept Agreement Banner (builder only, Funded state) ── */}
      {vaultStatus === AgreementStatus.Funded && isBuilder && (
        <div className="w-full border-b flex items-center justify-between px-6 py-4"
          style={{ background: 'color-mix(in srgb, #2FBF9C 8%, transparent)', borderColor: 'color-mix(in srgb, #2FBF9C 30%, transparent)' }}>
          <div>
            <div className="font-medium text-sm" style={{ color: 'var(--signal-green)' }}>Agreement funded — your acceptance required</div>
            <div className="text-xs text-muted-foreground mt-0.5">Review the milestones below, then accept to begin work.</div>
          </div>
          <button onClick={handleAccept} disabled={anyPending} className="btn-green">
            {isLoading('accept') ? 'Confirming…' : '✓ Accept Agreement'}
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-10">

        {/* ── Project header ── */}
        <div className="flex flex-col gap-5">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="font-heading text-3xl font-semibold">{meta?.projectName ?? 'Loading…'}</h1>
              <div className="text-xs font-mono text-muted-foreground mt-1.5 break-all">{address}</div>
              {meta?.description && (
                <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">{meta.description}</p>
              )}
            </div>
            {agreementStatusBadge(vaultStatus)}
          </div>

          {/* Balance grid */}
          <div className="grid grid-cols-3 gap-px" style={{ background: 'hsl(var(--border))' }}>
            {[
              { label: 'Total Funded',   value: totalDeposited,  accent: false },
              { label: 'Released',       value: totalReleased,   accent: true  },
              { label: 'Locked in Vault',value: remainingLocked, accent: false },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-card p-5 flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono">{label}</span>
                <span className={`text-2xl font-mono tabular-nums font-semibold ${accent ? 'text-signal-green' : ''}`}
                  style={label === 'Locked in Vault' ? { color: 'var(--signal-amber)' } : undefined}>
                  {formatMON(value)}
                </span>
              </div>
            ))}
          </div>

          {/* Participants */}
          <div className="flex gap-5 text-xs text-muted-foreground font-mono flex-wrap">
            <span>Investor: <span className={`text-foreground ${isInvestor ? 'text-signal-amber' : ''}`}>{shortenAddress(investor ?? '')}</span></span>
            <span>Builder: <span className={`text-foreground ${isBuilder ? 'text-signal-green' : ''}`}>{builder ? shortenAddress(builder) : '—'}</span></span>
            <span>Arbiter: <span className="text-foreground">{shortenAddress(ARBITER_ADDRESS)}</span></span>
          </div>
        </div>

        {/* ── ACTIVE REQUESTS (shown first — above milestones) ── */}
        {activeRequests.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Pending Requests</h2>
              {activeRequests.some(r => r.status === RequestStatus.Pending) && isInvestor && (
                <span className="badge badge-amber">Action required</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {activeRequests.map(r => {
                const id = Number(r.id);
                const isPending  = r.status === RequestStatus.Pending;
                const isRejected = r.status === RequestStatus.Rejected;
                const isDisputed = r.status === RequestStatus.Disputed;

                return (
                  <div key={id} className="vault-card p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
                    style={isDisputed ? { borderColor: 'color-mix(in srgb, #E5484D 45%, transparent)' } : undefined}>
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {requestStatusBadge(r)}
                        <span className="badge badge-muted">
                          {r.reqType === RequestType.Milestone ? `Milestone #${Number(r.milestoneIndex) + 1}` : 'Ad-hoc'}
                        </span>
                        <span className="font-mono tabular-nums text-lg font-semibold">{formatMON(r.amount)}</span>
                      </div>
                      {r.reason && (
                        <div className="text-xs font-mono break-all text-muted-foreground">
                          {r.reason.startsWith('http') ? (
                            <a href={r.reason} target="_blank" rel="noreferrer"
                              className="hover:text-signal-amber underline underline-offset-2" style={{ color: 'var(--signal-amber)' }}>
                              {r.reason}
                            </a>
                          ) : r.reason}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {/* Investor: approve / reject pending */}
                      {isInvestor && isPending && (
                        <>
                          <button onClick={() => handleApprove(id)} disabled={anyPending} className="btn-green">
                            {isLoading(`approve-${id}`) ? 'Confirming…' : '✓ Approve'}
                          </button>
                          <button onClick={() => handleReject(id)} disabled={anyPending} className="btn-red">
                            {isLoading(`reject-${id}`) ? 'Confirming…' : '✗ Reject'}
                          </button>
                        </>
                      )}
                      {/* Builder: raise dispute on rejected request */}
                      {isBuilder && isRejected && (
                        <button onClick={() => handleDispute(id)} disabled={anyPending} className="btn-primary">
                          {isLoading(`dispute-${id}`) ? 'Confirming…' : 'Raise Dispute'}
                        </button>
                      )}
                      {/* Arbiter: resolve dispute */}
                      {isArbiter && isDisputed && (
                        <>
                          <button onClick={() => handleResolveDispute(id, true)} disabled={anyPending} className="btn-green">
                            {isLoading(`resolve-${id}-true`) ? 'Confirming…' : 'Release to Builder'}
                          </button>
                          <button onClick={() => handleResolveDispute(id, false)} disabled={anyPending} className="btn-red">
                            {isLoading(`resolve-${id}-false`) ? 'Confirming…' : 'Deny'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Milestone Progress ── */}
        {milestones && milestones.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Milestones</h2>

            {/* Segmented bar with fill animation */}
            <div className="w-full h-3 flex rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
              {milestones.map((m, i) => (
                <div
                  key={i}
                  className="h-full relative border-r last:border-r-0"
                  style={{
                    width: `${Number(m.percentage)}%`,
                    borderColor: 'rgba(18,20,26,0.3)',
                  }}
                  title={`${m.description}: ${MILESTONE_STATUS_LABELS[m.status as MilestoneStatus]}`}
                >
                  <div
                    className={m.status === MilestoneStatus.Approved ? 'bar-approved absolute inset-0' : 'absolute inset-0'}
                    style={{ background: milestoneBarColor(m.status) }}
                  />
                </div>
              ))}
            </div>

            {/* Milestone table */}
            <div className="vault-card overflow-hidden">
              <div className="grid grid-cols-[2rem_1fr_3.5rem_9rem_6.5rem_8rem] gap-3 px-5 py-3 border-b border-border"
                style={{ background: 'hsl(var(--muted))' }}>
                <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">#</div>
                <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Description</div>
                <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider text-right">%</div>
                <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider text-right">Amount</div>
                <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider text-center">Status</div>
                <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider text-right">Action</div>
              </div>

              {milestones.map((m, i) => (
                <div key={i} className="border-b border-border last:border-0">
                  <div className="grid grid-cols-[2rem_1fr_3.5rem_9rem_6.5rem_8rem] gap-3 px-5 py-4 items-center text-sm">
                    <div className="font-mono text-muted-foreground text-xs">{i + 1}</div>
                    <div className="text-sm">{m.description}</div>
                    <div className="text-right font-mono tabular-nums text-sm">{Number(m.percentage)}%</div>
                    <div className="text-right font-mono tabular-nums text-sm">
                      {totalDeposited ? formatMON((totalDeposited * m.percentage) / 100n) : '—'}
                    </div>
                    <div className="flex justify-center">
                      {m.status === MilestoneStatus.Approved  && <span className="badge badge-green text-[10px]">Released</span>}
                      {m.status === MilestoneStatus.Requested && <span className="badge badge-amber text-[10px]">Requested</span>}
                      {m.status === MilestoneStatus.Rejected  && <span className="badge badge-red text-[10px]">Rejected</span>}
                      {m.status === MilestoneStatus.Pending   && <span className="badge badge-muted text-[10px]">Pending</span>}
                    </div>
                    <div className="flex justify-end">
                      {isBuilder && vaultStatus === AgreementStatus.Active && m.status === MilestoneStatus.Pending && (
                        <button
                          onClick={() => setActiveMilestoneIdx(activeMilestoneIdx === i ? null : i)}
                          disabled={anyPending}
                          className="text-xs border border-border px-3 py-1.5 hover:border-signal-amber/50 hover:text-signal-amber transition-colors disabled:opacity-40"
                        >
                          Request →
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Evidence form */}
                  {activeMilestoneIdx === i && (
                    <div className="px-5 pb-5 border-t border-border pt-4 flex gap-3 items-end"
                      style={{ background: 'hsl(var(--muted))' }}>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <label className="text-xs text-muted-foreground">Evidence URL (GitHub PR, Notion doc, etc.) — optional</label>
                        <input type="url" placeholder="https://…" className="field-input"
                          value={evidenceUrl}
                          onChange={e => setEvidenceUrl(e.target.value)} />
                      </div>
                      <button onClick={() => handleRequestPayout(i)} disabled={anyPending} className="btn-primary shrink-0">
                        {isLoading(`req-${i}`) ? 'Confirming…' : 'Submit'}
                      </button>
                      <button onClick={() => setActiveMilestoneIdx(null)} className="btn-ghost shrink-0">Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Ad-hoc request */}
            {isBuilder && vaultStatus === AgreementStatus.Active && (
              <div className="flex justify-end">
                <button onClick={() => setShowAdHoc(true)} disabled={anyPending}
                  className="text-xs border border-border px-4 py-2 hover:border-signal-amber/50 hover:text-signal-amber transition-colors disabled:opacity-40">
                  + Request Funds (Ad-hoc)
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Tx error ── */}
        {txError && (
          <div className="border p-4 text-sm font-mono text-signal-red"
            style={{ borderColor: 'color-mix(in srgb, #E5484D 35%, transparent)', background: 'color-mix(in srgb, #E5484D 5%, transparent)' }}>
            Transaction failed: {txError}
          </div>
        )}

        {/* ── Activity Feed ── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">On-Chain Activity</h2>
          <div className="vault-card divide-y divide-border">
            {events.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground text-center">
                {pendingAction ? 'Waiting for transaction…' : 'No on-chain events yet.'}
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {events.map((e, idx) => (
                  <motion.div
                    key={`${e.transactionHash}-${e.logIndex}`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--signal-amber)', opacity: idx === 0 ? 1 : 0.3 }} />
                      <span>{describeEvent(e, investor ?? '', builder ?? '')}</span>
                    </div>
                    <a
                      href={`https://testnet.monadscan.com/tx/${e.transactionHash}`}
                      target="_blank" rel="noreferrer"
                      className="text-xs font-mono text-muted-foreground hover:text-signal-amber transition-colors underline underline-offset-2 whitespace-nowrap"
                    >
                      #{String(e.blockNumber)}
                    </a>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* ── Share link (investor only — to invite builder) ── */}
        {isInvestor && vaultStatus === AgreementStatus.Funded && (
          <section className="vault-card p-5 flex flex-col gap-3"
            style={{ borderColor: 'color-mix(in srgb, #D4A34E 30%, transparent)' }}>
            <div className="text-sm font-medium" style={{ color: 'var(--signal-amber)' }}>
              Share with your builder
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Send this link to your builder. They connect their wallet and click "Accept Agreement" to start.
            </p>
            <div className="flex gap-2 items-center">
              <div className="field-input flex-1 text-xs font-mono text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap cursor-text select-all">
                {typeof window !== 'undefined' ? window.location.href : `/agreement/${address}`}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                className="btn-ghost text-xs shrink-0"
              >
                Copy
              </button>
            </div>
          </section>
        )}
      </div>

      {/* ── Ad-hoc modal ── */}
      {showAdHoc && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-md p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg">Request Funds (Ad-hoc)</h3>
              <button onClick={() => { setShowAdHoc(false); setAdHocAmount(''); setAdHocReason(''); }}
                className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Amount (MON)</label>
              <div className="relative">
                <input type="number" step="0.0001" min="0"
                  className="field-input pr-14"
                  value={adHocAmount} onChange={e => setAdHocAmount(e.target.value)} placeholder="0.0000" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">MON</span>
              </div>
              <div className="text-xs text-muted-foreground font-mono">Available: {formatMON(remainingLocked)}</div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Reason</label>
              <textarea className="field-input min-h-[80px] resize-none"
                value={adHocReason} onChange={e => setAdHocReason(e.target.value)}
                placeholder="Explain why this partial payment is needed…" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAdHoc(false); setAdHocAmount(''); setAdHocReason(''); }} className="btn-ghost">Cancel</button>
              <button onClick={handleAdHocRequest} disabled={!adHocAmount || !adHocReason || anyPending} className="btn-primary">
                {isLoading('adhoc') ? 'Confirming…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
