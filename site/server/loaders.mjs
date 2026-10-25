/**
 * What each page needs from the chain, loaded on the server before render.
 *
 * This is the reason the site is server-rendered. An investor's first paint
 * contains their real balance and their real position, read from testnet
 * during the request — not a spinner, and not a figure the browser fetched
 * afterwards. It also means the browser ships no Stellar SDK and holds no key.
 */
import { CONTRACTS, FUND, RP } from './config.mjs';
import { activity, balances, book, group, introducer, ledger, positionsFor, walletPasskeys } from './chain.mjs';

/** Headline figures, derived from the attribution ledger. */
async function fundStats() {
  const rows = await ledger();
  const earning = rows.filter((r) => r.state !== 'reversed');
  const sum = (list) => list.reduce((total, r) => total + Number(r.subscribed), 0);
  const investors = new Set(earning.map((r) => r.investor));
  const advisers = new Set(earning.map((r) => r.code));
  return {
    subscribed: group(sum(earning).toFixed(2)),
    investors: investors.size,
    advisers: advisers.size,
    introductions: earning.length,
    /**
     * Shown because it is the honest counterpart to the privacy claim: the
     * site can total what investors subscribed, and cannot total what anyone
     * earned on it, because no rate is on chain to multiply by.
     */
    reversed: rows.filter((r) => r.state === 'reversed').length,
  };
}

async function walletState(address) {
  if (!address) return null;
  const [held, acts, passkeys, positions] = await Promise.all([
    balances(address),
    activity(address).catch(() => []),
    walletPasskeys(address),
    positionsFor(address).catch(() => []),
  ]);
  return { address, balances: held, activity: acts, passkeys, positions };
}

/**
 * @param {{name: string, params: Record<string,string>}} route
 * @param {{walletAddress: string|null, code: string|null}} session
 */
export async function loadRoute(route, session) {
  const base = {
    fund: FUND,
    rpId: RP.id,
    contracts: { rails: CONTRACTS.rails, usdc: CONTRACTS.usdc, unit: CONTRACTS.unit },
    session: { walletAddress: session.walletAddress, code: session.code },
  };

  switch (route.name) {
    case 'home':
    case 'how':
      return { ...base, stats: await fundStats() };

    case 'fund':
      return { ...base, stats: await fundStats() };

    case 'introduction': {
      const found = await introducer(route.params.code);
      return { ...base, stats: await fundStats(), introducer: found };
    }

    case 'open': {
      const found = session.code ? await introducer(session.code) : null;
      return { ...base, introducer: found };
    }

    case 'portfolio':
    case 'wallet':
      return { ...base, wallet: await walletState(session.walletAddress) };

    case 'subscribe': {
      const found = session.code ? await introducer(session.code) : null;
      return { ...base, wallet: await walletState(session.walletAddress), introducer: found };
    }

    case 'advisers': {
      const rows = await ledger();
      const codes = [...new Set(rows.map((r) => r.code))];
      const details = await Promise.all(codes.map((code) => introducer(code).catch(() => null)));
      return {
        ...base,
        advisers: details.filter(Boolean).map((d) => ({
          ...d,
          introductions: rows.filter((r) => r.code === d.code && r.state !== 'reversed').length,
        })),
      };
    }

    case 'adviser': {
      const [found, theirBook] = await Promise.all([
        introducer(route.params.code),
        book(route.params.code).catch(() => ({ rows: [], claimableBasis: '0.00' })),
      ]);
      return { ...base, introducer: found, book: theirBook };
    }

    default:
      return base;
  }
}

/** A tiny cookie reader — the site sets two, both of them public values. */
export function readSession(cookieHeader) {
  const jar = {};
  for (const part of String(cookieHeader ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    jar[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return {
    /**
     * The investor's wallet address.
     *
     * This is NOT an authentication token and must never be treated as one.
     * It is a public contract address, and it decides one thing only: which
     * address's balances this page renders. Every action — every movement of
     * money, every change to the wallet's signers — needs a fresh WebAuthn
     * assertion over that specific transaction, which this cookie cannot
     * produce. Forging it shows you somebody else's public balance, which the
     * chain shows anybody who asks.
     */
    walletAddress: jar.calder_wallet ?? null,
    /** Which adviser introduced this visitor, so the flow can credit them. */
    code: jar.calder_code ?? null,
  };
}
