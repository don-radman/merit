import { useEffect, useState } from 'react';
import { ExternalLinkIcon, MeritMark } from '@/components/icons.tsx';
import { MODE, PRODUCT, stubAdvanceVesting } from '@/lib/index.ts';
import { CONTRACTS, TX, explorerContract, explorerTx } from '@/lib/onchain.ts';
import { navigate } from '@/route.ts';
import type { Route } from '@/route.ts';

/**
 * The guided demo: the whole introduction layer, one beat at a time, with the
 * words to say, the thing to click, and the real transaction on the Stellar
 * testnet that each beat corresponds to.
 *
 * The panel drives the stub (it navigates and can advance vesting); the
 * presenter presses the on-screen buttons themselves, so what the audience
 * sees is the product, not a script. Open it from the demo bar, from the
 * front page, or with the `guide` hash token.
 */

interface Link {
  label: string;
  href: string;
}

interface Step {
  id: string;
  title: string;
  /** Where this beat happens. */
  where: string;
  whereLabel: string;
  screen: Route['screen'];
  code?: string;
  /** Talking points, in the brand's voice. Short. */
  say: string[];
  /** What to click, for the presenter. */
  action: string;
  /** A stub lever the panel can pull for the presenter. */
  lever?: 'vest';
  /** The counterpart on the testnet deployment. */
  links?: Link[];
}

const tx = (label: string, hash: string | undefined, fallback: string): Link =>
  hash ? { label, href: explorerTx(hash) } : { label: `${label} (contract)`, href: explorerContract(fallback) };

const P = PRODUCT.name;

