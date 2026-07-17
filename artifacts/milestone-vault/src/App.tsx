import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useAccount } from 'wagmi';
import { ARBITER_ADDRESS } from '@/contracts/config';
import Home from '@/pages/home';
import CreateAgreement from '@/pages/create';
import AgreementDashboard from '@/pages/agreement';
import ArbiterPanel from '@/pages/arbiter';
import InvestorDashboard from '@/pages/investor';
import BuilderDashboard from '@/pages/builder';
import NotFound from '@/pages/not-found';

// ── Route guard: only arbiter wallet can access /arbiter ──────────────────────
function ArbiterRoute() {
  const { address, isConnected } = useAccount();
  const [, navigate] = useLocation();

  const isArbiter = !!address && address.toLowerCase() === ARBITER_ADDRESS.toLowerCase();

  useEffect(() => {
    // Redirect if a wallet IS connected but it's not the arbiter wallet
    if (isConnected && !isArbiter) {
      navigate('/');
    }
  }, [isConnected, isArbiter, navigate]);

  // Render nothing while redirecting — ArbiterPanel handles the "no wallet" state
  if (isConnected && !isArbiter) return null;

  return <ArbiterPanel />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/investor" component={InvestorDashboard} />
      <Route path="/builder" component={BuilderDashboard} />
      <Route path="/create" component={CreateAgreement} />
      <Route path="/agreement/:address" component={AgreementDashboard} />
      <Route path="/arbiter" component={ArbiterRoute} />
      {/* Legacy redirect */}
      <Route path="/agreements" component={BuilderDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
