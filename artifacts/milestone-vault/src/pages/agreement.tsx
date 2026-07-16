import { useState, useEffect } from 'react';
import { useAccount, useReadContracts, useWriteContract, usePublicClient } from 'wagmi';
import { useParams, Link } from 'wouter';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseEther } from 'viem';
import { formatMON, shortenAddress } from '@/lib/format';
import MilestoneVaultAbi from '@/contracts/MilestoneVault.json';
import { 
  AgreementStatus, MilestoneStatus, RequestType, RequestStatus,
  AGREEMENT_STATUS_LABELS, MILESTONE_STATUS_LABELS, REQUEST_STATUS_LABELS,
  ARBITER_ADDRESS
} from '@/contracts/config';
import { useGetAgreement, useCreateRequestMeta, getGetAgreementQueryKey } from '@workspace/api-client-react';

export default function AgreementDashboard() {
  const { address } = useParams<{ address: string }>();
  const { address: userAddress } = useAccount();
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [activeRequestMilestone, setActiveRequestMilestone] = useState<number | null>(null);

  const { data: meta } = useGetAgreement(address || '', {
    query: { enabled: !!address, retry: false, queryKey: getGetAgreementQueryKey(address || '') }
  });

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

  const { writeContractAsync } = useWriteContract();
  const createRequestMeta = useCreateRequestMeta();

  const totalDeposited = contractData?.[0]?.result as bigint | undefined;
  const totalReleased = contractData?.[1]?.result as bigint | undefined;
  const remainingLocked = contractData?.[2]?.result as bigint | undefined;
  const status = contractData?.[3]?.result as AgreementStatus | undefined;
  const investor = contractData?.[4]?.result as string | undefined;
  const builder = contractData?.[5]?.result as string | undefined;
  const milestones = contractData?.[6]?.result as any[] | undefined;
  const requests = contractData?.[7]?.result as any[] | undefined;

  const isBuilder = userAddress?.toLowerCase() === builder?.toLowerCase();
  const isInvestor = userAddress?.toLowerCase() === investor?.toLowerCase();
  const isArbiter = userAddress?.toLowerCase() === ARBITER_ADDRESS.toLowerCase();

  const handleRequestPayout = async (milestoneIndex: number) => {
    try {
      await writeContractAsync({
        address: address as `0x${string}`,
        abi: MilestoneVaultAbi.abi,
        functionName: 'requestMilestonePayout',
        args: [BigInt(milestoneIndex), evidenceUrl]
      });
      setActiveRequestMilestone(null);
      setEvidenceUrl('');
      // In a real app we wait for receipt and update api, but we just refetch here
      setTimeout(refetch, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      await writeContractAsync({
        address: address as `0x${string}`,
        abi: MilestoneVaultAbi.abi,
        functionName: 'approveRequest',
        args: [BigInt(requestId)]
      });
      setTimeout(refetch, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      await writeContractAsync({
        address: address as `0x${string}`,
        abi: MilestoneVaultAbi.abi,
        functionName: 'rejectRequest',
        args: [BigInt(requestId)]
      });
      setTimeout(refetch, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDispute = async (requestId: number) => {
    try {
      await writeContractAsync({
        address: address as `0x${string}`,
        abi: MilestoneVaultAbi.abi,
        functionName: 'raiseDispute',
        args: [BigInt(requestId)]
      });
      setTimeout(refetch, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (s: AgreementStatus | undefined) => {
    if (s === AgreementStatus.Active || s === AgreementStatus.Completed) return 'var(--signal-green)';
    if (s === AgreementStatus.Funded || s === AgreementStatus.Created) return 'var(--signal-amber)';
    if (s === AgreementStatus.Disputed) return 'var(--signal-red)';
    return 'var(--border)';
  };

  const getMilestoneColor = (s: MilestoneStatus) => {
    if (s === MilestoneStatus.Approved) return 'var(--signal-green)';
    if (s === MilestoneStatus.Requested) return 'var(--signal-amber)';
    if (s === MilestoneStatus.Rejected) return 'var(--signal-red)';
    return 'var(--border)';
  };

  if (!address) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center">
      <header className="w-full flex justify-between items-center p-6 border-b border-border">
        <Link href="/" className="text-xl font-medium tracking-tight">MilestoneVault</Link>
        <ConnectButton showBalance={false} />
      </header>

      {status === AgreementStatus.Disputed && (
        <div className="w-full bg-[#F5A524]/10 border-b border-signal-amber text-signal-amber p-4 flex items-center justify-center gap-2 font-medium text-sm">
          <span>⚠</span> Under arbitration by MilestoneVault team
        </div>
      )}

      <main className="w-full max-w-4xl p-6 py-12 flex flex-col gap-12">
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-medium mb-1">{meta?.projectName || 'Unnamed Project'}</h1>
              <div className="text-sm font-mono text-muted-foreground">{shortenAddress(address)}</div>
            </div>
            <div className="flex items-center gap-2 border border-border px-3 py-1.5 text-sm">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(status) }} />
              {status !== undefined ? AGREEMENT_STATUS_LABELS[status] : 'Loading...'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-px bg-border border border-border">
            <div className="bg-background p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Funded</span>
              <span className="text-lg font-mono">{formatMON(totalDeposited)}</span>
            </div>
            <div className="bg-background p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Released</span>
              <span className="text-lg font-mono text-signal-green">{formatMON(totalReleased)}</span>
            </div>
            <div className="bg-background p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Locked</span>
              <span className="text-lg font-mono">{formatMON(remainingLocked)}</span>
            </div>
          </div>
        </div>

        {milestones && milestones.length > 0 && (
          <div className="flex flex-col gap-6">
            <h2 className="text-lg font-medium">Milestone Progress</h2>
            
            <div className="w-full h-2 flex rounded-full overflow-hidden bg-border">
              {milestones.map((m, i) => (
                <div 
                  key={i} 
                  style={{ 
                    width: `${m.percentage.toString()}%`,
                    backgroundColor: getMilestoneColor(m.status)
                  }}
                  className="h-full border-r border-background last:border-0"
                />
              ))}
            </div>

            <div className="flex flex-col border border-border">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 p-4 border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                <div className="w-8">#</div>
                <div>Description</div>
                <div className="w-16 text-right">%</div>
                <div className="w-32 text-right">Amount</div>
                <div className="w-24 text-center">Status</div>
                <div className="w-32 text-right">Action</div>
              </div>
              
              {milestones.map((m, i) => (
                <div key={i} className="flex flex-col border-b border-border last:border-0">
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 p-4 items-center text-sm">
                    <div className="w-8 font-mono text-muted-foreground">{i + 1}</div>
                    <div>{m.description}</div>
                    <div className="w-16 text-right font-mono">{m.percentage.toString()}%</div>
                    <div className="w-32 text-right font-mono">
                      {totalDeposited ? formatMON((totalDeposited * m.percentage) / 100n) : '—'}
                    </div>
                    <div className="w-24 flex justify-center">
                      <span className="text-xs border border-border px-2 py-1" style={{ color: getMilestoneColor(m.status) }}>
                        {MILESTONE_STATUS_LABELS[m.status as MilestoneStatus]}
                      </span>
                    </div>
                    <div className="w-32 flex justify-end">
                      {isBuilder && status === AgreementStatus.Active && m.status === MilestoneStatus.Pending && (
                        <button 
                          onClick={() => setActiveRequestMilestone(activeRequestMilestone === i ? null : i)}
                          className="text-xs border border-border px-3 py-1.5 hover:bg-muted transition-colors"
                        >
                          Request
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {activeRequestMilestone === i && (
                    <div className="p-4 bg-muted/10 border-t border-border flex gap-4 items-end">
                      <div className="flex-1 flex flex-col gap-2">
                        <label className="text-xs text-muted-foreground">Evidence URL (Optional)</label>
                        <input 
                          type="text" 
                          placeholder="https://github.com/..." 
                          className="w-full bg-transparent border border-border p-2 outline-none focus:border-primary text-sm font-mono"
                          value={evidenceUrl}
                          onChange={e => setEvidenceUrl(e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={() => handleRequestPayout(i)}
                        className="bg-primary text-primary-foreground px-6 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        Submit Request
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {requests && requests.length > 0 && (isInvestor || isBuilder) && (
          <div className="flex flex-col gap-4 border-t border-border pt-12">
            <h2 className="text-lg font-medium">Pending Requests</h2>
            <div className="flex flex-col gap-4">
              {requests.map((r, i) => {
                if (r.status === RequestStatus.Pending) {
                  return (
                    <div key={i} className="border border-border p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs border border-border px-2 py-0.5 text-muted-foreground">
                            {r.reqType === RequestType.Milestone ? `Milestone #${r.milestoneIndex + 1n}` : 'Ad-hoc'}
                          </span>
                          <span className="font-mono text-lg">{formatMON(r.amount)}</span>
                        </div>
                        {r.reason && <div className="text-sm text-muted-foreground font-mono">{r.reason}</div>}
                      </div>
                      
                      {isInvestor && (
                        <div className="flex gap-2 w-full md:w-auto">
                          <button 
                            onClick={() => handleApprove(Number(r.id))}
                            className="flex-1 md:flex-none px-4 py-2 bg-signal-green text-black text-sm font-medium hover:opacity-90"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleReject(Number(r.id))}
                            className="flex-1 md:flex-none px-4 py-2 border border-signal-red text-signal-red text-sm font-medium hover:bg-signal-red/10"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }
                
                if (r.status === RequestStatus.Rejected && isBuilder) {
                  return (
                    <div key={i} className="border border-signal-red/30 bg-signal-red/5 p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs border border-signal-red text-signal-red px-2 py-0.5">Rejected</span>
                          <span className="text-xs border border-border px-2 py-0.5 text-muted-foreground">
                            {r.reqType === RequestType.Milestone ? `Milestone #${r.milestoneIndex + 1n}` : 'Ad-hoc'}
                          </span>
                          <span className="font-mono text-lg">{formatMON(r.amount)}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">This request was rejected by the investor.</div>
                      </div>
                      
                      <button 
                        onClick={() => handleDispute(Number(r.id))}
                        className="w-full md:w-auto px-4 py-2 bg-signal-amber text-black text-sm font-medium hover:opacity-90"
                      >
                        Raise Dispute
                      </button>
                    </div>
                  );
                }
                
                return null;
              })}
              
              {requests.every(r => r.status !== RequestStatus.Pending && !(r.status === RequestStatus.Rejected && isBuilder)) && (
                <div className="text-sm text-muted-foreground border border-border p-4 text-center">
                  No actionable requests.
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
