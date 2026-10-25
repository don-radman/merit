/**
 * Does an opening (v, r) match a commitment on chain?
 *
 *   node scripts/conf-check.mjs <v> <r> <commitment-hex>   -> exit 0 if it does
 *
 * Used to decide whether a confidential transfer landed. Parsing the CLI's
 * output is not good enough: a transfer that succeeded was once reported as
 * rejected, and the rollback that followed corrupted the opening. A Pedersen
 * commitment is v*G + r*H, so recomputing it answers the question with no
 * dependence on how any tool formats its output.
 */
import { commit, pointToBytes } from 'stellar-confidential-token-sdk';
const [v, r, chain] = process.argv.slice(2);
const mine = Buffer.from(pointToBytes(commit(BigInt(v), BigInt(r)))).toString('hex');
process.exit(mine === chain ? 0 : 1);
