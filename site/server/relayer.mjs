/**
 * The fee relayer, and the passkey signing pipeline.
 *
 * ## Who holds what
 *
 * The investor holds a passkey and nothing else — no secret key, no seed
 * phrase, no XLM. The relayer holds a funded Stellar account and no passkey.
 * Neither can move the investor's money alone:
 *
 *   * The relayer pays fees and submits transactions. Every transaction that
 *     touches the investor's wallet carries a Soroban authorization entry the
 *     relayer cannot produce, because producing it needs a WebAuthn assertion
 *     from the investor's secure element over that exact transaction's payload.
 *   * The investor's passkey authorizes, but cannot pay. Without the relayer
 *     their authorization goes nowhere.
 *
 * So the relayer is a payer, not a custodian. The worst it can do is refuse
 * to submit — which is the right amount of power for the piece of
 * infrastructure that exists purely so an investor never has to buy XLM
 * before they can buy a fund.
 *
 * ## Why signing takes two round trips
 *
 * The thing a passkey signs is not the transaction; it is the 32-byte Soroban
 * authorization payload, which is derived from the invocation tree, a nonce
 * the network picks, the network id, and an expiry ledger. That payload only
 * exists after simulation. So:
 *
 *   1. `prepare` builds the call, simulates it, and derives the payload. The
 *      payload goes to the browser as the WebAuthn challenge.
 *   2. The browser asks the secure element to sign that challenge.
 *   3. `submit` puts the assertion into the same authorization entry — same
 *      nonce, same expiry, so the same payload — re-simulates to prove the
 *      wallet accepts it, and submits.
 *
 * Step 3 re-simulating is deliberate: `__check_auth` runs during simulation,
 * so a bad assertion fails before a fee is spent and with a usable error,
 * rather than landing on chain as a failed transaction.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  Address,
  Contract,
  Operation,
  StrKey,
  TransactionBuilder,
  authorizeEntry,
  buildAuthorizationEntryPreimage,
  hash,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { CONTRACTS, FUND, NETWORK, rpIdHash } from './config.mjs';
import { addr, group, i128, read, relayerKeypair, server, str, toDecimal, toStroops } from './chain.mjs';

const BASE_FEE = '1000000'; // 0.1 XLM ceiling; simulation sets the real cost.
/** How many ledgers a prepared authorization stays valid for (~10 min). */
const AUTH_TTL_LEDGERS = 120;

// ---------------------------------------------------------------------------
// Deterministic wallet addresses
// ---------------------------------------------------------------------------

/**
 * A wallet's address is derived from the credential that owns it.
 *
 * salt = sha256(credentialId), deployer = the relayer. That makes the mapping
 * from passkey to wallet pure arithmetic, so "sign in" needs no database and
 * no session cookie: the browser produces an assertion, the server derives the
 * address, and the chain says whether it exists. There is nothing to lose, and
 * nothing to breach.
 */
export function saltFor(credentialId) {
  return createHash('sha256').update(Buffer.from(credentialId)).digest();
}

export function walletAddressFor(credentialId) {
  const networkId = hash(Buffer.from(NETWORK.passphrase));
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(relayerKeypair().publicKey()).toScAddress(),
          salt: saltFor(credentialId),
        }),
      ),
    }),
  );
  return StrKey.encodeContract(hash(preimage.toXDR()));
}

// ---------------------------------------------------------------------------
// Submitting as the relayer
// ---------------------------------------------------------------------------

async function sendAsRelayer(operation, { auth } = {}) {
  const keypair = relayerKeypair();
  const account = await server.getAccount(keypair.publicKey());
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(operation)
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) {
    const error = new Error(sim.error);
    error.simulation = sim.error;
    throw error;
  }

  const prepared = rpc.assembleTransaction(built, sim).build();
  prepared.sign(keypair);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') {
    throw new Error(`submission rejected: ${JSON.stringify(sent.errorResult?.result?.()  ?? sent.status)}`);
  }

  let got = await server.getTransaction(sent.hash);
  const deadline = Date.now() + 45_000;
  while (got.status === 'NOT_FOUND' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 900));
    got = await server.getTransaction(sent.hash);
  }
  if (got.status !== 'SUCCESS') {
    throw new Error(`transaction ${sent.hash} ended ${got.status}`);
  }
  return { hash: sent.hash, result: got.returnValue, auth };
}

// ---------------------------------------------------------------------------
// Account opening
// ---------------------------------------------------------------------------

/**
 * Deploy one investor's wallet, with their passkey as its only signer.
 *
 * The relayer pays, which is why opening an account costs the investor
 * nothing and asks them for nothing except a fingerprint.
 */
