import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { Link, useLocation } from 'wouter';
import { parseEther, decodeEventLog } from 'viem';
import { FACTORY_ADDRESS } from '@/contracts/config';
import MilestoneVaultFactoryAbi from '@/contracts/MilestoneVaultFactory.json';
import MilestoneVaultAbi from '@/contracts/MilestoneVault.json';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useCreateAgreementMeta } from '@workspace/api-client-react';

interface MilestoneInput {
  description: string;
  percentage: number;
}

export default function CreateAgreement() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [, setLocation] = useLocation();
  const [builderAddress, setBuilderAddress] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { description: 'Initial setup', percentage: 20 },
    { description: 'Final delivery', percentage: 80 }
  ]);

  const { writeContractAsync } = useWriteContract();
  const createMeta = useCreateAgreementMeta();

  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const totalPercentage = milestones.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0);
  
  const addMilestone = () => {
    setMilestones([...milestones, { description: '', percentage: 0 }]);
  };
  
  const updateMilestone = (index: number, field: keyof MilestoneInput, value: string | number) => {
    const newMilestones = [...milestones];
    newMilestones[index] = { ...newMilestones[index], [field]: value };
    setMilestones(newMilestones);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (totalPercentage !== 100) {
      setError('Total milestone percentages must equal 100%');
      return;
    }

    if (!FACTORY_ADDRESS) {
      setError('Contract not yet deployed. VITE_FACTORY_ADDRESS is missing.');
      return;
    }

    try {
      setStatus('Creating agreement on-chain...');
      const descriptions = milestones.map(m => m.description);
      const percentages = milestones.map(m => BigInt(m.percentage));

      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: MilestoneVaultFactoryAbi.abi,
        functionName: 'createAgreement',
        args: [
          builderAddress as `0x${string}`,
          descriptions,
          percentages
        ],
      });

      setStatus('Waiting for creation transaction...');
      const client = publicClient;
      if (!client) throw new Error('Public client not found');
      
      const receipt = await client.waitForTransactionReceipt({ hash });
      
      // Find VaultCreated event
      let vaultAddress: string | undefined;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: MilestoneVaultFactoryAbi.abi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'VaultCreated') {
            vaultAddress = (decoded.args as any).vault;
            break;
          }
        } catch (e) {
          // ignore logs from other contracts
        }
      }

      if (!vaultAddress) {
        throw new Error('Could not find VaultCreated event in transaction logs');
      }

      setStatus('Depositing funds...');
      const depositHash = await writeContractAsync({
        address: vaultAddress as `0x${string}`,
        abi: MilestoneVaultAbi.abi,
        functionName: 'deposit',
        value: parseEther(depositAmount),
      });

      setStatus('Waiting for deposit transaction...');
      await client.waitForTransactionReceipt({ hash: depositHash });

      setStatus('Saving metadata...');
      await createMeta.mutateAsync({
        data: {
          contractAddress: vaultAddress,
          investorAddress: isConnected && address ? address : '',
          builderAddress,
          projectName,
          description,
          chainId: 10143,
          txHash: hash
        }
      });

      setStatus('Done!');
      setLocation(`/agreement/${vaultAddress}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Transaction failed');
      setStatus('');
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center">
      <header className="w-full flex justify-between items-center p-6 border-b border-border">
        <Link href="/" className="text-xl font-medium tracking-tight">MilestoneVault</Link>
        <ConnectButton showBalance={false} />
      </header>

      <main className="w-full max-w-2xl p-6 py-12 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-medium mb-2">Create Agreement</h1>
          <p className="text-muted-foreground text-sm">Lock funds into trustless milestone escrow.</p>
        </div>

        {!FACTORY_ADDRESS && (
          <div className="p-4 border border-signal-amber text-signal-amber bg-signal-amber/10 text-sm">
            Contract not yet deployed. Run the deploy script first.
          </div>
        )}

        {!isConnected ? (
          <div className="p-12 border border-border text-center flex flex-col items-center gap-4">
            <p className="text-muted-foreground">Connect your wallet to create an agreement.</p>
            <ConnectButton />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Builder Address</label>
              <input 
                required
                type="text" 
                placeholder="0x..." 
                className="w-full bg-transparent border border-border p-3 outline-none focus:border-primary font-mono text-sm"
                value={builderAddress}
                onChange={e => setBuilderAddress(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Project Name</label>
              <input 
                required
                type="text" 
                className="w-full bg-transparent border border-border p-3 outline-none focus:border-primary text-sm"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Description</label>
              <textarea 
                required
                className="w-full bg-transparent border border-border p-3 outline-none focus:border-primary text-sm min-h-[100px]"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-4 border-t border-border pt-6">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Milestones</label>
                <div className={`text-xs font-mono ${totalPercentage === 100 ? 'text-signal-green' : 'text-signal-amber'}`}>
                  Total: {totalPercentage}%
                </div>
              </div>
              
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex-1 flex flex-col gap-2">
                    <input 
                      required
                      type="text" 
                      placeholder="Description" 
                      className="w-full bg-transparent border border-border p-3 outline-none focus:border-primary text-sm"
                      value={m.description}
                      onChange={e => updateMilestone(i, 'description', e.target.value)}
                    />
                  </div>
                  <div className="w-24 flex flex-col gap-2">
                    <div className="relative">
                      <input 
                        required
                        type="number" 
                        min="1" max="100"
                        className="w-full bg-transparent border border-border p-3 outline-none focus:border-primary font-mono text-sm pr-8"
                        value={m.percentage}
                        onChange={e => updateMilestone(i, 'percentage', parseInt(e.target.value) || 0)}
                      />
                      <span className="absolute right-3 top-3 text-muted-foreground text-sm font-mono">%</span>
                    </div>
                  </div>
                  {milestones.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeMilestone(i)}
                      className="p-3 border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              
              <button 
                type="button" 
                onClick={addMilestone}
                className="self-start text-sm border border-border px-4 py-2 hover:bg-muted transition-colors"
              >
                + Add Milestone
              </button>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-6">
              <label className="text-sm font-medium">Deposit Amount</label>
              <p className="text-xs text-muted-foreground">Amount will be locked in escrow. Milestones auto-calculate their share.</p>
              <div className="relative max-w-[200px]">
                <input 
                  required
                  type="number" 
                  step="0.0001"
                  className="w-full bg-transparent border border-border p-3 outline-none focus:border-primary font-mono text-sm pr-12"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                />
                <span className="absolute right-3 top-3 text-muted-foreground text-sm font-mono">MON</span>
              </div>
            </div>

            {error && (
              <div className="p-3 border border-signal-red text-signal-red bg-signal-red/10 text-sm">
                {error}
              </div>
            )}

            {status && (
              <div className="p-3 border border-border text-foreground bg-muted text-sm font-mono">
                {status}
              </div>
            )}

            <button 
              type="submit" 
              disabled={!!status || totalPercentage !== 100}
              className="mt-4 w-full p-4 bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Create & Deposit
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
