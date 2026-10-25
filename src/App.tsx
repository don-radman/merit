import { useEffect, useState } from 'react';
import DevBar from '@/components/DevBar.tsx';
import InvestorSubscribe from '@/screens/InvestorSubscribe.tsx';
import IntroducerBook from '@/screens/IntroducerBook.tsx';
import IssuerLedger from '@/screens/IssuerLedger.tsx';
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

  return (
    <>
      {route.screen === 'investor' && <InvestorSubscribe code={route.code} />}
      {route.screen === 'introducer' && <IntroducerBook />}
      {route.screen === 'issuer' && <IssuerLedger />}
      <DevBar route={route} />
    </>
  );
}
