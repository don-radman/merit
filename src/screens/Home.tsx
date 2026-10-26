import { useEffect } from 'react';
import type { MouseEvent, ReactNode } from 'react';
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
 * The page is also the explanation of the layers, for a fund manager, an
 * adviser or a judge: what Merit is, what Merit Connect is, how it sits inside
 * the access portal a manager already has, what it is built on, and why
 * Stellar, now.
 */

function Go({ to, className = 'btn', children }: { to: string; className?: string; children: ReactNode }) {
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
          <div className="eyebrow">Introductions and placement fees for tokenized funds</div>
          <h1>Recognition for the value you bring.</h1>
          <div className="rule" aria-hidden />
          <p className="home__lede">
            Tokenized funds are live. The capital still arrives the old way: through advisers,
            family offices and placement partners, with the fee tracked by hand. {PRODUCT.name}{' '}
            records the introduction the moment a client invests, vests the fee, pays it, and
            keeps each adviser&rsquo;s rate between them and the fund.
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

        {/* ---- where Merit fits -------------------------------------------- */}
        <section aria-labelledby="fit-h">
          <h2 id="fit-h">Two parts. One product.</h2>
          <p className="muted">
            {PRODUCT.name} owns the record and the payout. {PRODUCT.name} Connect is how that
            record meets the portal a fund manager already has.
          </p>
          <div className="split">
            <div className="card split__card">
              <div className="eyebrow">{PRODUCT.name}</div>
              <h3>The record and the payout</h3>
              <p className="muted">
                A ledger of every introduction, an adviser&rsquo;s own book, and a payout run for
                the fund. Who introduced whom and what was invested is on the record. What each
                adviser is paid is not.
              </p>
              <ul className="ticks">
                <li>The introduction is recorded the moment the client invests</li>
                <li>The fee vests, is paid, or is reversed if the client exits early</li>
                <li>The fee lands in the adviser&rsquo;s account, with no invoice</li>
                <li>Totals reconcile for the fund and its auditor</li>
              </ul>
            </div>
            <div className="card card--inverse split__card">
              <div className="eyebrow">{PRODUCT.name} Connect</div>
              <h3>How it fits into your portal</h3>
              <p className="muted">
                A small integration and a hands-on service. We add the introduction link to the
                access portal you already run, or build a simple one with you, with your own
                identity checks and approvals inside it.
              </p>
              <ul className="ticks">
                <li>Your brand, your onboarding, your custody, unchanged</li>
                <li>Identity checks stay with you; {PRODUCT.name} only sees the approval</li>
                <li>One integration covers every fund on your platform</li>
                <li>Advisers get one book across every fund that uses {PRODUCT.name}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---- the portal, with Calder as the sample ------------------------ */}
        <section aria-labelledby="portal-h">
          <h2 id="portal-h">Built into your access portal, not instead of it.</h2>
          <p className="muted">
            Every manager with tokenized funds has, or is building, a portal where qualified
            investors are checked, approved and subscribed. {PRODUCT.name} adds one thing to it: a
            link that attributes the subscription to the adviser who brought it, and pays that
            adviser directly. The investor sees your brand. The adviser sees their book.
          </p>
          <div className="sample">
            <div className="sample__portal">
              <div className="sample__brand">
                <span className="sample__mark" aria-hidden>
                  C
                </span>
                <span className="sample__name">Calder</span>
              </div>
              <div className="sample__eyebrow">Introduced by Raghunathan Family Office</div>
              <div className="sample__title">Calder Short&#8209;Duration Income Fund</div>
              <p className="sample__copy">
                Create your account with Face ID, confirm your details, choose an amount. The
                introduction is noted, not advertised.
              </p>
              <span className="sample__btn" aria-hidden>
                Create account
              </span>
            </div>
            <div className="sample__note">
              <div className="eyebrow">Sample portal</div>
              <h3>Calder is a fictional manager, in its own colours.</h3>
              <p className="muted">
                This is how a {PRODUCT.name} Connect integration looks from the investor&rsquo;s
                side: the manager&rsquo;s identity, the manager&rsquo;s steps, and one line that
                says who made the introduction. A real portal keeps whatever onboarding and
                identity checks it already has. {PRODUCT.name} waits for the approval and records
                the rest.
              </p>
              <div className="actions">
                <Go to="/i/CALDER-PR7?frame=phone" className="btn btn--secondary btn--sm">
                  Open the sample portal
                </Go>
              </div>
            </div>
          </div>
        </section>

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
                Vesting, payable, paid or reversed, each with a date. Paid to your account, no
                chasing, no invoice. Your rate stays private.
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
                One ledger across every adviser. Payable fees settle in a single payout run, and
                the totals reconcile for the auditor without opening any adviser&rsquo;s terms.
              </p>
              <div className="actions">
                <Go to="/issuer" className="btn btn--secondary btn--sm">
                  The fund&rsquo;s ledger
                </Go>
              </div>
            </div>
            <div className="card">
              <span className="card__n">03</span>
              <h3>Investors</h3>
              <p className="muted small">
                A familiar subscription in the fund&rsquo;s own brand. An account secured with Face
                ID or a device PIN. Nothing to install, nothing to remember, nothing to write down.
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

        {/* ---- what it is built on ------------------------------------------ */}
        <section aria-labelledby="stack-h">
          <h2 id="stack-h">What it is built on.</h2>
          <p className="muted">
            {PRODUCT.name} is a thin layer on parts that already exist. Each one does a job the
            others cannot, and none of them is ours to maintain alone.
          </p>
          <ol className="stack" reversed>
            <li className="stack__row stack__row--merit">
              <span className="stack__who">{PRODUCT.name} Connect</span>
              <span className="stack__what">
                <h3>Your portal</h3>
                <p>The link, the approval signal and the adviser code, added to the access portal you run.</p>
              </span>
            </li>
            <li className="stack__row stack__row--merit">
              <span className="stack__who">{PRODUCT.name}</span>
              <span className="stack__what">
                <h3>The book and the ledger</h3>
                <p>The adviser&rsquo;s book and the fund&rsquo;s payout run. One set of words, one set of statuses, across every fund.</p>
              </span>
            </li>
            <li className="stack__row stack__row--merit">
              <span className="stack__who">{PRODUCT.name}</span>
              <span className="stack__what">
                <h3>The attribution contract</h3>
                <p>Records who introduced whom, what was invested, and whether the fee has vested, been paid or been reversed. Holds no rate and no fee.</p>
              </span>
            </li>
            <li className="stack__row">
              <span className="stack__who">OpenZeppelin</span>
              <span className="stack__what">
                <h3>The confidential token</h3>
                <p>
                  New on Stellar this year. A payout whose amount is hidden on the public ledger
                  while the fund and its auditor can still reconcile the total. It is what makes a
                  private fee possible on a public network.
                </p>
              </span>
            </li>
            <li className="stack__row">
              <span className="stack__who">Stellar</span>
              <span className="stack__what">
                <h3>Accounts without seed phrases</h3>
                <p>The network itself verifies a Face ID or fingerprint signature, so an investor or adviser signs with the device they already have.</p>
              </span>
            </li>
            <li className="stack__row">
              <span className="stack__who">Stellar</span>
              <span className="stack__what">
                <h3>The network</h3>
                <p>Final in about five seconds, cents to run, and the controls regulators expect, approval, freeze and clawback, built into the asset itself.</p>
              </span>
            </li>
          </ol>
          <p className="muted small stack__foot">
            The public record holds the introduction and the investment. The rate and the fee are
            never written to it. Stellar&rsquo;s zero-knowledge verification for confidential
            transfers is still in progress, which is one reason this is a testnet demonstration.
          </p>
        </section>

        {/* ---- why now ------------------------------------------------------- */}
        <section aria-labelledby="now-h">
          <h2 id="now-h">Why Stellar, why now.</h2>
          <p className="muted">
            The assets are already here. The way capital reaches them has not changed.
          </p>
          <div className="stats stats--4">
            <div className="stat">
              <div className="stat__label">Tokenized real-world assets on Stellar</div>
              <div className="stat__value">US$4B</div>
              <div className="stat__hint">Franklin Templeton, Spiko, Ondo among them</div>
            </div>
            <div className="stat">
              <div className="stat__label">Tokenized products live</div>
              <div className="stat__value">67</div>
              <div className="stat__hint">money market funds, treasuries, bonds</div>
            </div>
            <div className="stat">
              <div className="stat__label">DTCC tokenization on Stellar</div>
              <div className="stat__value">2027</div>
              <div className="stat__hint">announced for the first half</div>
            </div>
            <div className="stat stat--accent">
              <div className="stat__label">Placement fees tracked</div>
              <div className="stat__value">By hand</div>
              <div className="stat__hint">spreadsheets, invoices, trust</div>
            </div>
          </div>
          <p className="muted small">Figures from stellar.org, October 2026.</p>
          <ul className="under">
            <li>
              <span className="under__icon" aria-hidden>
                <ShieldCheckIcon size={18} />
              </span>
              <div>
                <h3>Recorded on Stellar</h3>
                <p>Each introduction is a public record nobody can deny or quietly edit. The adviser does not have to trust that the manager wrote it down.</p>
              </div>
            </li>
            <li>
              <span className="under__icon" aria-hidden>
                <LockIcon size={18} />
              </span>
              <div>
                <h3>Private where it matters</h3>
                <p>A manager will publish what came in. It will not let one distributor learn another&rsquo;s rate. The confidential token makes that possible on a public network.</p>
              </div>
            </li>
            <li>
              <span className="under__icon" aria-hidden>
                <FingerprintIcon size={18} />
              </span>
              <div>
                <h3>Simple enough for the investor</h3>
                <p>Face ID instead of a seed phrase, the fund&rsquo;s brand instead of ours. Capital moves into a tokenized fund in minutes, from a phone.</p>
              </div>
            </li>
            <li>
              <span className="under__icon" aria-hidden>
                <UndoIcon size={18} />
              </span>
              <div>
                <h3>Rules in the contract, not in a policy</h3>
                <p>A fee pays only after the holding window. An early exit reverses it. The same rule for every adviser, every time.</p>
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
