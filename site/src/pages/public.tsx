/**
 * The pages anybody can read.
 *
 * All of these are rendered on the server with live chain figures already in
 * them. The headline numbers on the home page are not illustrative: they are
 * the attribution ledger, totalled during the request.
 */
import {
  Address,
  Figure,
  Link,
  Panel,
  StatePill,
  explorerContract,
  money,
  when,
} from '../components.tsx';
import type { PageData } from '../types.ts';

export function Home({ data }: { data: PageData }) {
  const { fund, stats } = data;
  return (
    <>
      <section className="band band--ink">
        <div className="page grid grid--split">
          <div>
            <p className="eyebrow">Short-duration credit · {fund.domicile}</p>
            <h1>The fund your adviser recommended, open in under a minute.</h1>
            <p className="lede">
              {fund.name} is distributed entirely through introducers. Subscribe with a fingerprint
              — no seed phrase, no wallet to install, no transfer fees to fund first.
            </p>
            <div className="actions" style={{ marginTop: '2rem' }}>
              <Link href="/open" className="button button--large">
                Open an account
              </Link>
              <Link href="/fund">Strategy and terms →</Link>
            </div>
          </div>
          <Panel variant="quiet">
            <p className="eyebrow" style={{ color: 'var(--ink-faint)' }}>
              At a glance
            </p>
            <table className="terms">
              <tbody>
                <tr>
                  <th>Unit</th>
                  <td className="num">{fund.unitCode}</td>
                </tr>
                <tr>
                  <th>Unit price</th>
                  <td className="num">
                    {fund.unitPrice} {fund.subscriptionAsset}
                  </td>
                </tr>
                <tr>
                  <th>Minimum</th>
                  <td className="num">
                    {money(String(fund.minimumSubscription) + '.00')} {fund.subscriptionAsset}
                  </td>
                </tr>
                <tr>
                  <th>Domicile</th>
                  <td className="num">{fund.domicile}</td>
                </tr>
                <tr>
                  <th>Inception</th>
                  <td className="num">{fund.inceptionYear}</td>
                </tr>
              </tbody>
            </table>
          </Panel>
        </div>
      </section>

      {stats ? (
        <section className="band band--tight band--sunk">
          <div className="page">
            <div className="figures">
              <Figure
                label="Subscribed"
                value={`${stats.subscribed}`}
                note={`${fund.subscriptionAsset}, on chain`}
              />
              <Figure label="Investors" value={stats.investors} note="holding units" />
              <Figure label="Introducers" value={stats.advisers} note="registered advisers" />
              <Figure
                label="Introductions"
                value={stats.introductions}
                note={stats.reversed ? `${stats.reversed} reversed` : 'none reversed'}
              />
            </div>
            <p className="fine" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
              Read from{' '}
              <a href={explorerContract(data.contracts.rails)} target="_blank" rel="noreferrer">
                the attribution contract
              </a>{' '}
              at the moment this page was rendered — not a figure we typed in.
            </p>
          </div>
        </section>
      ) : null}

      <section className="band">
        <div className="page grid grid--split">
          <div className="prose">
            <p className="eyebrow">Strategy</p>
            <h2>A boring fund, deliberately.</h2>
            <p>{fund.strategy}</p>
            <p>
              The portfolio holds investment-grade paper with a weighted average maturity under
              eighteen months, hedged back to the subscription currency. It is designed to be the
              least interesting holding in a client’s portfolio: predictable, liquid, and
              short enough that duration is somebody else’s problem.
            </p>
            <p>
              We do not market it. Every subscription in the figures above arrived through an
              adviser who already knew the client.
            </p>
          </div>
          <Panel title="Why distribution works this way">
            <div className="stack">
              <p style={{ marginBottom: 0 }}>
                A fund like this is sold by people, not advertising. The constraint has always been
                administrative: an introducer has to trust that the manager recorded the
                introduction, calculated the commission correctly, and will pay it.
              </p>
              <p style={{ marginBottom: 0 }}>
                Here the introduction is recorded on a public ledger the adviser can read for
                themselves — and the commercial terms are not, because a rate the whole market can
                read is a rate no manager would agree to.
              </p>
              <p style={{ margin: 0 }}>
                <Link href="/how-it-works">How that works →</Link>
              </p>
            </div>
          </Panel>
        </div>
      </section>

      <section className="band band--sunk">
        <div className="page">
          <p className="eyebrow">Opening an account</p>
          <h2 style={{ maxWidth: '28ch' }}>Three steps, and none of them is a seed phrase.</h2>
          <div className="grid grid--3" style={{ marginTop: '2.5rem' }}>
            <Panel title="1 · Create a passkey">
              <p style={{ marginBottom: 0 }}>
                Your device creates a key in its secure element — the same mechanism that unlocks
                your banking app. It never leaves the device and we never see it.
              </p>
            </Panel>
            <Panel title="2 · We open the account">
              <p style={{ marginBottom: 0 }}>
                Calder deploys a Stellar account controlled by that passkey and pays the network
                fees. You do not need to hold any cryptocurrency to use it.
              </p>
            </Panel>
            <Panel title="3 · Subscribe">
              <p style={{ marginBottom: 0 }}>
                Choose an amount and confirm with your fingerprint. Units arrive in the same
                transaction the subscription leaves in.
              </p>
            </Panel>
          </div>
          <div className="actions" style={{ marginTop: '2rem' }}>
            <Link href="/open" className="button">
              Open an account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export function FundPage({ data }: { data: PageData }) {
  const { fund, stats } = data;
  return (
    <>
      <section className="band">
        <div className="page">
          <p className="eyebrow">Fund factsheet</p>
          <h1 style={{ maxWidth: '24ch' }}>{fund.name}</h1>
          <p className="lede measure">{fund.strategy}</p>
        </div>
      </section>

      {stats ? (
        <section className="band band--tight band--sunk">
          <div className="page">
            <div className="figures">
              <Figure label="Subscribed" value={stats.subscribed} note={fund.subscriptionAsset} />
              <Figure label="Unitholders" value={stats.investors} />
              <Figure label="Distributors" value={stats.advisers} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="band">
        <div className="page grid grid--split">
          <Panel title="Terms">
            <table className="terms">
              <tbody>
                <tr>
                  <th>Fund name</th>
                  <td>{fund.name}</td>
                </tr>
                <tr>
                  <th>Manager</th>
                  <td>{fund.manager}</td>
                </tr>
                <tr>
                  <th>Unit code</th>
                  <td className="num">{fund.unitCode}</td>
                </tr>
                <tr>
                  <th>ISIN</th>
                  <td className="num">{fund.isin}</td>
                </tr>
                <tr>
                  <th>Subscription currency</th>
                  <td className="num">{fund.subscriptionAsset}</td>
                </tr>
                <tr>
                  <th>Unit price</th>
                  <td className="num">
                    {fund.unitPrice} {fund.subscriptionAsset}
                  </td>
                </tr>
                <tr>
                  <th>Minimum subscription</th>
                  <td className="num">
                    {money(String(fund.minimumSubscription) + '.00')} {fund.subscriptionAsset}
                  </td>
                </tr>
                <tr>
                  <th>Domicile</th>
                  <td>{fund.domicile}</td>
                </tr>
                <tr>
                  <th>Regulator</th>
                  <td>{fund.regulator}</td>
                </tr>
                <tr>
                  <th>Licence</th>
                  <td className="num">{fund.licence}</td>
                </tr>
                <tr>
                  <th>Dealing</th>
                  <td>Continuous, settled on the Stellar network</td>
                </tr>
                <tr>
                  <th>Distribution</th>
                  <td>Introducers only</td>
                </tr>
              </tbody>
            </table>
          </Panel>

          <div className="stack stack--loose">
            <Panel title="Unit pricing">
              <p style={{ marginBottom: 0 }}>
                Units are issued at {fund.unitPrice} {fund.subscriptionAsset}. This build holds the
                price fixed, so a subscription converts one for one and the arithmetic on screen is
                checkable by eye. A live net asset value would be published here and applied at the
                next dealing point.
              </p>
            </Panel>
            <Panel title="Settlement">
              <p>
                Subscriptions settle on chain. The {fund.subscriptionAsset} leaves the investor’s
                account and the {fund.unitCode} units arrive in the same transaction — there is no
                window in which the investor has paid and holds nothing.
              </p>
              <p style={{ marginBottom: 0 }}>
                The attribution for the introducing adviser is written in that same transaction,
                which is what makes the commission a matter of record rather than of trust.
              </p>
            </Panel>
            <div className="note note--caution">
              The compliance controls a real fund would switch on — investor authorisation before
              units can be issued, clawback of units on a failed check — are not enabled on this
              deployment. The mechanism to enforce them exists; the flags are off.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export function HowItWorks({ data }: { data: PageData }) {
  const { fund } = data;
  return (
    <>
      <section className="band">
        <div className="page">
          <p className="eyebrow">For advisers and investors</p>
          <h1 style={{ maxWidth: '26ch' }}>What is on the ledger, and what is not.</h1>
          <p className="lede measure">
            Every introduction to {fund.shortManager} is recorded publicly. Not one commission rate
            is. That distinction is the entire design.
          </p>
        </div>
      </section>

      <section className="band">
        <div className="page grid grid--split">
          <div className="prose">
            <h2>The problem with putting commission on a blockchain</h2>
            <p>
              Attribution is an obvious thing to put on a shared ledger. An introducer wants proof
              their client was credited to them; a manager wants a record that survives a change of
              administrator; an auditor wants to reconcile both without being handed a spreadsheet.
            </p>
            <p>
              The trouble starts when you also put the commission there. Rates in fund distribution
              are negotiated one adviser at a time, and they differ — materially. A large
              distributor gets terms a new one does not. Publish the rate and every adviser can
              read every other adviser’s terms by dividing one number by another, which is the one
              thing a manager cannot allow. In practice that is why this has not been done.
            </p>
            <h2>What we record instead</h2>
            <p>
              The contract stores who introduced whom, how much that investor subscribed, and when
              the resulting commission vests. It does not store a rate, a fee, or any payable
              amount — there is no field for one.
            </p>
            <p>
              Settlement happens off the attribution contract. {fund.shortManager} holds a
              confidential balance and pays each adviser from it, applying that adviser’s own
              privately negotiated rate. Collecting is a transaction that proves the commission has
              vested and marks it taken; it carries identifiers and never an amount.
            </p>
            <p>
              So an observer with the whole chain in front of them can work out who introduced whom
              and how much each investor subscribed — both of those are public transfers anyway.
              They cannot work out anybody’s rate, fee, or earnings.
            </p>
          </div>

          <div className="stack stack--loose">
            <Panel title="On the public ledger">
              <ul className="stack stack--tight" style={{ paddingLeft: '1.1rem', margin: 0 }}>
                <li>The adviser’s code and the account that owns it</li>
                <li>Which investor subscribed, and how much</li>
                <li>When that introduction’s commission vests</li>
                <li>Whether it has been settled, or reversed</li>
              </ul>
            </Panel>
            <Panel title="Never on the ledger" variant="sunk">
              <ul className="stack stack--tight" style={{ paddingLeft: '1.1rem', margin: 0 }}>
                <li>Any adviser’s commission rate</li>
                <li>Any fee amount, accrued or paid</li>
                <li>Any total of what an adviser has earned</li>
              </ul>
            </Panel>
            <Panel title="Vesting and reversal">
              <p style={{ marginBottom: 0 }}>
                Commission does not become payable immediately. If the investor redeems inside the
                vesting window, {fund.shortManager} reverses the introduction and it never settles
                — the same chargeback an insurance broker lives with. A reversal stays on the
                adviser’s book as evidence rather than quietly disappearing.
              </p>
            </Panel>
          </div>
        </div>
      </section>

      <section className="band band--sunk">
        <div className="page">
          <h2>What this changes for an adviser</h2>
          <div className="grid grid--3" style={{ marginTop: '2rem' }}>
            <Panel title="You can audit it yourself">
              <p style={{ marginBottom: 0 }}>
                Your book is a public read. You do not have to ask us whether a client was credited
                to you, and you do not have to wait for a statement to find out.
              </p>
            </Panel>
            <Panel title="Your terms stay yours">
              <p style={{ marginBottom: 0 }}>
                Nobody can derive your rate from the chain, and you cannot derive theirs. Your
                client list is visible; your economics are not.
              </p>
            </Panel>
            <Panel title="You do not have to chase">
              <p style={{ marginBottom: 0 }}>
                Collecting is available to you, but the manager can also settle a vested
                introduction without being asked — so being paid is not contingent on your
                remembering to ask for it.
              </p>
            </Panel>
          </div>
          <div className="actions" style={{ marginTop: '2rem' }}>
            <Link href="/advisers" className="button button--quiet">
              See the introducer register
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export function Introduction({ data }: { data: PageData }) {
  const { fund, introducer } = data;

  if (!introducer) {
    return (
      <section className="band">
        <div className="page measure">
          <p className="eyebrow">Introduction</p>
          <h1>That link is not valid.</h1>
          <p className="lede">
            No adviser holds that code on the attribution contract. If somebody sent you this link,
            ask them to check it — a code that was never registered cannot be credited.
          </p>
          <div className="actions">
            <Link href="/fund" className="button button--quiet">
              Read about the fund
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="band band--ink">
        <div className="page grid grid--split">
          <div>
            <p className="eyebrow">You have been introduced</p>
            <h1 style={{ maxWidth: '22ch' }}>{introducer.displayName} has introduced you to {fund.shortManager}.</h1>
            <p className="lede">
              Open an account and your subscription will be credited to them on the public ledger.
              It takes a fingerprint and no paperwork.
            </p>
            <div className="actions" style={{ marginTop: '2rem' }}>
              <Link href="/open" className="button button--large">
                Open an account
              </Link>
              <Link href="/fund">Read the factsheet →</Link>
            </div>
          </div>
          <Panel variant="quiet">
            <p className="eyebrow" style={{ color: 'var(--ink-faint)' }}>
              Verified on chain
            </p>
            <table className="terms">
              <tbody>
                <tr>
                  <th>Adviser</th>
                  <td>{introducer.displayName}</td>
                </tr>
                <tr>
                  <th>Code</th>
                  <td className="num">{introducer.code}</td>
                </tr>
                <tr>
                  <th>Registered account</th>
                  <td>
                    <Address value={introducer.owner} />
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="fine" style={{ marginTop: '1rem', marginBottom: 0 }}>
              We read this from the attribution contract when the page loaded, so the adviser’s
              claim to introduce you is something you can check rather than something we assert.
            </p>
          </Panel>
        </div>
      </section>

      <section className="band">
        <div className="page grid grid--3">
          <Panel title="What your adviser sees">
            <p style={{ marginBottom: 0 }}>
              That you subscribed, and how much. It is how they get paid, and it is on a ledger they
              can read without asking us.
            </p>
          </Panel>
          <Panel title="What they do not see">
            <p style={{ marginBottom: 0 }}>
              Your account’s keys, your other holdings, or anything you do with the account beyond
              this fund. They cannot move anything.
            </p>
          </Panel>
          <Panel title="What nobody sees">
            <p style={{ marginBottom: 0 }}>
              What {introducer.displayName} is paid for introducing you. Their commission rate is
              not on the chain and cannot be derived from it.
            </p>
          </Panel>
        </div>
      </section>
    </>
  );
}

export function Advisers({ data }: { data: PageData }) {
  const advisers = data.advisers ?? [];
  return (
    <>
      <section className="band">
        <div className="page">
          <p className="eyebrow">Introducer register</p>
          <h1 style={{ maxWidth: '24ch' }}>Every adviser distributing the fund, as the chain has them.</h1>
          <p className="lede measure">
            This register is a public read of the attribution contract — not a page we maintain. An
            adviser appears here because they registered a code, and their book is open to anyone.
          </p>
        </div>
      </section>

      <section className="band band--sunk">
        <div className="page">
          <Panel>
            <table>
              <caption>Codes registered on the attribution contract</caption>
              <thead>
                <tr>
                  <th>Adviser</th>
                  <th>Code</th>
                  <th>Registered account</th>
                  <th className="num">Introductions</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {advisers.map((adviser) => (
                  <tr key={adviser.code}>
                    <td>{adviser.displayName}</td>
                    <td className="num">{adviser.code}</td>
                    <td>
                      <Address value={adviser.owner} />
                    </td>
                    <td className="num">{adviser.introductions}</td>
                    <td className="num">
                      <Link href={`/advisers/${adviser.code}`}>Open book →</Link>
                    </td>
                  </tr>
                ))}
                {advisers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="fine">
                      No codes are registered on this deployment yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Panel>
          <p className="fine" style={{ marginTop: '1rem', marginBottom: 0 }}>
            Note what this table cannot show: what any of these advisers is paid. There is no rate
            on the chain to display.
          </p>
        </div>
      </section>
    </>
  );
}

export function AdviserBook({ data }: { data: PageData }) {
  const { introducer, book, fund } = data;
  if (!introducer) {
    return (
      <section className="band">
        <div className="page measure">
          <h1>No such adviser.</h1>
          <p className="lede">That code is not registered on the attribution contract.</p>
          <Link href="/advisers" className="button button--quiet">
            Back to the register
          </Link>
        </div>
      </section>
    );
  }

  const rows = book?.rows ?? [];
  const counts = {
    payable: rows.filter((r) => r.state === 'payable').length,
    vesting: rows.filter((r) => r.state === 'vesting').length,
    paid: rows.filter((r) => r.state === 'paid').length,
    reversed: rows.filter((r) => r.state === 'reversed').length,
  };

  return (
    <>
      <section className="band">
        <div className="page">
          <p className="eyebrow">Adviser book · {introducer.code}</p>
          <h1 style={{ maxWidth: '26ch' }}>{introducer.displayName}</h1>
          <p className="lede measure">
            Every introduction credited to this code, read live from the attribution contract.
          </p>
        </div>
      </section>

      <section className="band band--tight band--sunk">
        <div className="page">
          <div className="figures">
            <Figure
              label="Payable basis"
              value={money(book?.claimableBasis ?? '0.00')}
              note={`${fund.subscriptionAsset} subscribed, vested and unsettled`}
            />
            <Figure label="Payable" value={counts.payable} note="introductions" />
            <Figure label="Vesting" value={counts.vesting} note="inside the window" />
            <Figure label="Settled" value={counts.paid} />
            <Figure label="Reversed" value={counts.reversed} note="redeemed early" />
          </div>
          <div className="note" style={{ marginTop: '1.25rem' }}>
            <strong>Payable basis is a subscription total, not a commission.</strong> Turning it
            into money needs this adviser’s rate, which lives with them and with{' '}
            {fund.shortManager} and is not on the chain. The site cannot compute the fee and does
            not guess at it.
          </div>
        </div>
      </section>

      <section className="band">
        <div className="page">
          <Panel title="Introductions">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Investor</th>
                  <th className="num">Subscribed</th>
                  <th className="num">Units</th>
                  <th className="num">Date</th>
                  <th className="num">Vests</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="num">{row.id}</td>
                    <td>
                      <Address value={row.investor} />
                    </td>
                    <td className="num">{money(row.subscribed)}</td>
                    <td className="num">{money(row.units)}</td>
                    <td className="num fine">{when(row.at)}</td>
                    <td className="num fine">{when(row.vestsAt)}</td>
                    <td>
                      <StatePill state={row.state} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="fine">
                      No introductions against this code yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Panel>
        </div>
      </section>
    </>
  );
}

export function NotFound() {
  return (
    <section className="band">
      <div className="page measure">
        <p className="eyebrow">404</p>
        <h1>There is nothing here.</h1>
        <p className="lede">The page you asked for does not exist on this site.</p>
        <Link href="/" className="button button--quiet">
          Back to the fund
        </Link>
      </div>
    </section>
  );
}
