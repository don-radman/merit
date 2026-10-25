import { useEffect, useState } from 'react';
import DevBar from '@/components/DevBar.tsx';
import PhoneFrame from '@/components/PhoneFrame.tsx';
import { ToastProvider } from '@/components/Toast.tsx';
import InvestorSubscribe from '@/screens/InvestorSubscribe.tsx';
import ScoutDashboard from '@/screens/ScoutDashboard.tsx';
import IssuerConsole from '@/screens/IssuerConsole.tsx';
import { parseRoute } from '@/route.ts';
import type { Route } from '@/route.ts';

export default function App() {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(location.pathname, location.search),
  );

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(location.pathname, location.search));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.screen = route.screen;
  }, [route.screen]);

  return (
    <ToastProvider>
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
