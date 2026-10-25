import { Shell } from './components.tsx';
import {
  AdviserBook,
  Advisers,
  FundPage,
  Home,
  HowItWorks,
  Introduction,
  NotFound,
} from './pages/public.tsx';
import { Open, Portfolio, Subscribe, Wallet } from './pages/account.tsx';
import type { PageData, Route } from './types.ts';

function page(route: Route, data: PageData) {
  switch (route.name) {
    case 'home':
      return <Home data={data} />;
    case 'fund':
      return <FundPage data={data} />;
    case 'how':
      return <HowItWorks data={data} />;
    case 'introduction':
      return <Introduction data={data} />;
    case 'advisers':
      return <Advisers data={data} />;
    case 'adviser':
      return <AdviserBook data={data} />;
    case 'open':
      return <Open data={data} />;
    case 'portfolio':
      return <Portfolio data={data} />;
    case 'subscribe':
      return <Subscribe data={data} />;
    case 'wallet':
      return <Wallet data={data} />;
    default:
      return <NotFound />;
  }
}

export function App({ route, data }: { route: Route; data: PageData }) {
  return (
    <Shell data={data} path={route.path}>
      {page(route, data)}
    </Shell>
  );
}
