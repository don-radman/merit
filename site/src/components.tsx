/**
 * Shared furniture.
 *
 * Deliberately few components, each doing one thing: this is a content site
 * with four interactive screens, not an application that happens to have
 * pages. The one piece with real behaviour is the authorization sheet, which
 * is where the whole product becomes visible — it is the screen that tells an
 * investor what their fingerprint is about to approve.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Activity, Fund, PageData, RowState } from './types.ts';
import { NAV } from './routes.mjs';
import {
  authorize,
  forgetDevice,
  signOut,
  storedDevice,
  type AuthorizeSummary,
} from './wallet/passkey.ts';

export function navigate(href: string): void {
  if (typeof history === 'undefined') return;
  history.pushState(null, '', href);
  dispatchEvent(new PopStateEvent('popstate'));
}

/** Internal links navigate without a round trip; everything else is a link. */
export function Link({
  href,
  children,
  ...rest
}: { href: string; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="wordmark" aria-label="Calder Asset Management, home">
      <span className="wordmark__mark">Calder</span>
      <span className="wordmark__rule" aria-hidden="true" />
      <span className="wordmark__sub">Asset Management</span>
    </Link>
  );
}

/**
 * The honesty banner.
 *
 * Calder does not exist, the fund does not exist, and the money is testnet
 * money. A site that looks this much like a regulated manager's has to say
 * so where nobody can miss it, not in a footnote.
 */
function Banner() {
  return (
    <div className="banner">
      <div className="page banner__inner">
        <strong>Demonstration.</strong>
        <span>
          Calder is a fictional manager and these are fictional funds. Everything on screen is
          real activity on the Stellar test network, settled with worthless test assets.
        </span>
      </div>
    </div>
  );
}

