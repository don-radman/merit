import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CBG7RUBLJTIDEY2CQNW2OV2NRRL2LNUQ753DH7IHLHAVVDZTPFMDVQQC",
  }
} as const

export const Errors = {
  1: {message:"AlreadyInitialised"},
  2: {message:"NotInitialised"},
  3: {message:"UnknownCode"},
  4: {message:"CodeTaken"},
  5: {message:"BelowMinimum"},
  6: {message:"NothingToClaim"},
  7: {message:"NotYetVested"},
  8: {message:"NotRecoverable"},
  /**
   * Reserved. Proof checking now lives inside the confidential token.
   */
  9: {message:"InvalidProof"}
}


export interface Introducer {
  code: string;
  display_name: string;
  owner: string;
}


export interface Attribution {
  at: u64;
  code: string;
  fee: i128;
  id: u32;
  investor: string;
  /**
 * Clawed back by the issuer because the investor redeemed early.
 */
recovered: boolean;
  settled: boolean;
  subscribed: i128;
  units: i128;
  /**
 * When the fee becomes withdrawable. Before this the issuer can recover it.
 */
vests_at: u64;
}

export interface Client {
  /**
   * Construct and simulate a get_book transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One introducer's own book.
   */
  get_book: ({code}: {code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Attribution>>>

  /**
   * Construct and simulate a claim_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pay out the vested portion. Rejects `NotYetVested` when a fee exists but
   * is still inside its window — a different sentence on screen from having
   * earned nothing at all.
   */
  claim_fee: ({code}: {code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a claimable transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdrawable right now: vested, not recovered, not already paid.
   */
  claimable: ({code}: {code: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a subscribe transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Subscribe through an introducer's code. Pulls USDC from the investor,
   * issues units, and records the attribution with its vesting deadline.
   */
  subscribe: ({investor, code, usdc_amount}: {investor: string, code: string, usdc_amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Attribution>>>

  /**
   * Construct and simulate a get_ledger transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Every attribution. Issuer view.
   */
  get_ledger: (options?: MethodOptions) => Promise<AssembledTransaction<Array<Attribution>>>

  /**
   * Construct and simulate a initialise transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialise: ({issuer, usdc, unit, trail_fee_bps, vesting_window_secs, minimum, confidential_token}: {issuer: string, usdc: string, unit: string, trail_fee_bps: u32, vesting_window_secs: u64, minimum: i128, confidential_token: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a recover_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Issuer recovers a fee whose investor redeemed inside the window.
   * All-or-nothing; real chargeback is pro-rata — see DECISIONS.md D9.
   */
  recover_fee: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_introducer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_introducer: ({code}: {code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Introducer>>>

  /**
   * Construct and simulate a register_introducer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Register an introducer and claim a code. Anyone may register; the code
   * is first-come, and the owner is who gets paid.
   */
  register_introducer: ({owner, code, display_name}: {owner: string, code: string, display_name: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Introducer>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAAAAAAAASQWxyZWFkeUluaXRpYWxpc2VkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXNlZAAAAAAAAgAAAAAAAAALVW5rbm93bkNvZGUAAAAAAwAAAAAAAAAJQ29kZVRha2VuAAAAAAAABAAAAAAAAAAMQmVsb3dNaW5pbXVtAAAABQAAAAAAAAAOTm90aGluZ1RvQ2xhaW0AAAAAAAYAAAAAAAAADE5vdFlldFZlc3RlZAAAAAcAAAAAAAAADk5vdFJlY292ZXJhYmxlAAAAAAAIAAAAQVJlc2VydmVkLiBQcm9vZiBjaGVja2luZyBub3cgbGl2ZXMgaW5zaWRlIHRoZSBjb25maWRlbnRpYWwgdG9rZW4uAAAAAAAADEludmFsaWRQcm9vZgAAAAk=",
        "AAAAAQAAAAAAAAAAAAAACkludHJvZHVjZXIAAAAAAAMAAAAAAAAABGNvZGUAAAAQAAAAAAAAAAxkaXNwbGF5X25hbWUAAAAQAAAAAAAAAAVvd25lcgAAAAAAABM=",
        "AAAAAQAAAAAAAAAAAAAAC0F0dHJpYnV0aW9uAAAAAAoAAAAAAAAAAmF0AAAAAAAGAAAAAAAAAARjb2RlAAAAEAAAAAAAAAADZmVlAAAAAAsAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAhpbnZlc3RvcgAAABMAAAA+Q2xhd2VkIGJhY2sgYnkgdGhlIGlzc3VlciBiZWNhdXNlIHRoZSBpbnZlc3RvciByZWRlZW1lZCBlYXJseS4AAAAAAAlyZWNvdmVyZWQAAAAAAAABAAAAAAAAAAdzZXR0bGVkAAAAAAEAAAAAAAAACnN1YnNjcmliZWQAAAAAAAsAAAAAAAAABXVuaXRzAAAAAAAACwAAAElXaGVuIHRoZSBmZWUgYmVjb21lcyB3aXRoZHJhd2FibGUuIEJlZm9yZSB0aGlzIHRoZSBpc3N1ZXIgY2FuIHJlY292ZXIgaXQuAAAAAAAACHZlc3RzX2F0AAAABg==",
        "AAAAAAAAABpPbmUgaW50cm9kdWNlcidzIG93biBib29rLgAAAAAACGdldF9ib29rAAAAAQAAAAAAAAAEY29kZQAAABAAAAABAAAD6gAAB9AAAAALQXR0cmlidXRpb24A",
        "AAAAAAAAAKlQYXkgb3V0IHRoZSB2ZXN0ZWQgcG9ydGlvbi4gUmVqZWN0cyBgTm90WWV0VmVzdGVkYCB3aGVuIGEgZmVlIGV4aXN0cyBidXQKaXMgc3RpbGwgaW5zaWRlIGl0cyB3aW5kb3cg4oCUIGEgZGlmZmVyZW50IHNlbnRlbmNlIG9uIHNjcmVlbiBmcm9tIGhhdmluZwplYXJuZWQgbm90aGluZyBhdCBhbGwuAAAAAAAACWNsYWltX2ZlZQAAAAAAAAEAAAAAAAAABGNvZGUAAAAQAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAEBXaXRoZHJhd2FibGUgcmlnaHQgbm93OiB2ZXN0ZWQsIG5vdCByZWNvdmVyZWQsIG5vdCBhbHJlYWR5IHBhaWQuAAAACWNsYWltYWJsZQAAAAAAAAEAAAAAAAAABGNvZGUAAAAQAAAAAQAAAAs=",
        "AAAAAAAAAIpTdWJzY3JpYmUgdGhyb3VnaCBhbiBpbnRyb2R1Y2VyJ3MgY29kZS4gUHVsbHMgVVNEQyBmcm9tIHRoZSBpbnZlc3RvciwKaXNzdWVzIHVuaXRzLCBhbmQgcmVjb3JkcyB0aGUgYXR0cmlidXRpb24gd2l0aCBpdHMgdmVzdGluZyBkZWFkbGluZS4AAAAAAAlzdWJzY3JpYmUAAAAAAAADAAAAAAAAAAhpbnZlc3RvcgAAABMAAAAAAAAABGNvZGUAAAAQAAAAAAAAAAt1c2RjX2Ftb3VudAAAAAALAAAAAQAAA+kAAAfQAAAAC0F0dHJpYnV0aW9uAAAAAAM=",
        "AAAAAAAAAB9FdmVyeSBhdHRyaWJ1dGlvbi4gSXNzdWVyIHZpZXcuAAAAAApnZXRfbGVkZ2VyAAAAAAAAAAAAAQAAA+oAAAfQAAAAC0F0dHJpYnV0aW9uAA==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGlzZQAAAAAABwAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAAR1c2RjAAAAEwAAAAAAAAAEdW5pdAAAABMAAAAAAAAADXRyYWlsX2ZlZV9icHMAAAAAAAAEAAAAAAAAABN2ZXN0aW5nX3dpbmRvd19zZWNzAAAAAAYAAAAAAAAAB21pbmltdW0AAAAACwAAAAAAAAASY29uZmlkZW50aWFsX3Rva2VuAAAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAIVJc3N1ZXIgcmVjb3ZlcnMgYSBmZWUgd2hvc2UgaW52ZXN0b3IgcmVkZWVtZWQgaW5zaWRlIHRoZSB3aW5kb3cuCkFsbC1vci1ub3RoaW5nOyByZWFsIGNoYXJnZWJhY2sgaXMgcHJvLXJhdGEg4oCUIHNlZSBERUNJU0lPTlMubWQgRDkuAAAAAAAAC3JlY292ZXJfZmVlAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAAAAAAAOZ2V0X2ludHJvZHVjZXIAAAAAAAEAAAAAAAAABGNvZGUAAAAQAAAAAQAAA+kAAAfQAAAACkludHJvZHVjZXIAAAAAAAM=",
        "AAAAAAAAAHVSZWdpc3RlciBhbiBpbnRyb2R1Y2VyIGFuZCBjbGFpbSBhIGNvZGUuIEFueW9uZSBtYXkgcmVnaXN0ZXI7IHRoZSBjb2RlCmlzIGZpcnN0LWNvbWUsIGFuZCB0aGUgb3duZXIgaXMgd2hvIGdldHMgcGFpZC4AAAAAAAATcmVnaXN0ZXJfaW50cm9kdWNlcgAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABGNvZGUAAAAQAAAAAAAAAAxkaXNwbGF5X25hbWUAAAAQAAAAAQAAA+kAAAfQAAAACkludHJvZHVjZXIAAAAAAAM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_book: this.txFromJSON<Array<Attribution>>,
        claim_fee: this.txFromJSON<Result<i128>>,
        claimable: this.txFromJSON<i128>,
        subscribe: this.txFromJSON<Result<Attribution>>,
        get_ledger: this.txFromJSON<Array<Attribution>>,
        initialise: this.txFromJSON<Result<void>>,
        recover_fee: this.txFromJSON<Result<i128>>,
        get_introducer: this.txFromJSON<Result<Introducer>>,
        register_introducer: this.txFromJSON<Result<Introducer>>
  }
}