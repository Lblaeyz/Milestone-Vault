import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import Home from '@/pages/home';
import CreateAgreement from '@/pages/create';
import AgreementDashboard from '@/pages/agreement';
import ArbiterPanel from '@/pages/arbiter';
import BuilderAgreements from '@/pages/agreements';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/create" component={CreateAgreement} />
      <Route path="/agreements" component={BuilderAgreements} />
      <Route path="/agreement/:address" component={AgreementDashboard} />
      <Route path="/arbiter" component={ArbiterPanel} />
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
