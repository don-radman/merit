import { useEffect } from 'react';
import type { MouseEvent } from 'react';
import Shell from '@/components/Shell.tsx';
import { FingerprintIcon, LockIcon, MeritMark, ShieldCheckIcon, UndoIcon } from '@/components/icons.tsx';
import { MODE, PRODUCT } from '@/lib/index.ts';
import { hrefFor, navigate } from '@/route.ts';

/**
 * Screen 0 — Merit introduces itself. What a visitor without a link sees.
 *
 * One message per section, in the brand's voice: plain, warm, exact. The
 * claims are the safe working description from the brandbook; the demo
 * boundary (testnet, fictional fund, illustrative data) is stated, not hidden.
 *
 * The page is also the explanation of the layers: Merit owns the record and
 * the payout; the fund keeps its portal, its KYC and its custody; Merit
 * Connect is how the two meet.
 */

function Go({ to, className = 'btn', children }: { to: string; className?: string; children: React.ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a className={className} href={hrefFor(to)} onClick={onClick}>
      {children}
    </a>
  );
}

export default function Home() {
  useEffect(() => {
    document.title = `${PRODUCT.name} · ${PRODUCT.tagline.replace(/\.$/, '')}`;
  }, []);

  return (
    <Shell wide>
      <div className="home">
        {/* ---- hero -------------------------------------------------------- */}
        <div className="home__hero">
          <div className="eyebrow">Attribution and payout infrastructure</div>
          <h1>Recognition for the value you bring.</h1>
          <div className="rule" aria-hidden />
          <p className="home__lede">
            {PRODUCT.name} helps fund managers and advisers track introductions and manage
            placement-fee payouts. The introduction is recorded the moment a client invests. The
            fee vests, pays and reconciles without a single spreadsheet. The rate stays between the
            adviser and the fund.
          </p>
          <div className="home__cta">
            <Go to="/scout">Open an adviser&rsquo;s book</Go>
            <Go to="/issuer" className="btn btn--secondary">
              See the fund&rsquo;s ledger
            </Go>
            <Go to="/i/CALDER-PR7?frame=phone" className="btn btn--ghost">
              Follow an investor link
            </Go>
          </div>
        </div>

        {/* ---- who it is for ------------------------------------------------ */}
        <section aria-labelledby="who-h">
          <h2 id="who-h">Three people, one record.</h2>
          <p className="muted">
            The adviser is the protagonist. The fund manager buys the system. The investor
            experiences the fund they already trust.
          </p>
          <div className="grid-3">
            <div className="card">
              <span className="card__n">01</span>
              <h3>Advisers and family-office partners</h3>
              <p className="muted small">
                A readable book: every introduction, its status, and what it earns at your rate.
                Vesting, payable, paid or reversed, each with a date. Your rate is private.
              </p>
              <div className="actions">
                <Go to="/scout" className="btn btn--secondary btn--sm">
                  Your book
                </Go>
              </div>
            </div>
            <div className="card">
              <span className="card__n">02</span>
              <h3>Fund managers and operations</h3>
              <p className="muted small">
                One attribution ledger across every adviser. Payable fees settle in a single payout
                run, and the totals reconcile for the auditor without opening any adviser&rsquo;s
                terms.
              </p>
              <div className="actions">
                <Go to="/issuer" className="btn btn--secondary btn--sm">
                  Attribution ledger
                </Go>
              </div>
            </div>
            <div className="card">
              <span className="card__n">03</span>
              <h3>Investors</h3>
              <p className="muted small">
                A familiar subscription in the fund&rsquo;s own brand. An account secured with Face
                ID or a device PIN, nothing to remember, nothing to write down. The introduction is
                noted, not advertised.
              </p>
              <div className="actions">
                <Go to="/i/CALDER-PR7?frame=phone" className="btn btn--secondary btn--sm">
                  Investor link
                </Go>
              </div>
            </div>
          </div>
        </section>

        {/* ---- how it works ------------------------------------------------- */}
        <section aria-labelledby="how-h">
          <h2 id="how-h">Credit where it&rsquo;s due, in four steps.</h2>
          <ol className="steps">
            <li>
              <span className="card__n">01</span>
              <h3>Share a link</h3>
              <p>Each adviser has a code and a link. Anyone who invests through it is theirs.</p>
            </li>
            <li>
              <span className="card__n">02</span>
              <h3>The introduction is recorded</h3>
              <p>The moment the client subscribes, a row appears on the book. No form, no email, no chasing.</p>
            </li>
            <li>
              <span className="card__n">03</span>
              <h3>The fee vests</h3>
              <p>Earned at the adviser&rsquo;s rate and held for the fund&rsquo;s window. An early exit reverses it; nothing else can.</p>
            </li>
            <li>
              <span className="card__n">04</span>
              <h3>Payable, then paid</h3>
              <p>The fund runs one payout for everything payable. Each adviser sees their own amount land.</p>
            </li>
          </ol>
        </section>

        {/* ---- Merit Connect ------------------------------------------------ */}
        <section aria-labelledby="connect-h">
          <div className="card card--inverse connect">
            <div className="eyebrow">{PRODUCT.name} Connect</div>
            <h2 id="connect-h">The fund keeps its portal. {PRODUCT.name} plugs in.</h2>
            <p className="muted">
              Every manager and platform has its own front door, its own onboarding and its own
              rules. {PRODUCT.name} does not replace any of it. It records what happens behind the
              subscribe button.
            </p>
            <div className="connect__grid">
              <div>
                <h3>Your portal, your rules</h3>
                <p>
                  Investor identity checks, subscription documents and custody stay where they are,
                  with the regulated party. {PRODUCT.name} never holds identity data; it only needs to
                  know an account was approved.
                </p>
              </div>
              <div>
                <h3>One integration per platform</h3>
                <p>
                  A thin client: resolve a code, attach an introduction to a subscription, read a
                  book, run a payout. Wired in once, it covers every fund on the platform.
                </p>
              </div>
              <div>
                <h3>One book per adviser</h3>
                <p>
                  Advisers work with many funds. Their book shows every introduction in one place,
                  whichever portal it came through, with the same words and the same statuses.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---- what is underneath ------------------------------------------- */}
        <section aria-labelledby="under-h">
          <h2 id="under-h">What is underneath.</h2>
          <p className="muted">
            Plain on the surface, precise underneath. The parts an operations or compliance team
            will ask about.
          </p>
          <ul className="under">
            <li>
              <span className="under__icon" aria-hidden>
                <ShieldCheckIcon size={18} />
              </span>
              <div>
                <h3>Recorded on Stellar</h3>
                <p>
                  Each introduction, its investment and its status are a public record on the Stellar
                  network, final in seconds. The adviser&rsquo;s rate and fee are not part of that record.
                </p>
              </div>
            </li>
            <li>
              <span className="under__icon" aria-hidden>
                <LockIcon size={18} />
              </span>
              <div>
                <h3>Fees settle confidentially</h3>
                <p>
                  Payouts move as confidential transfers built on OpenZeppelin&rsquo;s confidential
                  token for Stellar. Amounts are hidden on the public ledger; the fund and its
                  auditor can still reconcile the total.
                </p>
              </div>
            </li>
            <li>
              <span className="under__icon" aria-hidden>
                <FingerprintIcon size={18} />
              </span>
              <div>
                <h3>Accounts without seed phrases</h3>
                <p>
                  Investors and advisers sign with the Face ID, fingerprint or device PIN they
                  already use. A passkey smart account on Stellar; nothing to install, nothing to
                  lose.
                </p>
              </div>
            </li>
            <li>
              <span className="under__icon" aria-hidden>
                <UndoIcon size={18} />
              </span>
              <div>
                <h3>Vesting and reversal, in the contract</h3>
                <p>
                  A fee pays only after the fund&rsquo;s holding window. If the investor exits inside
                  it, the fund reverses the fee and the book says so. The rule is code, not policy.
                </p>
              </div>
            </li>
          </ul>
        </section>

        {/* ---- foot ---------------------------------------------------------- */}
        <div className="home__foot">
          <span className="brand">
            <MeritMark size={20} />
            <span className="brand__name">{PRODUCT.name}</span>
            <span className="muted">{PRODUCT.tagline}</span>
          </span>
          <span>
            {MODE === 'live' ? 'Stellar testnet' : 'Demonstration'} · Calder is a fictional fund ·
            figures are illustrative · programme design and operations by Co/Unity
          </span>
        </div>
      </div>
    </Shell>
  );
}
