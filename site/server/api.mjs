/**
 * The site's API.
 *
 * Four kinds of endpoint, and the distinction matters:
 *
 *   * reads, which anyone may call because they return public chain state;
 *   * session, which records WHICH public address a browser is looking at;
 *   * prepare/submit, the two halves of a passkey authorization;
 *   * credit, the testnet stand-in for a wire arriving.
 *
 * Nothing here can move an investor's money on its own. `submit` only
 * forwards an assertion the investor's secure element produced over that
 * exact transaction; without one, the wallet refuses and the chain agrees.
 */
import { Router } from 'express';
import { nativeToScVal } from '@stellar/stellar-sdk';
import { CONTRACTS, FUND, NETWORK, RP } from './config.mjs';
import { activity, balances, book, introducer, positionsFor, read, relayerKeypair } from './chain.mjs';
import {
  creditSubscriptionAccount,
  deployWallet,
  prepare,
  submit,
  walletAddressFor,
  walletDeployed,
} from './relayer.mjs';
import { readSession } from './loaders.mjs';
import { fromBase64Url } from '../src/wallet/webauthn-sig.mjs';

/** A year — the cookie holds a public address, so nothing expires meaningfully. */
const COOKIE = { httpOnly: true, sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 * 1000, path: '/' };

/** The float a new testnet account is credited with, as a cleared wire. */
const OPENING_CREDIT = '250000.00';

