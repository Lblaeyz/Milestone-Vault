import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { monadTestnet } from '@/contracts/config';

export const config = getDefaultConfig({
  appName: 'MilestoneVault',
  projectId: 'milestone-vault-demo',
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(import.meta.env.VITE_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"),
  },
});