export async function deployWallet({ credentialId, publicKey }) {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error('expected a 65-byte uncompressed secp256r1 public key');
  }
  const expected = walletAddressFor(credentialId);
  if (await walletDeployed(expected)) {
    return { address: expected, hash: null, alreadyExisted: true };
  }

  const op = Operation.createCustomContract({
    address: Address.fromString(relayerKeypair().publicKey()),
    wasmHash: Buffer.from(CONTRACTS.passkeyWasmHash, 'hex'),
    salt: saltFor(credentialId),
    constructorArgs: [
      nativeToScVal(rpIdHash(), { type: 'bytes' }),
      nativeToScVal(Buffer.from(credentialId), { type: 'bytes' }),
      nativeToScVal(Buffer.from(publicKey), { type: 'bytes' }),
    ],
  });

  const { hash: txHash } = await sendAsRelayer(op);
  return { address: expected, hash: txHash, alreadyExisted: false };
}

export async function walletDeployed(address) {
  try {
    return Number(await read(address, 'signers')) > 0;
  } catch {
    return false;
  }
}

/**
 * Credit the wallet with test USDC.
 *
 * Stands in for a wire arriving and clearing. The float moves from the site's
 * own balance — a plain SAC transfer the relayer authorizes with its own key —
 * so the web server never needs the issuer's minting key to put money in an
 * investor's hands. In production this endpoint is replaced by a bank rail and
 * a reconciliation, and nothing else in the flow changes.
 *
 * Worth noting what is NOT needed here: the wallet is a contract address, so
 * it holds a classic asset with no trustline and no setup transaction. An
 * investor's account is ready to be paid the moment it exists.
 */
export async function creditSubscriptionAccount({ address, amount }) {
  const op = new Contract(CONTRACTS.usdc).call(
    'transfer',
    addr(relayerKeypair().publicKey()),
    addr(address),
    i128(toStroops(amount)),
  );
  return sendAsRelayer(op);
}

// ---------------------------------------------------------------------------
// Intents — the only things a passkey is ever asked to authorize
// ---------------------------------------------------------------------------

/**
 * Turn an intent into the contract call it means, plus the sentence the
 * investor is shown before they touch the sensor.
 *
 * The summary is not decoration. A passkey prompt says only "use your
 * fingerprint"; everything the investor knows about what they are approving,
 * they know from this screen. So the summary is built from the same values
 * that go into the operation, in one place, rather than written separately in
 * the UI where the two could drift.
 */
export function operationFor(intent, walletAddress) {
  switch (intent.kind) {
    case 'subscribe': {
      const stroops = toStroops(intent.amount);
      return {
        op: new Contract(CONTRACTS.rails).call(
          'subscribe',
          addr(walletAddress),
          str(intent.code),
          i128(stroops),
        ),
        summary: {
          title: `Subscribe ${group(toDecimal(stroops))} USDC`,
          lines: [
            [FUND.name, `${group(toDecimal(stroops))} ${FUND.unitCode}`],
            ['Introduced by', intent.introducerName ?? intent.code],
            ['Unit price', `${FUND.unitPrice} USDC`],
          ],
          caution: 'This moves USDC out of your wallet and issues fund units to it.',
        },
      };
    }
    case 'transfer': {
      const stroops = toStroops(intent.amount);
      const token = intent.asset === 'units' ? CONTRACTS.unit : CONTRACTS.usdc;
      const label = intent.asset === 'units' ? FUND.unitCode : 'USDC';
      if (!StrKey.isValidEd25519PublicKey(intent.to) && !StrKey.isValidContract(intent.to)) {
        throw new Error('that destination is not a Stellar address');
      }
      return {
        op: new Contract(token).call('transfer', addr(walletAddress), addr(intent.to), i128(stroops)),
        summary: {
          title: `Send ${group(toDecimal(stroops))} ${label}`,
          lines: [
            ['Amount', `${group(toDecimal(stroops))} ${label}`],
            ['To', intent.to],
          ],
          caution: 'Transfers on Stellar are final. Check the destination.',
        },
      };
    }
    case 'addPasskey': {
      return {
        op: new Contract(walletAddress).call(
          'add_signer',
          nativeToScVal(Buffer.from(intent.credentialId, 'base64url'), { type: 'bytes' }),
          nativeToScVal(Buffer.from(intent.publicKey, 'base64url'), { type: 'bytes' }),
        ),
        summary: {
          title: 'Add a device to this wallet',
          lines: [['Device', intent.label ?? 'New passkey']],
          caution: 'The new device will be able to approve payments from this wallet.',
        },
      };
    }
    case 'removePasskey': {
      return {
        op: new Contract(walletAddress).call(
          'remove_signer',
          nativeToScVal(Buffer.from(intent.credentialId, 'base64url'), { type: 'bytes' }),
        ),
        summary: {
          title: 'Remove a device from this wallet',
          lines: [['Device', intent.label ?? 'Passkey']],
          caution: 'That device will no longer be able to approve anything.',
        },
      };
    }
    case 'claim': {
      return {
        op: new Contract(CONTRACTS.rails).call('claim', str(intent.code)),
        summary: {
          title: 'Collect settled introductions',
          lines: [['Code', intent.code]],
          caution: 'This marks every vested introduction as settled.',
        },
      };
    }
    default:
      throw new Error(`unknown intent: ${intent.kind}`);
  }
}

