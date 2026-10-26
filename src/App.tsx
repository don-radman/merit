import { useEffect, useState } from 'react';
import DevBar from '@/components/DevBar.tsx';
import PhoneFrame from '@/components/PhoneFrame.tsx';
import { ToastProvider } from '@/components/Toast.tsx';
import Home from '@/screens/Home.tsx';
import InvestorSubscribe from '@/screens/InvestorSubscribe.tsx';
import ScoutDashboard from '@/screens/ScoutDashboard.tsx';
import IssuerConsole from '@/screens/IssuerConsole.tsx';
import { currentLocation, parseRoute } from '@/route.ts';
import type { Route } from '@/route.ts';

const routeNow = (): Route => {
  const { path, search } = currentLocation();
  return parseRoute(path, search);
};

export default function App() {
  const [route, setRoute] = useState<Route>(routeNow);

  useEffect(() => {
    const onChange = () => setRoute(routeNow());
    addEventListener('popstate', onChange);
    addEventListener('hashchange', onChange);
    return () => {
      removeEventListener('popstate', onChange);
      removeEventListener('hashchange', onChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.screen = route.screen;
  }, [route.screen]);

  return (
    <ToastProvider>
      {route.screen === 'home' && <Home />}
      {route.screen === 'investor' &&
        (route.phone ? (
          <PhoneFrame>
            <InvestorSubscribe code={route.code} />
          </PhoneFrame>
        ) : (
          <InvestorSubscribe code={route.code} />
        ))}
      {route.screen === 'scout' && <ScoutDashboard code={route.code} />}
      {route.screen === 'issuer' && <IssuerConsole />}
      <DevBar route={route} />
    </ToastProvider>
  );
}