export function Shell({
  children,
  data,
  path,
}: {
  children: ReactNode;
  data: PageData;
  path: string;
}) {
  const signedIn = Boolean(data.session.walletAddress);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Banner />
      <header className="masthead">
        <div className="page masthead__inner">
          <Wordmark />
          <nav className="masthead__nav" aria-label="Primary">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="masthead__hide"
                aria-current={path === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
            {signedIn ? (
              <>
                <Link href="/portfolio" aria-current={path === '/portfolio' ? 'page' : undefined}>
                  Portfolio
                </Link>
                <Link href="/wallet" aria-current={path === '/wallet' ? 'page' : undefined}>
                  Wallet
                </Link>
              </>
            ) : (
              <Link href="/open" className="button">
                Open an account
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <Colophon fund={data.fund} signedIn={signedIn} />
    </>
  );
}

function Colophon({ fund, signedIn }: { fund: Fund; signedIn: boolean }) {
  return (
    <footer className="colophon">
      <div className="page">
        <div className="grid grid--3">
          <div>
            <h4>The fund</h4>
            <ul className="colophon__links">
              <li>
                <Link href="/fund">Strategy and terms</Link>
              </li>
              <li>
                <Link href="/how-it-works">How introductions work</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Advisers</h4>
            <ul className="colophon__links">
              <li>
                <Link href="/advisers">Introducer register</Link>
              </li>
              <li>
                <Link href="/how-it-works">Commission and vesting</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Your account</h4>
            <ul className="colophon__links">
              {signedIn ? (
                <>
                  <li>
                    <Link href="/portfolio">Portfolio</Link>
                  </li>
                  <li>
                    <Link href="/wallet">Wallet and devices</Link>
                  </li>
                  <li>
                    <SignOutLink />
                  </li>
                </>
              ) : (
                <li>
                  <Link href="/open">Open an account</Link>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="colophon__legal">
          <p>
            {fund.manager} is a fictional entity created to demonstrate confidential onchain
            attribution. Nothing here is an offer, a solicitation, or investment advice, and no
            regulator has authorised anything on this site. The licence number {fund.licence} and
            the ISIN {fund.isin} are invented.
          </p>
          <p style={{ margin: 0 }}>
            Balances and positions are read live from the Stellar test network. Test assets have no
            value and the network is periodically reset.
          </p>
        </div>
      </div>
    </footer>
  );
}

function SignOutLink() {
  return (
    <button
      type="button"
      className="button--link"
      style={{ font: 'inherit', color: '#d3e3dd' }}
      onClick={async () => {
        await signOut().catch(() => undefined);
        forgetDevice();
        location.href = '/';
      }}
    >
      Sign out
    </button>
  );
}

// ---------------------------------------------------------------------------

export function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="figure">
      <div className="figure__label">{label}</div>
      <div className="figure__value">{value}</div>
      {note ? <div className="figure__note">{note}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  aside,
  children,
  variant,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  variant?: 'sunk' | 'quiet';
}) {
  return (
    <section className={`panel${variant ? ` panel--${variant}` : ''}`}>
      {title ? (
        <div className="panel__head">
          <h3>{title}</h3>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const STATE_COPY: Record<RowState, string> = {
  vesting: 'Vesting',
  payable: 'Payable',
  paid: 'Settled',
  reversed: 'Reversed',
};

export function StatePill({ state }: { state: RowState }) {
  return <span className={`pill pill--${state}`}>{STATE_COPY[state]}</span>;
}

export function Address({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="address-row">
      <span className="mono" title={value}>
        {value.slice(0, 8)}…{value.slice(-6)}
      </span>
      <button
        type="button"
        className="button--link"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : `Copy${label ? ` ${label}` : ''}`}
      </button>
    </span>
  );
}

export function money(amount: string): string {
  const [whole, frac = '00'] = String(amount).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}

export function when(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function whenExact(iso: string): string {
  return new Date(iso).toLocaleString('en-SG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function explorerTx(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function explorerContract(id: string): string {
  return `https://stellar.expert/explorer/testnet/contract/${id}`;
}

// ---------------------------------------------------------------------------
// The authorization sheet
// ---------------------------------------------------------------------------

type Phase = 'idle' | 'preparing' | 'waiting' | 'submitting' | 'done' | 'error';

export interface Authorization {
  phase: Phase;
  summary: AuthorizeSummary | null;
  hash: string | null;
  error: string | null;
  run: (intent: unknown) => Promise<boolean>;
  reset: () => void;
}

/**
 * Drives one authorization and reports which stage it is at.
 *
 * The stages are worth naming on screen because they take visibly different
 * amounts of time and fail for different reasons: simulating the call is a
 * network round trip, the fingerprint is however long the person takes, and
 * submitting waits for a ledger to close.
 */
export function useAuthorization(rpId: string): Authorization {
  const [phase, setPhase] = useState<Phase>('idle');
  const [summary, setSummary] = useState<AuthorizeSummary | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (intent: unknown) => {
      setPhase('preparing');
      setError(null);
      setHash(null);
      setSummary(null);
      try {
        const device = storedDevice();
        const result = await authorize(intent, rpId, {
          credentialId: device?.credentialId,
          onSummary: (next) => {
            setSummary(next);
            setPhase('waiting');
          },
        });
        setPhase('submitting');
        setHash(result.hash);
        setPhase('done');
        return true;
      } catch (thrown) {
        setError(readableError(thrown));
        setPhase('error');
        return false;
      }
    },
    [rpId],
  );

  const reset = useCallback(() => {
    setPhase('idle');
    setSummary(null);
    setHash(null);
    setError(null);
  }, []);

  return { phase, summary, hash, error, run, reset };
}

/** Soroban speaks in error codes. Turn the ones we cause into sentences. */
export function readableError(thrown: unknown): string {
  const raw = String((thrown as { message?: string })?.message ?? thrown);
  const contract = /Error\(Contract, #(\d+)\)/.exec(raw);
  if (contract) {
    switch (Number(contract[1])) {
      case 3:
        return 'That adviser code is not registered.';
      case 5:
        return 'That is below the fund’s minimum subscription.';
      case 6:
        return 'There is nothing to collect yet.';
      case 7:
        return 'That commission has not finished vesting.';
      default:
        break;
    }
  }
  if (raw.includes('Error(Auth, InvalidAction)')) {
    return 'That passkey is not registered on this wallet.';
  }
  if (/insufficient balance|#10\b/.test(raw)) {
    return 'There is not enough in the account for that.';
  }
  return raw.replace(/^HostError:\s*/, '').split('\n')[0];
}

export function AuthorizeSheet({
  auth,
  onClose,
  doneLabel = 'Done',
}: {
  auth: Authorization;
  onClose: () => void;
  doneLabel?: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (auth.phase === 'done' || auth.phase === 'error')) onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [auth.phase, onClose]);

  if (auth.phase === 'idle') return null;
  const busy = auth.phase === 'preparing' || auth.phase === 'waiting' || auth.phase === 'submitting';

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Approve">
      <div className="sheet">
        <h2 className="sheet__title">{auth.summary?.title ?? 'Preparing…'}</h2>

        {auth.summary ? (
          <dl className="sheet__lines">
            {auth.summary.lines.map(([term, value]) => (
              <div className="sheet__line" key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="sheet__status">
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          <span>
            {auth.phase === 'preparing' && 'Building the transaction…'}
            {auth.phase === 'waiting' && 'Confirm with Touch ID, Face ID or your device PIN.'}
            {auth.phase === 'submitting' && 'Submitting to the network…'}
            {auth.phase === 'done' && 'Settled on the network.'}
            {auth.phase === 'error' && auth.error}
          </span>
        </div>

        {auth.summary?.caution && busy ? (
          <p className="fine" style={{ marginTop: '0.75rem' }}>
            {auth.summary.caution}
          </p>
        ) : null}

        {auth.phase === 'done' && auth.hash ? (
          <p className="fine" style={{ marginTop: '0.75rem' }}>
            <a href={explorerTx(auth.hash)} target="_blank" rel="noreferrer">
              View the transaction
            </a>
          </p>
        ) : null}

        {!busy ? (
          <div className="actions" style={{ marginTop: '1.25rem' }}>
            <button type="button" className="button" onClick={onClose}>
              {auth.phase === 'done' ? doneLabel : 'Close'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityList({ items }: { items: Activity[] }) {
  if (!items.length) {
    return <p className="fine">No movements in the last day of ledgers.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Movement</th>
          <th>Counterparty</th>
          <th className="num">Amount</th>
          <th className="num">When</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>
              {item.kind === 'issued' ? 'Issued' : item.kind === 'received' ? 'Received' : 'Sent'}{' '}
              {item.asset}
            </td>
            <td>
              {item.counterparty ? (
                <span className="mono">
                  {item.counterparty.slice(0, 6)}…{item.counterparty.slice(-4)}
                </span>
              ) : (
                <span className="fine">the issuer</span>
              )}
            </td>
            <td className="num">
              {item.direction === 'in' ? '+' : '−'}
              {money(item.amount)}
            </td>
            <td className="num fine">{whenExact(item.at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
