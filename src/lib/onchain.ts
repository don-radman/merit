/**
 * The seeded testnet deployment, for linking out of the demo.
 *
 * These are the real contracts the Calder portal reads (DEMO.md, SPIKE.md)
 * and a handful of real transactions on them, so a viewer of the hosted demo
 * can open the Stellar explorer and see the record for themselves. The hosted
 * click-through runs on sample data; these links are the counterpart on chain.
 *
 * Keep this file boring: ids and hashes only. Nothing here is a secret — every
 * value is public on the network.
 */

const EXPLORER = 'https://stellar.expert/explorer/testnet';

export const explorerTx = (hash: string): string => `${EXPLORER}/tx/${hash}`;
export const explorerContract = (id: string): string => `${EXPLORER}/contract/${id}`;
export const explorerAccount = (id: string): string => `${EXPLORER}/account/${id}`;

export const CONTRACTS = {
  /** The attribution ledger: subscribe, settle, recover, get_book, get_ledger. Holds no rate. */
  attribution: 'CDENXKDNNRLQ7F3C7VI3EWFPJBUMO5L6BDV2CZE6LSCP47G5JUGTPJT4',
  /** OpenZeppelin's confidential token wrapping the fee currency. */
  confidentialToken: 'CDHJYRAMWXJXNSSA36YIZFSMPWRBDN2KLLEY5KWLOS2P2JXKXIDSN3YX',
  /** The verifier that checks each settlement proof. */
  verifier: 'CCXDZXDL6KHPB2EBTK7COJ2DFLCYOGE3B2IA5K4RCPW7UZ7DIT4EOTUW',
  /** The auditor registry: who may open a settlement's amount. */
  auditorRegistry: 'CB45BGTIVC256HCUFHY2D42UI3XA2TG2HH3HUTIBZH56SNRWCSEZJWU4',
} as const;

export const ACCOUNTS = {
  /** The fund (issuer of the unit and the fee currency; runs settlement). */
  issuer: 'GA7NPGYR5C2ZP4XM4RPQXSCWO2XRFAPH3YFJUIJAAMWG3WJO6GUXT4YZ',
} as const;

/**
 * Real transactions on the deployment above, by the beat they illustrate.
 * A missing entry means the guide links to the contract instead.
 */
export const TX: Partial<
  Record<
    'initialise' | 'register' | 'subscribe' | 'claim' | 'settle' | 'recover' | 'deposit' | 'confidentialTransfer' | 'proofVerified',
    string
  >
> = {
  /** The fund opening its ledger: issuer, currency, unit, 300s window (25 Oct, 16:09 UTC). */
  initialise: 'b403ef291bf271af93cef7b76d87e1c1f08c799dd9c41ed250fef24e22272033',
  /** An adviser registered with a code. Emits `register`. */
  register: '245828ba7370599c3d013c798f10c1c0aef8ff0480501d5da153228bed9bc5e3',
  /** An investor subscribing through an adviser's code. Emits `subscribe` with the amount. */
  subscribe: 'e107d7862bb6e8f673009f8bf86ca71d74675afd0179166012a0fc8f709f6121',
  /** The adviser's own claim: marks vested rows, emits ids, pays nobody. */
  claim: 'd8eaa9035398d3769c94121a5d339e10134539f3e41cc9e07d2412de8262c069',
  /** The fund's payout run: `settle`, issuer only. Emits ids, not a total. */
  settle: '45b1b0d48cce0a5835580ee8433261c0ab1f8025b629d19d46ae3ee8f4479ea0',
  /** The fund reversing an introduction inside its window. Emits `recovered`. */
  recover: 'd31ef1507b44a1352f07ec6afd71717f8c054e3e5ded367870adccfe3e58ed4d',
  /** The fund topping up its confidential pool. The one event that carries an amount, in the clear. */
  deposit: 'b3f94e3e888a2bc49e0178a1ac11b85110b8fceb008809db64c0d466243a30a6',
  /** A confidential transfer out of the pool. No amount anywhere in it. */
  confidentialTransfer: 'b32cd67addbcbb3a5a1f3b78212126ed5194ceb7411fd5251765308358b50e35',
  /** The deployed verifier accepting an UltraHonk proof (SPIKE.md). */
  proofVerified: 'b4e99c0c336af63b81b09bc19853d3cb2f1949ad15d9b32b6059594075143442',
};
