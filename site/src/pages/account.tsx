/**
 * The four screens where an investor does something.
 *
 * These are the only pages that touch the passkey APIs, and they all go
 * through the same path: ask the server to prepare an authorization, show the
 * investor what it is, ask the secure element to sign it, send the assertion
 * back. Nothing here constructs a transaction and nothing here holds a key.
 */
import { useEffect, useState } from 'react';
import {
  ActivityList,
  Address,
  AuthorizeSheet,
  Figure,
  Link,
  Panel,
  StatePill,
  explorerContract,
  money,
  readableError,
  useAuthorization,
  when,
} from '../components.tsx';
import type { PageData, WalletState } from '../types.ts';
import {
  createPasskey,
  credit,
  openAccount,
  platformAuthenticatorAvailable,
  rememberDevice,
  sign,
  signIn,
  storedDevice,
} from '../wallet/passkey.ts';

/** A name for the credential. Real sites use an email; this one needs neither. */
function investorHandle(): { name: string; displayName: string } {
  const suffix = Math.random().toString(36).slice(2, 8);
  return { name: `investor-${suffix}@calder.example`, displayName: 'Calder investor' };
}

// ---------------------------------------------------------------------------
// Opening an account
// ---------------------------------------------------------------------------

export function Open({ data }: { data: PageData }) {
  const { fund, introducer, rpId } = data;
  const [busy, setBusy] = useState<'create' | 'signin' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    platformAuthenticatorAvailable().then(setAvailable);
  }, []);

  async function onCreate() {
    setBusy('create');
    setError(null);
    setNote('Creating a key in this device’s secure element…');
    try {
      const { credentialId, publicKey } = await createPasskey(rpId, fund.manager, investorHandle());
      setNote('Opening your account on the network. Calder is paying the fees…');
      const opened = await openAccount(credentialId, publicKey, data.session.code ?? introducer?.code);
      rememberDevice({ credentialId, address: opened.address, label: 'This device' });
      setNote('Done. Taking you to your portfolio…');
      location.href = '/portfolio';
    } catch (thrown) {
      setError(readableError(thrown));
      setNote(null);
      setBusy(null);
    }
  }

  async function onSignIn() {
    setBusy('signin');
    setError(null);
    setNote('Choose your Calder passkey…');
    try {
      // No allowCredentials: the authenticator volunteers which Calder account
      // it holds. That is what makes a discoverable credential worth
      // requiring at registration — there is no username to type and no user
      // table to look one up in.
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = await sign(
        btoa(String.fromCharCode(...challenge)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        rpId,
      );
      const session = await signIn(assertion.credentialId);
      rememberDevice({ credentialId: assertion.credentialId, address: session.address, label: 'This device' });
      location.href = '/portfolio';
    } catch (thrown) {
      setError(readableError(thrown));
      setNote(null);
      setBusy(null);
    }
  }

  return (
    <>
      <section className="band">
        <div className="page grid grid--split">
          <div>
            <p className="eyebrow">Open an account</p>
            <h1 style={{ maxWidth: '22ch' }}>No password. No seed phrase. No cryptocurrency.</h1>
            <p className="lede">
              Your account is controlled by a passkey on this device — the same thing that unlocks
              your banking app. {fund.shortManager} pays the network fees, so you never have to
              hold {fund.subscriptionAsset === 'USDC' ? 'XLM' : 'anything'} to use it.
            </p>

            {introducer ? (
              <div className="note" style={{ marginTop: '1.5rem' }}>
                Your subscription will be credited to <strong>{introducer.displayName}</strong> (
                {introducer.code}) on the public ledger.
              </div>
            ) : (
              <div className="note note--caution" style={{ marginTop: '1.5rem' }}>
                You arrived without an introduction link, so no adviser will be credited. If an
                adviser sent you here, use their link instead.
              </div>
            )}

            <div className="actions" style={{ marginTop: '2rem' }}>
              <button
                type="button"
                className="button button--large"
                onClick={onCreate}
                disabled={busy !== null || available === false}
              >
                {busy === 'create' ? 'Working…' : 'Create a passkey'}
              </button>
              <button
                type="button"
                className="button button--quiet"
                onClick={onSignIn}
                disabled={busy !== null || available === false}
              >
                {busy === 'signin' ? 'Working…' : 'I already have an account'}
              </button>
            </div>

            {note ? (
              <p className="fine" style={{ marginTop: '1rem' }}>
                {note}
              </p>
            ) : null}
            {error ? (
              <p className="field__error" style={{ marginTop: '1rem' }}>
                {error}
              </p>
            ) : null}
            {available === false ? (
              <p className="field__error" style={{ marginTop: '1rem' }}>
                This browser has no passkey authenticator available. Safari or Chrome on a device
                with Touch ID, Face ID or Windows Hello will work.
              </p>
            ) : null}
          </div>

          <div className="stack stack--loose">
            <Panel title="What is created">
              <table className="terms">
                <tbody>
                  <tr>
                    <th>On your device</th>
                    <td>A key in the secure element. It cannot be exported, by us or by you.</td>
                  </tr>
                  <tr>
                    <th>On the network</th>
                    <td>
                      A Stellar account whose only signer is that key, deployed and paid for by{' '}
                      {fund.shortManager}.
                    </td>
                  </tr>
                  <tr>
                    <th>On our servers</th>
                    <td>
                      Your account’s public address. No password, no recovery email, nothing worth
                      stealing.
                    </td>
                  </tr>
                </tbody>
              </table>
            </Panel>
            <Panel title="If you lose the device" variant="sunk">
              <p style={{ marginBottom: 0 }}>
                Add a second device from your wallet page while you still have this one, and either
                can approve payments. A passkey synced through iCloud Keychain or a Google account
                is already on your other devices.
              </p>
            </Panel>
            <p className="fine" style={{ margin: 0 }}>
              Relying party: <span className="mono">{rpId}</span>. Your passkey only works on this
              domain, and the account on the network refuses assertions minted anywhere else.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export function Portfolio({ data }: { data: PageData }) {
  const { fund, wallet } = data;
  if (!wallet) return <NoAccount />;

  const value = Number(wallet.balances.units) * Number(fund.unitPrice);
  return (
    <>
      <section className="band">
        <div className="page">
          <p className="eyebrow">Portfolio</p>
          <h1 style={{ maxWidth: '24ch' }}>Your holding in {fund.name}</h1>
          <p className="fine">
            Account <Address value={wallet.address} label="address" /> · read live from the network
          </p>
        </div>
      </section>

      <section className="band band--tight band--sunk">
        <div className="page">
          <div className="figures">
            <Figure label="Units held" value={money(wallet.balances.units)} note={fund.unitCode} />
            <Figure
              label="Value"
              value={money(value.toFixed(2))}
              note={`${fund.subscriptionAsset} at ${fund.unitPrice}/unit`}
            />
            <Figure
              label="Available to invest"
              value={money(wallet.balances.usdc)}
              note={fund.subscriptionAsset}
            />
            <Figure label="Subscriptions" value={wallet.positions.length} />
          </div>
          <div className="actions" style={{ marginTop: '1.5rem' }}>
            <Link href="/subscribe" className="button">
              Subscribe
            </Link>
            <Link href="/wallet" className="button button--quiet">
              Wallet and devices
            </Link>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="page stack stack--loose">
          <Panel title="Your subscriptions">
            {wallet.positions.length ? (
              <table>
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th className="num">Subscribed</th>
                    <th className="num">Units</th>
                    <th>Introduced by</th>
                    <th className="num">Date</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet.positions.map((row) => (
                    <tr key={row.id}>
                      <td className="num">{row.id}</td>
                      <td className="num">{money(row.subscribed)}</td>
                      <td className="num">{money(row.units)}</td>
                      <td className="num">{row.code}</td>
                      <td className="num fine">{when(row.at)}</td>
                      <td>
                        <StatePill state={row.state} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="fine" style={{ marginBottom: 0 }}>
                You have not subscribed yet. <Link href="/subscribe">Make a subscription →</Link>
              </p>
            )}
          </Panel>

          <div className="note">
            The state on each row is the <em>adviser’s</em> commission, not your units. Your units
            are yours from the moment the subscription settles; the commission on introducing you
            vests over the window and can be reversed if you redeem early.
          </div>

          <Panel title="Statement">
            <ActivityList items={wallet.activity} />
            <p className="fine" style={{ marginTop: '1rem', marginBottom: 0 }}>
              Movements are read from token contract events, which the network retains for about a
              day. This is a recent-activity view, not a full history.
            </p>
          </Panel>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Subscribing
// ---------------------------------------------------------------------------

export function Subscribe({ data }: { data: PageData }) {
  const { fund, wallet, introducer, rpId } = data;
  const [amount, setAmount] = useState(String(fund.minimumSubscription));
  const auth = useAuthorization(rpId);
  if (!wallet) return <NoAccount />;

  const parsed = Number(String(amount).replace(/,/g, ''));
  const available = Number(wallet.balances.usdc);
  const belowMinimum = parsed < fund.minimumSubscription;
  const overBalance = parsed > available;
  const invalid = !Number.isFinite(parsed) || parsed <= 0 || belowMinimum || overBalance;

  const units = Number.isFinite(parsed) ? parsed / Number(fund.unitPrice) : 0;

  return (
    <>
      <section className="band">
        <div className="page grid grid--split">
          <div>
            <p className="eyebrow">Subscribe</p>
            <h1 style={{ maxWidth: '22ch' }}>{fund.name}</h1>
            <p className="lede">
              Units are issued at {fund.unitPrice} {fund.subscriptionAsset}. Your subscription and
              the units settle in the same transaction.
            </p>

            <Panel title="Amount">
              <div className="stack">
                <div>
                  <label htmlFor="amount">Subscription ({fund.subscriptionAsset})</label>
                  <input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    aria-invalid={invalid}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  {belowMinimum ? (
                    <p className="field__error">
                      The fund’s minimum is {money(String(fund.minimumSubscription) + '.00')}{' '}
                      {fund.subscriptionAsset}.
                    </p>
                  ) : overBalance ? (
                    <p className="field__error">
                      You have {money(wallet.balances.usdc)} {fund.subscriptionAsset} available.
                    </p>
                  ) : (
                    <p className="field__hint">
                      You will receive {money(units.toFixed(2))} {fund.unitCode}.
                    </p>
                  )}
                </div>

                <div className="actions">
                  {[fund.minimumSubscription, 250000, 1000000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="button button--quiet"
                      onClick={() => setAmount(String(preset))}
                    >
                      {money(String(preset) + '.00')}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="button button--large button--block"
                  disabled={invalid}
                  onClick={() =>
                    auth.run({
                      kind: 'subscribe',
                      code: introducer?.code ?? data.session.code,
                      amount: String(parsed.toFixed(2)),
                      introducerName: introducer?.displayName,
                    })
                  }
                >
                  Confirm with your passkey
                </button>

                {!introducer && !data.session.code ? (
                  <p className="field__error" style={{ margin: 0 }}>
                    No adviser code on this session, so there is nothing to credit the introduction
                    to. Use your adviser’s link.
                  </p>
                ) : null}
              </div>
            </Panel>
          </div>

          <div className="stack stack--loose">
            <Panel title="Your account">
              <table className="terms">
                <tbody>
                  <tr>
                    <th>Available</th>
                    <td className="num">
                      {money(wallet.balances.usdc)} {fund.subscriptionAsset}
                    </td>
                  </tr>
                  <tr>
                    <th>Units held</th>
                    <td className="num">
                      {money(wallet.balances.units)} {fund.unitCode}
                    </td>
                  </tr>
                  <tr>
                    <th>Introduced by</th>
                    <td>{introducer?.displayName ?? '—'}</td>
                  </tr>
                </tbody>
              </table>
              {available < fund.minimumSubscription ? (
                <p className="fine" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  Not enough to meet the minimum. <Link href="/wallet">Credit your account →</Link>
                </p>
              ) : null}
            </Panel>
            <Panel title="What you are approving" variant="sunk">
              <p style={{ marginBottom: 0 }}>
                One fingerprint authorizes the whole transaction: the {fund.subscriptionAsset}
                leaving your account, the {fund.unitCode} units arriving, and the attribution to
                your adviser. You are not approving three things in sequence and you cannot end up
                with some of them.
              </p>
            </Panel>
          </div>
        </div>
      </section>

      <AuthorizeSheet
        auth={auth}
        doneLabel="See my portfolio"
        onClose={() => {
          if (auth.phase === 'done') location.href = '/portfolio';
          else auth.reset();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export function Wallet({ data }: { data: PageData }) {
  const { fund, wallet, rpId, contracts } = data;
  const auth = useAuthorization(rpId);
  if (!wallet) return <NoAccount />;

  return (
    <>
      <section className="band">
        <div className="page">
          <p className="eyebrow">Wallet</p>
          <h1 style={{ maxWidth: '20ch' }}>Your account on the network</h1>
          <p className="fine">
            <Address value={wallet.address} label="address" /> ·{' '}
            <a href={explorerContract(wallet.address)} target="_blank" rel="noreferrer">
              View on the explorer
            </a>
          </p>
        </div>
      </section>

      <section className="band band--tight band--sunk">
        <div className="page">
          <div className="figures">
            <Figure
              label={fund.subscriptionAsset}
              value={money(wallet.balances.usdc)}
              note="available to invest"
            />
            <Figure label={fund.unitCode} value={money(wallet.balances.units)} note="fund units" />
            <Figure label="XLM" value="0.00" note="not needed — Calder pays fees" />
            <Figure
              label="Devices"
              value={wallet.passkeys}
              note={wallet.passkeys === 1 ? 'one passkey' : 'passkeys registered'}
            />
          </div>
        </div>
      </section>

      <section className="band">
        <div className="page grid grid--split">
          <div className="stack stack--loose">
            <SendPanel data={data} wallet={wallet} auth={auth} />
            <Panel title="Receive">
              <p>
                Anyone can send {fund.subscriptionAsset} or {fund.unitCode} to this address. It is a
                contract account, so it needs no trustline and nothing has to be set up first.
              </p>
              <p className="mono" style={{ marginBottom: '0.75rem' }}>
                {wallet.address}
              </p>
              <Address value={wallet.address} label="address" />
            </Panel>
            <Panel title="Recent activity">
              <ActivityList items={wallet.activity} />
            </Panel>
          </div>

          <div className="stack stack--loose">
            <DevicesPanel data={data} wallet={wallet} auth={auth} />
            <CreditPanel fund={fund} />
            <Panel title="What this account is" variant="sunk">
              <table className="terms">
                <tbody>
                  <tr>
                    <th>Type</th>
                    <td>Soroban smart account</td>
                  </tr>
                  <tr>
                    <th>Signer</th>
                    <td>
                      {wallet.passkeys === 1 ? 'One passkey' : `${wallet.passkeys} passkeys`}, held
                      in device secure elements
                    </td>
                  </tr>
                  <tr>
                    <th>Bound to</th>
                    <td className="mono">{rpId}</td>
                  </tr>
                  <tr>
                    <th>Fees paid by</th>
                    <td>{fund.manager}</td>
                  </tr>
                  <tr>
                    <th>Attribution</th>
                    <td>
                      <Address value={contracts.rails} />
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="fine" style={{ marginTop: '1rem', marginBottom: 0 }}>
                Calder can pay your fees and cannot move your money. Every movement needs an
                assertion from one of the passkeys above, over that exact transaction.
              </p>
            </Panel>
          </div>
        </div>
      </section>

      <AuthorizeSheet auth={auth} onClose={() => location.reload()} />
    </>
  );
}

function SendPanel({
  data,
  wallet,
  auth,
}: {
  data: PageData;
  wallet: WalletState;
  auth: ReturnType<typeof useAuthorization>;
}) {
  const { fund } = data;
  const [asset, setAsset] = useState<'usdc' | 'units'>('usdc');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');

  const held = asset === 'usdc' ? Number(wallet.balances.usdc) : Number(wallet.balances.units);
  const parsed = Number(String(amount).replace(/,/g, ''));
  const label = asset === 'usdc' ? fund.subscriptionAsset : fund.unitCode;
  const badAddress = to.length > 0 && !/^[GC][A-Z2-7]{55}$/.test(to.trim());
  const invalid = !Number.isFinite(parsed) || parsed <= 0 || parsed > held || badAddress || !to;

  return (
    <Panel title="Send">
      <div className="stack">
        <div className="grid grid--2" style={{ gap: '1rem' }}>
          <div>
            <label htmlFor="asset">Asset</label>
            <select
              id="asset"
              value={asset}
              onChange={(event) => setAsset(event.target.value as 'usdc' | 'units')}
            >
              <option value="usdc">
                {fund.subscriptionAsset} — {money(wallet.balances.usdc)} available
              </option>
              <option value="units">
                {fund.unitCode} — {money(wallet.balances.units)} held
              </option>
            </select>
          </div>
          <div>
            <label htmlFor="send-amount">Amount</label>
            <input
              id="send-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </div>
        <div>
          <label htmlFor="to">To</label>
          <input
            id="to"
            type="text"
            placeholder="G… or C…"
            value={to}
            aria-invalid={badAddress}
            onChange={(event) => setTo(event.target.value)}
            className="mono"
          />
          {badAddress ? (
            <p className="field__error">That is not a Stellar address.</p>
          ) : (
            <p className="field__hint">
              Stellar transfers are final. {label} sent to the wrong address cannot be recalled.
            </p>
          )}
        </div>
        <button
          type="button"
          className="button"
          disabled={invalid}
          onClick={() =>
            auth.run({ kind: 'transfer', asset, to: to.trim(), amount: parsed.toFixed(2) })
          }
        >
          Send with your passkey
        </button>
      </div>
    </Panel>
  );
}

function DevicesPanel({
  data,
  wallet,
  auth,
}: {
  data: PageData;
  wallet: WalletState;
  auth: ReturnType<typeof useAuthorization>;
}) {
  const { fund, rpId } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const device = typeof window === 'undefined' ? null : storedDevice();

  async function addDevice() {
    setBusy(true);
    setError(null);
    try {
      const created = await createPasskey(rpId, fund.manager, investorHandle());
      // Authorized by a passkey the wallet already trusts — adding a device is
      // itself a transaction the existing device has to approve.
      await auth.run({
        kind: 'addPasskey',
        credentialId: created.credentialId,
        publicKey: created.publicKey,
        label: 'Added device',
      });
    } catch (thrown) {
      setError(readableError(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Devices" aside={<span className="pill">{wallet.passkeys} registered</span>}>
      <div className="stack">
        <p style={{ marginBottom: 0 }}>
          Each registered passkey can approve payments from this account. Add one before you need
          it: a second device is the whole recovery story, because nobody — including us — can
          reissue the first.
        </p>
        {device ? (
          <p className="fine" style={{ margin: 0 }}>
            This browser holds <span className="mono">{device.credentialId.slice(0, 12)}…</span>
          </p>
        ) : null}
        <div className="actions">
          <button type="button" className="button button--quiet" onClick={addDevice} disabled={busy}>
            {busy ? 'Creating…' : 'Add this device’s passkey'}
          </button>
          {wallet.passkeys > 1 && device ? (
            <button
              type="button"
              className="button button--danger"
              onClick={() =>
                auth.run({
                  kind: 'removePasskey',
                  credentialId: device.credentialId,
                  label: 'This device',
                })
              }
            >
              Revoke this device
            </button>
          ) : null}
        </div>
        {wallet.passkeys === 1 ? (
          <p className="fine" style={{ margin: 0 }}>
            The last passkey cannot be revoked — the account refuses it, because that would not
            revoke a device, it would destroy the account.
          </p>
        ) : null}
        {error ? (
          <p className="field__error" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function CreditPanel({ fund }: { fund: PageData['fund'] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel title="Credit your account" variant="sunk">
      <p>
        On the live fund this is a wire arriving and clearing. On the test network it is a transfer
        from Calder’s own test float, which is why it takes a few seconds and no bank.
      </p>
      <div className="actions">
        {['100000.00', '500000.00'].map((amount) => (
          <button
            key={amount}
            type="button"
            className="button button--quiet"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await credit(amount);
                location.reload();
              } catch (thrown) {
                setError(readableError(thrown));
                setBusy(false);
              }
            }}
          >
            {busy ? 'Clearing…' : `Receive ${money(amount)} ${fund.subscriptionAsset}`}
          </button>
        ))}
      </div>
      {error ? (
        <p className="field__error" style={{ marginBottom: 0 }}>
          {error}
        </p>
      ) : null}
    </Panel>
  );
}

function NoAccount() {
  return (
    <section className="band">
      <div className="page measure">
        <p className="eyebrow">No account</p>
        <h1>There is no account on this browser.</h1>
        <p className="lede">Open one with a passkey, or sign in with the one you have.</p>
        <Link href="/open" className="button">
          Open an account
        </Link>
      </div>
    </section>
  );
}