export const STEPS: Step[] = [
  {
    id: 'start',
    title: `${P}, in one breath`,
    where: '/',
    whereLabel: 'the front page',
    screen: 'home',
    say: [
      `Tokenized funds are live on Stellar. The capital still arrives through advisers, and their fee is still tracked by hand.`,
      `${P} records the introduction the moment a client invests, vests the fee, pays it, and keeps each adviser's rate private.`,
      `Two parts: ${P} is the record and the payout. ${P} Connect is how it fits into the portal a fund already runs.`,
    ],
    action: 'Scroll once to "Two parts, one product", then press Next.',
    links: [{ label: 'The attribution contract on Stellar testnet', href: explorerContract(CONTRACTS.attribution) }],
  },
  {
    id: 'invite',
    title: 'The fund invites an adviser',
    where: '/issuer',
    whereLabel: 'the fund console',
    screen: 'issuer',
    say: [
      `Calder has agreed terms with Raghunathan Family Office. Those terms are between the two of them.`,
      `${P} gives the adviser a code, CALDER-PR7, and the fund console lists every adviser it has invited.`,
      `This is ${P} Connect at work: the code and the link live inside Calder's own portal. Nothing about Calder's onboarding changes.`,
    ],
    action: 'Point at the Adviser column: two advisers, two codes, two private rates. Nothing else about the fund has changed.',
    links: [
      tx('An adviser registered with a code', TX.register, CONTRACTS.attribution),
      tx('The fund opening its ledger', TX.initialise, CONTRACTS.attribution),
    ],
  },
  {
    id: 'link',
    title: 'The adviser gets a link',
    where: '/scout',
    whereLabel: "the adviser's book",
    screen: 'scout',
    say: [
      `This is the adviser's book. One link, one code, one private rate: 0.50%.`,
      `Anyone who invests through the link is recorded as theirs. Instantly, with no form and nobody to chase.`,
      `The link opens Calder's portal, not ours. The adviser hands it to a client the way they already would.`,
    ],
    action: 'Press Copy link. Say who you would send it to.',
  },
  {
    id: 'invest',
    title: 'A client invests through it',
    where: '/i/CALDER-PR7?frame=phone',
    whereLabel: "the investor's phone",
    screen: 'investor',
    say: [
      `The client sees Calder, not ${P}. One line says who made the introduction.`,
      `An account secured with Face ID, no seed phrase. The identity check is Calder's own; here it is simulated.`,
      `US$250,000 at 0.50% is US$1,250. Numbers you can check in your head.`,
    ],
    action: 'Create account → Check my details → keep US$250,000 → Subscribe. Wait for the five stages.',
    links: [tx('A real subscription on the testnet contract', TX.subscribe, CONTRACTS.attribution)],
  },
  {
    id: 'recorded',
    title: 'Recorded, the moment it happens',
    where: '/scout',
    whereLabel: "the adviser's book",
    screen: 'scout',
    say: [
      `A new row at the top, Vesting, with its pay date. Earned has moved. The adviser did nothing.`,
      `That row is a public record on Stellar: who introduced whom, and how much. Not the rate, not the fee.`,
      `Open a second window on the book before the subscription and the audience sees it land live.`,
    ],
    action: 'Point at the new top row and the Earned tile.',
    links: [tx('The subscribe transaction', TX.subscribe, CONTRACTS.attribution)],
  },
  {
    id: 'public',
    title: 'What the world sees',
    where: '/scout',
    whereLabel: "the adviser's book",
    screen: 'scout',
    say: [
      `Flip the view. The names and the amounts invested stay. The fees become dots.`,
      `A fund will publish what came in. It will not let one distributor learn another's rate. That is the boundary ${P} keeps.`,
      `This toggle is an explanation, not access control. The rate was never written to the record.`,
    ],
    action: 'Press "What the world sees". Then flip it back.',
    links: [{ label: 'The contract holds no rate field', href: explorerContract(CONTRACTS.attribution) }],
  },
  {
    id: 'vest',
    title: 'The window passes',
    where: '/scout',
    whereLabel: "the adviser's book",
    screen: 'scout',
    lever: 'vest',
    say: [
      `The fee is held for the fund's window: 300 seconds on the testnet deployment, 90 days in production.`,
      `If the client exits inside the window, the fund reverses the fee. H. Solberg's row is that case: the amount stays visible, struck through, and leaves the totals.`,
      `Rules in the contract, not in a policy. Reversal is refused once a row has vested.`,
    ],
    action: 'Press Vest all. The new row flips to Payable; "On its way" moves.',
    links: [tx('A real reversal on the testnet contract', TX.recover, CONTRACTS.attribution)],
  },
  {
    id: 'payout',
    title: 'The fund runs the payout',
    where: '/issuer',
    whereLabel: 'the fund console',
    screen: 'issuer',
    say: [
      `One run settles everything payable, for every adviser, each at their own rate.`,
      `Each payment is a confidential transfer on OpenZeppelin's token. On the ledger the amount is a curve point, not a number. The fund and its auditor can still reconcile the total.`,
      `Here ${P} Connect is not involved. This is ${P}: the record and the payout.`,
    ],
    action: 'Press Run payout. Watch the rows flip to Paid.',
    links: [
      tx('A real settlement on the testnet contract', TX.settle, CONTRACTS.attribution),
      tx('A real confidential transfer, no amount in it', TX.confidentialTransfer, CONTRACTS.confidentialToken),
      tx('The pool top-up, the one amount that is public', TX.deposit, CONTRACTS.confidentialToken),
    ],
  },
  {
    id: 'paid',
    title: 'Paid, with no invoice',
    where: '/scout',
    whereLabel: "the adviser's book",
    screen: 'scout',
    say: [
      `Paid out has moved. The row says Paid, with a date. The adviser chased nobody.`,
      `Advisers work with many funds. Their book is one place for all of them, in the same words.`,
    ],
    action: 'Point at Paid out and the top row.',
    links: [
      tx("The adviser's own claim, which pays nobody", TX.claim, CONTRACTS.attribution),
      tx('The verifier accepting a settlement proof', TX.proofVerified, CONTRACTS.verifier),
    ],
  },
  {
    id: 'more',
    title: 'More advisers, more books',
    where: '/scout?code=CALDER-DO2',
    whereLabel: 'the second adviser',
    screen: 'scout',
    code: 'CALDER-DO2',
    say: [
      `Dorsey Oakes Partners is a second adviser on different terms, 0.70%. Neither can see the other's rate.`,
      `Today the fund invites advisers. An adviser inviting advisers, with a share of the share, is the same ledger with one more column. It is on the roadmap, not in the contract yet.`,
    ],
    action: 'Point at the rate line, then at the empty Paid out tile.',
  },
  {
    id: 'real',
    title: 'The real thing, on testnet',
    where: '/',
    whereLabel: 'the front page',
    screen: 'home',
    say: [
      `Everything just clicked ran on sample data in the browser. The same flow runs on the Stellar testnet through Calder's portal, with a real Face ID: open an account, subscribe, and the row appears from the chain.`,
      `The minimum subscription on the deployed contract is US$50,000 of test dollars, which the portal credits to a new account.`,
      `The links here are that deployment: the contract, a subscription, a settlement, and a confidential transfer with no amount in it.`,
    ],
    action: 'If the Calder portal is running, switch to it now. Otherwise open a link and show the transaction.',
    links: [
      { label: 'Attribution contract', href: explorerContract(CONTRACTS.attribution) },
      tx('Subscription', TX.subscribe, CONTRACTS.attribution),
      tx('Settlement', TX.settle, CONTRACTS.attribution),
      tx('Confidential transfer', TX.confidentialTransfer, CONTRACTS.confidentialToken),
      { label: 'Confidential token', href: explorerContract(CONTRACTS.confidentialToken) },
      { label: 'Verifier', href: explorerContract(CONTRACTS.verifier) },
    ],
  },
];