// ---------------------------------------------------------------------------
// Phase 1 — prepare
// ---------------------------------------------------------------------------

/**
 * Pending authorizations, keyed by a random id.
 *
 * In memory on purpose: a prepared authorization is worthless on its own (it
 * is an unsigned entry), expires in ~10 minutes, and losing it costs a user
 * one retry. Persisting it would add a database for no security and no
 * convenience. A multi-process deployment would need shared storage, which is
 * the one thing this would have to change.
 */
const pending = new Map();

function sweep() {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [id, entry] of pending) if (entry.createdAt < cutoff) pending.delete(id);
}

export async function prepare({ walletAddress, intent }) {
  sweep();
  const { op, summary } = operationFor(intent, walletAddress);

  const keypair = relayerKeypair();
  const account = await server.getAccount(keypair.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK.passphrase })
    .addOperation(op)
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    const error = new Error(sim.error);
    error.simulation = sim.error;
    throw error;
  }

  const entries = sim.result?.auth ?? [];
  // The entry this wallet has to authorize. A subscribe produces exactly one,
  // with the USDC transfer nested inside it — so one fingerprint covers the
  // whole tree rather than prompting per token movement.
  const index = entries.findIndex((e) => {
    try {
      return Address.fromScAddress(e.credentials().address().address()).toString() === walletAddress;
    } catch {
      return false;
    }
  });
  if (index === -1) {
    throw new Error('simulation produced no authorization entry for this wallet');
  }

  const latest = await server.getLatestLedger();
  const validUntilLedger = latest.sequence + AUTH_TTL_LEDGERS;
  const entry = entries[index];
  const preimage = buildAuthorizationEntryPreimage(entry, validUntilLedger, NETWORK.passphrase);
  const challenge = hash(preimage.toXDR());

  const requestId = randomUUID();
  pending.set(requestId, {
    createdAt: Date.now(),
    walletAddress,
    intent,
    entryXdr: entry.toXDR('base64'),
    validUntilLedger,
    summary,
  });

  return {
    requestId,
    /** The WebAuthn challenge: this transaction's authorization payload. */
    challenge: challenge.toString('base64url'),
    summary,
    validUntilLedger,
  };
}

// ---------------------------------------------------------------------------
// Phase 2 — submit
// ---------------------------------------------------------------------------

/**
 * The shape the wallet contract's `__check_auth` expects.
 *
 * A `#[contracttype]` struct is an ScMap whose keys are **Symbols**, sorted by
 * their bytes. Passing a plain object to `nativeToScVal` produces String keys
 * instead, and the host rejects that with `Error(Value, UnexpectedType)` deep
 * inside the SDK's own struct unpacking — a long way from anything that
 * mentions keys. So the map is built explicitly here: symbol keys, bytes
 * values, sorted by field name, which for ASCII is the byte order the host
 * requires.
 */
function assertionToScVal(assertion) {
  const fields = {
    authenticator_data: Buffer.from(assertion.authenticatorData, 'base64url'),
    client_data_json: Buffer.from(assertion.clientDataJSON, 'base64url'),
    credential_id: Buffer.from(assertion.credentialId, 'base64url'),
    signature: Buffer.from(assertion.signature, 'base64url'),
  };
  return xdr.ScVal.scvMap(
    Object.keys(fields)
      .sort()
      .map(
        (name) =>
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol(name),
            val: xdr.ScVal.scvBytes(fields[name]),
          }),
      ),
  );
}

export async function submit({ requestId, assertion }) {
  const held = pending.get(requestId);
  if (!held) throw new Error('that authorization has expired — please try again');
  pending.delete(requestId);

  if (Buffer.from(assertion.signature, 'base64url').length !== 64) {
    throw new Error('expected a 64-byte r||s signature; the client must unwrap the DER');
  }

  const entry = xdr.SorobanAuthorizationEntry.fromXDR(held.entryXdr, 'base64');
  // Same entry, same nonce, same expiry ledger — so the payload the secure
  // element signed is the payload the host will derive.
  const signed = await authorizeEntry(
    entry,
    async () => ({ signatureScVal: assertionToScVal(assertion) }),
    held.validUntilLedger,
    NETWORK.passphrase,
  );

  const { op } = operationFor(held.intent, held.walletAddress);
  const func = op.body().invokeHostFunctionOp().hostFunction();
  const authorized = Operation.invokeHostFunction({ func, auth: [signed] });

  const result = await sendAsRelayer(authorized);
  return { hash: result.hash, summary: held.summary, intent: held.intent };
}

export { pending as _pendingAuthorizations };
