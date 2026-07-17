import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Link, useLocation } from 'wouter';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Shell } from '@/lib/shell';
import { AgreementRow } from '@/pages/investor';
import { useListAgreements } from '@workspace/api-client-react';
import { shortenAddress } from '@/lib/format';

export default function BuilderDashboard() {
  const { address, isConnected } = useAccount();
  const [, navigate] = useLocation();
  const [pastedAddr, setPastedAddr] = useState('');
  const [addrError, setAddrError] = useState('');

  const { data: agreements, isLoading } = useListAgreements(
    { builder: address },
    { query: { enabled: !!address } }
  );

  const handleOpenAgreement = () => {
    const trimmed = pastedAddr.trim();
    if (!trimmed.match(/^0x[0-9a-fA-F]{40}$/)) {
      setAddrError('Enter a valid Ethereum address (0x…)');
      return;
    }
    navigate(`/agreement/${trimmed}`);
  };

  if (!isConnected || !address) {
    return (
      <Shell nav={{}}>
        <div className="max-w-2xl mx-auto px-6 py-24 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, #2FBF9C 10%, transparent)', border: '1px solid color-mix(in srgb, #2FBF9C 25%, transparent)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="var(--signal-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 className="font-heading text-2xl mb-2">Builder Dashboard</h1>
            <p className="text-muted-foreground text-sm">Connect your wallet to see agreements where you're listed as builder.</p>
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
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl">Your Agreements</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Projects where you're the builder · <span className="font-mono">{shortenAddress(address)}</span>
            </p>
          </div>
        </div>

        {/* Open by address */}
        <div className="vault-card p-5 mb-6 flex flex-col gap-3">
          <div className="text-sm font-medium">Open agreement by address</div>
          <p className="text-xs text-muted-foreground">
            Did an investor share a vault address or link? Paste it below to view and accept the agreement.
          </p>
          <div className="flex gap-2 flex-col sm:flex-row">
            <input
              type="text"
              className="field-input flex-1 font-mono text-sm"
              placeholder="0x…"
              value={pastedAddr}
              onChange={e => { setPastedAddr(e.target.value); setAddrError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleOpenAgreement()}
            />
            <button onClick={handleOpenAgreement} className="btn-primary shrink-0">
              Open →
            </button>
          </div>
          {addrError && <p className="text-xs text-signal-red">{addrError}</p>}
        </div>

        {/* Agreement list */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map(i => <div key={i} className="vault-card p-5 h-24 animate-pulse" />)}
          </div>
        ) : !agreements || agreements.length === 0 ? (
          <BuilderEmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1">
              {agreements.length} agreement{agreements.length !== 1 ? 's' : ''}
            </div>
            {agreements.map(ag => (
              <AgreementRow key={ag.contractAddress} agreement={ag} role="builder" />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function BuilderEmptyState() {
  return (
    <div className="vault-card p-14 flex flex-col items-center gap-5 text-center">
      <div className="w-20 h-20 flex items-center justify-center"
        style={{ background: 'color-mix(in srgb, #2FBF9C 8%, transparent)', border: '1px solid color-mix(in srgb, #2FBF9C 20%, transparent)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="var(--signal-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <h2 className="font-heading text-xl mb-2">No agreements yet</h2>
        <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
          When a client creates an agreement with your wallet address, it will appear here. You can also open one directly using the address field above.
        </p>
      </div>
    </div>
  );
}
