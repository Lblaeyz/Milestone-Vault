import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './lib/wagmi';

import App from './App';

import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={darkTheme({
        accentColor: '#EDEDED',
        accentColorForeground: '#0A0A0B',
        borderRadius: 'none',
      })}>
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
