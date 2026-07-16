import { useState } from 'react';
import { useAccount, useReadContracts, useWriteContract } from 'wagmi';
import { Link } from 'wouter';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useListDisputedAgreements, getListDisputedAgreementsQueryKey } from '@workspace/api-client-react';
import MilestoneVaultAbi from '@/contracts/MilestoneVault.json';
import { formatMON, shortenAddress } from '@/lib/format';
import { ARBITER_ADDRESS, RequestStatus } from '@/contracts/config';

export default function ArbiterPanel() {
  const { address } = useAccount();
  const isArbiter = address?.toLowerCase() === ARBITER_ADDRESS.toLowerCase();

  const { data: disputedAgreements } = useListDisputedAgreements({
    query: { enabled: isArbiter, queryKey: getListDisputedAgreementsQueryKey() }
  });

  if (!isArbiter) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center">
        <header className="w-full flex justify-between items-center p-6 border-b border-border">
          <Link href="/" className="text-xl font-medium tracking-tight">MilestoneVault</Link>
          <ConnectButton showBalance={false} />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="p-8 border border-border text-center max-w-md">
            <h2 className="text-lg font-medium mb-2 text-signal-red">Access Restricted</h2>
            <p className="text-muted-foreground text-sm">
              This panel is restricted to the MilestoneVault arbiter address.
              Connect with the designated arbiter wallet to view disputes.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center">
      <header className="w-full flex justify-between items-center p-6 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-medium tracking-tight">MilestoneVault</Link>
          <span className="text-xs border border-signal-amber text-signal-amber px-2 py-0.5 uppercase tracking-wider bg-signal-amber/10">Arbiter Panel</span>
        </div>
        <ConnectButton showBalance={false} />
      </header>

      <main className="w-full max-w-5xl p-6 py-12 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-medium mb-2">Active Disputes</h1>
          <p className="text-muted-foreground text-sm">Review rejected requests escalated to arbitration.</p>
        </div>

        <div className="flex flex-col gap-4">
          {(!disputedAgreements || disputedAgreements.length === 0) ? (
            <div className="p-12 border border-border text-center text-muted-foreground">
              No active disputes requiring arbitration.
            </div>
          ) : (
            disputedAgreements.map(agreement => (
              <DisputedAgreementCard key={agreement.contractAddress} agreement={agreement} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function DisputedAgreementCard({ agreement }: { agreement: any }) {
  const { data: requests, refetch } = useReadContracts({
    contracts: [
      { address: agreement.contractAddress as `0x${string}`, abi: MilestoneVaultAbi.abi, functionName: 'getRequests' },
    ]
  });

  const { writeContractAsync } = useWriteContract();
  const reqs = requests?.[0]?.result as any[] | undefined;

  const handleResolve = async (requestId: number, releaseToBuilder: boolean) => {
    try {
      await writeContractAsync({
        address: agreement.contractAddress as `0x${string}`,
        abi: MilestoneVaultAbi.abi,
        functionName: 'resolveDispute',
        args: [BigInt(requestId), releaseToBuilder]
      });
      setTimeout(refetch, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const disputedReqs = reqs?.filter(r => r.status === RequestStatus.Disputed) || [];

  if (disputedReqs.length === 0) return null;

  return (
    <div className="border border-border flex flex-col bg-background">
      <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
        <div>
          <h3 className="font-medium">{agreement.projectName}</h3>
          <div className="text-sm font-mono text-muted-foreground mt-1">
            <Link href={`/agreement/${agreement.contractAddress}`} className="hover:underline hover:text-foreground">
              {shortenAddress(agreement.contractAddress)}
            </Link>
          </div>
        </div>
        <div className="text-sm font-mono text-muted-foreground">
          Builder: {shortenAddress(agreement.builderAddress)}
        </div>
      </div>
      
      <div className="flex flex-col">
        {disputedReqs.map(r => (
          <div key={Number(r.id)} className="p-4 border-b border-border last:border-0 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs border border-signal-red px-2 py-0.5 text-signal-red bg-signal-red/10">Disputed Request</span>
                <span className="font-mono text-lg">{formatMON(r.amount)}</span>
              </div>
              {r.reason && (
                <div className="text-sm text-muted-foreground">
                  Evidence/Reason: <a href={r.reason} target="_blank" rel="noreferrer" className="text-foreground hover:underline">{r.reason}</a>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={() => handleResolve(Number(r.id), true)}
                className="flex-1 md:flex-none px-4 py-2 bg-signal-green text-black text-sm font-medium hover:opacity-90"
              >
                Release to Builder
              </button>
              <button 
                onClick={() => handleResolve(Number(r.id), false)}
                className="flex-1 md:flex-none px-4 py-2 bg-signal-red text-black text-sm font-medium hover:opacity-90"
              >
                Deny (Return to Vault)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