export function api() {
  const router = Router();

  const wrap = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      // Surface the chain's own words. A Soroban error like
      // `Error(Contract, #5)` is far more useful to show than "failed", and
      // the screens map the ones they know about to a sentence.
      const message = String(error?.message ?? error);
      console.error(`[api] ${req.method} ${req.path}: ${message.split('\n')[0]}`);
      res.status(400).json({ error: message.split('\n')[0], detail: message });
    }
  };

  router.get(
    '/config',
    wrap(async (_req, res) => {
      res.json({
        rpId: RP.id,
        rpName: RP.name,
        fund: FUND,
        network: NETWORK.name,
        contracts: { rails: CONTRACTS.rails, usdc: CONTRACTS.usdc, unit: CONTRACTS.unit },
        relayer: relayerKeypair().publicKey(),
      });
    }),
  );

  /**
   * The same loader output the server rendered from, as JSON.
   *
   * This is what a client-side navigation fetches, so a page's data comes
   * from one place whether it arrived in the HTML or arrived afterwards.
   */
  router.get(
    '/page',
    wrap(async (req, res) => {
      const { parseRoute, PRIVATE_ROUTES } = await import('../src/routes.mjs');
      const { loadRoute } = await import('./loaders.mjs');
      const url = new URL(String(req.query.path ?? '/'), 'http://localhost');
      const route = parseRoute(url.pathname);
      const session = readSession(req.headers.cookie);
      if (PRIVATE_ROUTES.has(route.name) && !session.walletAddress) {
        return res.json({ redirect: '/open' });
      }
      res.json({ route, data: await loadRoute(route, session) });
    }),
  );

  router.get(
    '/introducer/:code',
    wrap(async (req, res) => {
      const found = await introducer(req.params.code);
      if (!found) return res.status(404).json({ error: 'No adviser holds that code.' });
      res.json(found);
    }),
  );

  // -- session ------------------------------------------------------------

  /**
   * Open an account: deploy a wallet whose only signer is this passkey.
   *
   * The credential was created in the browser moments ago and its public key
   * is all the server receives. There is no password to store, no recovery
   * email, and nothing here worth stealing.
   */
  router.post(
    '/wallet/open',
    wrap(async (req, res) => {
      const credentialId = fromBase64Url(req.body.credentialId);
      const publicKey = fromBase64Url(req.body.publicKey);
      const deployed = await deployWallet({ credentialId, publicKey });

      // Credit the opening float straight away, so the account the investor
      // lands on is one they can actually subscribe from.
      let credit = null;
      if (!deployed.alreadyExisted) {
        credit = await creditSubscriptionAccount({
          address: deployed.address,
          amount: OPENING_CREDIT,
        }).catch((e) => ({ error: String(e.message) }));
      }

      res.cookie('calder_wallet', deployed.address, COOKIE);
      if (req.body.code) res.cookie('calder_code', req.body.code, COOKIE);
      res.json({ ...deployed, credit, balances: await balances(deployed.address) });
    }),
  );

  /**
   * Sign in. Derives the wallet address from the credential the authenticator
   * just produced and asks the chain whether it exists — so there is no user
   * table, and nothing to breach.
   */
  router.post(
    '/session',
    wrap(async (req, res) => {
      const address = walletAddressFor(fromBase64Url(req.body.credentialId));
      if (!(await walletDeployed(address))) {
        return res.status(404).json({ error: 'That passkey has no account here yet.', address });
      }
      res.cookie('calder_wallet', address, COOKIE);
      res.json({ address, balances: await balances(address) });
    }),
  );

  router.post(
    '/session/clear',
    wrap(async (_req, res) => {
      res.clearCookie('calder_wallet', { path: '/' });
      res.json({ ok: true });
    }),
  );

  router.post(
    '/session/code',
    wrap(async (req, res) => {
      res.cookie('calder_code', req.body.code, COOKIE);
      res.json({ ok: true });
    }),
  );

  // -- reads --------------------------------------------------------------

  router.get(
    '/wallet',
    wrap(async (req, res) => {
      const { walletAddress } = readSession(req.headers.cookie);
      if (!walletAddress) return res.status(401).json({ error: 'No account on this browser.' });
      const [held, acts, positions, passkeys] = await Promise.all([
        balances(walletAddress),
        activity(walletAddress).catch(() => []),
        positionsFor(walletAddress).catch(() => []),
        read(walletAddress, 'signers').catch(() => 0),
      ]);
      res.json({ address: walletAddress, balances: held, activity: acts, positions, passkeys: Number(passkeys) });
    }),
  );

  router.get(
    '/book/:code',
    wrap(async (req, res) => {
      res.json(await book(req.params.code));
    }),
  );

  router.get(
    '/passkey/:credentialId',
    wrap(async (req, res) => {
      const { walletAddress } = readSession(req.headers.cookie);
      if (!walletAddress) return res.status(401).json({ error: 'No account on this browser.' });
      const known = await read(walletAddress, 'has_signer', [
        nativeToScVal(Buffer.from(req.params.credentialId, 'base64url'), { type: 'bytes' }),
      ]).catch(() => false);
      res.json({ registered: Boolean(known) });
    }),
  );

  // -- authorizing ---------------------------------------------------------

  /** Phase one: build the call, simulate it, hand back the challenge. */
  router.post(
    '/tx/prepare',
    wrap(async (req, res) => {
      const { walletAddress } = readSession(req.headers.cookie);
      if (!walletAddress) return res.status(401).json({ error: 'No account on this browser.' });
      res.json(await prepare({ walletAddress, intent: req.body.intent }));
    }),
  );

  /** Phase two: put the assertion in the entry and submit. */
  router.post(
    '/tx/submit',
    wrap(async (req, res) => {
      const result = await submit({ requestId: req.body.requestId, assertion: req.body.assertion });
      const { walletAddress } = readSession(req.headers.cookie);
      res.json({ ...result, balances: walletAddress ? await balances(walletAddress) : null });
    }),
  );

  /** The testnet stand-in for a wire arriving and clearing. */
  router.post(
    '/credit',
    wrap(async (req, res) => {
      const { walletAddress } = readSession(req.headers.cookie);
      if (!walletAddress) return res.status(401).json({ error: 'No account on this browser.' });
      const amount = String(req.body.amount ?? OPENING_CREDIT);
      const result = await creditSubscriptionAccount({ address: walletAddress, amount });
      res.json({ hash: result.hash, balances: await balances(walletAddress) });
    }),
  );

  return router;
}
