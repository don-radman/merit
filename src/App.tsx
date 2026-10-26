import { useEffect, useState } from 'react';
import DevBar from '@/components/DevBar.tsx';
import Guide from '@/components/Guide.tsx';
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

const guideRequested = (): boolean => new URLSearchParams(currentLocation().search).has('guide');

export default function App() {
  const [route, setRoute] = useState<Route>(routeNow);
  const [guide, setGuide] = useState<boolean>(guideRequested);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const onChange = () => {
      setRoute(routeNow());
      if (guideRequested()) setGuide(true);
    };
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
      {guide && <Guide route={route} index={step} onIndex={setStep} onClose={() => setGuide(false)} />}
      <DevBar route={route} guide={guide} onGuide={() => setGuide((g) => !g)} />
    </ToastProvider>
  );
}
