/**
 * Every read the site makes from the chain.
 *
 * All of it happens here, on the server, which is the point of rendering this
 * site on the server at all: the investor's browser never loads a Stellar SDK,
 * never holds a key, and never talks to an RPC node. It receives HTML with
 * real balances already in it. The only thing the browser does that the server
 * cannot is touch the secure element.
 */
import {
  Account,
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { Keypair } from '@stellar/stellar-sdk';
import { CONTRACTS, KEYS, NETWORK, STROOPS } from './config.mjs';

export const server = new rpc.Server(NETWORK.rpcUrl, { allowHttp: NETWORK.rpcUrl.startsWith('http://') });

export const relayerKeypair = () => Keypair.fromSecret(KEYS.relayer);

/** A throwaway source for simulation. Nothing is signed or submitted. */
const simulationSource = () => new Account(relayerKeypair().publicKey(), '0');

/**
 * Call a contract method read-only.
 *
 * Simulation is a real execution against real ledger state — it just never
 * commits — so these figures are the chain's, not a cache's.
 */
export async function read(contractId, method, args = []) {
  const tx = new TransactionBuilder(simulationSource(), {
    fee: '100',
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    const err = new Error(sim.error);
    err.contractError = parseContractError(sim.error);
    throw err;
  }
  return sim.result?.retval === undefined ? undefined : scValToNative(sim.result.retval);
}

/** `Error(Contract, #3)` -> 3, so a caller can map it to a sentence. */
export function parseContractError(message) {
  const m = /Error\(Contract, #(\d+)\)/.exec(String(message));
  return m ? Number(m[1]) : null;
}

export const addr = (a) => new Address(a).toScVal();
export const i128 = (v) => nativeToScVal(BigInt(v), { type: 'i128' });
export const str = (s) => nativeToScVal(s, { type: 'string' });
export const bytes = (b) => nativeToScVal(Buffer.from(b), { type: 'bytes' });

/**
 * Stroops to a plain decimal string, without ever touching a float.
 *
 * `Number(raw) / 1e7` is wrong above 2^53 stroops — about 900 million units —
 * and a fund screen is exactly where that bites.
 */
export function toDecimal(raw, places = 2) {
  const v = BigInt(raw ?? 0);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const scale = 10n ** BigInt(places);
  const scaled = (abs * scale + STROOPS / 2n) / STROOPS;
  const whole = scaled / scale;
  const frac = String(scaled % scale).padStart(places, '0');
  return `${neg ? '-' : ''}${whole}${places ? `.${frac}` : ''}`;
}

/** A decimal the user typed, to stroops. */
export function toStroops(decimal) {
  const [whole, frac = ''] = String(decimal).trim().replace(/,/g, '').split('.');
  const padded = (frac + '0000000').slice(0, 7);
  return BigInt(whole || '0') * STROOPS + BigInt(padded || '0');
}

export function group(decimal) {
  const [whole, frac] = String(decimal).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''}`;
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

/**
 * What an address holds.
 *
 * A contract address holds SAC balances exactly as a classic account does,
 * which is why the wallet contract needs no token logic of its own. XLM is
 * read for completeness and is always zero here: the relayer pays the fees, so
 * an investor never needs any.
 */
export async function balances(address) {
  const [usdcRaw, unitRaw] = await Promise.all([
    read(CONTRACTS.usdc, 'balance', [addr(address)]).catch(() => 0n),
    read(CONTRACTS.unit, 'balance', [addr(address)]).catch(() => 0n),
  ]);
  return {
    usdc: toDecimal(usdcRaw),
    usdcRaw: String(usdcRaw ?? 0n),
    units: toDecimal(unitRaw),
    unitsRaw: String(unitRaw ?? 0n),
  };
}

// ---------------------------------------------------------------------------
// Introducer Rails
// ---------------------------------------------------------------------------

export async function introducer(code) {
  try {
    const found = await read(CONTRACTS.rails, 'get_introducer', [str(code)]);
    return { code: found.code, owner: found.owner, displayName: found.display_name };
  } catch (e) {
    // #3 is UnknownCode. Anything else is a real failure worth surfacing.
    if (e.contractError === 3) return null;
    throw e;
  }
}

/** Rows shaped for the screen, with the state each one is actually in. */
function shapeRow(row, now) {
  const vestsAt = Number(row.vests_at);
  const state = row.recovered
    ? 'reversed'
    : row.claimed
      ? 'paid'
      : vestsAt <= now
        ? 'payable'
        : 'vesting';
  return {
    id: Number(row.id),
    code: row.code,
    investor: row.investor,
    subscribed: toDecimal(row.subscribed),
    units: toDecimal(row.units),
    at: new Date(Number(row.at) * 1000).toISOString(),
    vestsAt: new Date(vestsAt * 1000).toISOString(),
    state,
  };
}

export async function book(code) {
  const now = Math.floor(Date.now() / 1000);
  const rows = (await read(CONTRACTS.rails, 'get_book', [str(code)])) ?? [];
  const basis = await read(CONTRACTS.rails, 'claimable_basis', [str(code)]);
  return {
    rows: rows.map((r) => shapeRow(r, now)).sort((a, b) => b.id - a.id),
    /**
     * The subscription total a commission is currently owed on. NOT a payable
     * amount: turning it into money needs the rate, and the rate is not on
     * chain. The site cannot compute the fee and does not pretend to.
     */
    claimableBasis: toDecimal(basis),
  };
}

export async function ledger() {
  const now = Math.floor(Date.now() / 1000);
  const rows = (await read(CONTRACTS.rails, 'get_ledger')) ?? [];
  return rows.map((r) => shapeRow(r, now)).sort((a, b) => b.id - a.id);
}

/** One investor's own introductions — their statement. */
export async function positionsFor(address) {
  return (await ledger()).filter((r) => r.investor === address);
}

// ---------------------------------------------------------------------------
// Wallet state
// ---------------------------------------------------------------------------

export async function walletExists(address) {
  try {
    const count = await read(address, 'signers');
    return Number(count) > 0;
  } catch {
    return false;
  }
}

export async function walletPasskeys(address) {
  try {
    return Number(await read(address, 'signers'));
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

/**
 * Real transaction history, read from contract events rather than a local log.
 *
 * SAC transfers publish `("transfer", from, to, asset)` with the amount as the
 * event's value, so an address's statement is derivable from the chain and
 * nobody has to write one down.
 *
 * Two things about `getEvents` shape this, and both of them produce an empty
 * list rather than an error when you get them wrong:
 *
 *   * It filters by topic, and matching the address in the `from` and `to`
 *     positions asks the node for the right events. Without that, a busy
 *     token's own transfers crowd out the ones being looked for.
 *   * It is a FORWARD scan with a per-request budget, not "the last N
 *     events". Asking it to start a day back and return 100 exhausts the
 *     budget somewhere in the middle of that day and returns what it found
 *     there — which for a recently-opened account is nothing at all. So this
 *     walks backwards a few thousand ledgers at a time, newest window first,
 *     and stops as soon as it has enough.
 */
const EVENT_CHUNK = 5_000;
const EVENT_CHUNKS = 4;

export async function activity(address, limit = 25) {
  const latest = await server.getLatestLedger();
  const transfer = xdr.ScVal.scvSymbol('transfer').toXDR('base64');
  const party = new Address(address).toScVal().toXDR('base64');
  const found = new Map();

  for (let chunk = 0; chunk < EVENT_CHUNKS && found.size < limit; chunk += 1) {
    const startLedger = Math.max(1, latest.sequence - EVENT_CHUNK * (chunk + 1));
    for (const [contractId, asset] of [
      [CONTRACTS.usdc, 'USDC'],
      [CONTRACTS.unit, 'CSDIF'],
    ]) {
      let page;
      try {
        page = await server.getEvents({
          startLedger,
          filters: [
            { type: 'contract', contractIds: [contractId], topics: [[transfer, party, '*', '*']] },
            { type: 'contract', contractIds: [contractId], topics: [[transfer, '*', party, '*']] },
          ],
          limit: 100,
        });
      } catch {
        continue;
      }

      for (const ev of page.events ?? []) {
        if (found.has(ev.id)) continue; // windows overlap by design
        let topics;
        let amount;
        try {
          topics = ev.topic.map((t) => scValToNative(t));
          amount = BigInt(scValToNative(ev.value));
        } catch {
          continue;
        }
        const [, from, to] = topics;
        const incoming = to === address;
        found.set(ev.id, {
          id: ev.id,
          asset,
          kind: incoming ? 'received' : 'sent',
          direction: incoming ? 'in' : 'out',
          amount: toDecimal(amount),
          counterparty: incoming ? from : to,
          ledger: ev.ledger,
          at: ev.ledgerClosedAt,
        });
      }
    }
  }

  return [...found.values()]
    .sort((a, b) => b.ledger - a.ledger || String(b.id).localeCompare(String(a.id)))
    .slice(0, limit);
}