export default function Guide({
  route,
  index,
  onIndex,
  onClose,
}: {
  route: Route;
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const step = STEPS[Math.min(Math.max(index, 0), STEPS.length - 1)];
  const last = index >= STEPS.length - 1;
  // Which side the panel sits on; the fund console's primary button is on the right.
  const [dock, setDock] = useState<'left' | 'right'>(() => {
    try {
      return localStorage.getItem('merit:guide-dock') === 'left' ? 'left' : 'right';
    } catch {
      return 'right';
    }
  });
  const swap = () => {
    const next = dock === 'left' ? 'right' : 'left';
    setDock(next);
    try {
      localStorage.setItem('merit:guide-dock', next);
    } catch {
      /* fine */
    }
  };
  const onScreen =
    route.screen === step.screen &&
    (!step.code || ('code' in route && route.code === step.code)) &&
    (step.screen !== 'scout' || step.code || !('code' in route) || route.code === null);

  const go = (i: number) => {
    const next = Math.min(Math.max(i, 0), STEPS.length - 1);
    onIndex(next);
    navigate(STEPS[next].where);
  };

  // Arrow keys step through, unless the presenter is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <aside className={`guide card--inverse guide--${dock}`} role="dialog" aria-label="Guided demo">
      <div className="guide__head">
        <span className="guide__kicker">
          <MeritMark size={16} /> Guided demo · {index + 1} of {STEPS.length}
        </span>
        <span className="guide__tools">
          <button type="button" className="btn btn--ghost btn--sm" onClick={swap} title="Move the panel to the other side">
            Move
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close the guide">
            Close
          </button>
        </span>
      </div>

      <h2 className="guide__title">{step.title}</h2>

      <div className="guide__block">
        <div className="eyebrow">Say</div>
        <ul className="guide__say">
          {step.say.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="guide__block">
        <div className="eyebrow">Do · {step.whereLabel}</div>
        <p className="guide__do">{step.action}</p>
        <div className="guide__levers">
          {!onScreen && (
            <button type="button" className="btn btn--sm" onClick={() => navigate(step.where)}>
              Go to {step.whereLabel}
            </button>
          )}
          {step.lever === 'vest' && MODE === 'stub' && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => stubAdvanceVesting()}>
              Vest all
            </button>
          )}
        </div>
      </div>

      {step.links && step.links.length > 0 && (
        <div className="guide__block">
          <div className="eyebrow">On Stellar testnet</div>
          <ul className="guide__links">
            {step.links.map((l) => (
              <li key={l.href + l.label}>
                <a href={l.href} target="_blank" rel="noreferrer">
                  {l.label} <ExternalLinkIcon size={12} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="guide__nav">
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => go(index - 1)} disabled={index === 0}>
          Back
        </button>
        <span className="guide__dots" aria-hidden>
          {STEPS.map((s, i) => (
            <i key={s.id} className={i === index ? 'is-on' : i < index ? 'is-done' : ''} />
          ))}
        </span>
        {last ? (
          <button type="button" className="btn btn--sm" onClick={onClose}>
            Finish
          </button>
        ) : (
          <button type="button" className="btn btn--sm" onClick={() => go(index + 1)}>
            Next
          </button>
        )}
      </div>
    </aside>
  );
}
