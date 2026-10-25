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
    contractId: "CC6RQUT2FCWQS26ESG3TL4MG2TPPXGUTTSCPV4KOVBRD3OCCOG7FRA7C",
  }
} as const

export const Errors = {
  1: {message:"AlreadyInitialised"},
  2: {message:"NotInitialised"},
  3: {message:"UnknownCode"},
  4: {message:"CodeTaken"},
  5: {message:"BelowMinimum"},
  /**
   * No introduction of this introducer's is vested and unclaimed.
   */
  6: {message:"NothingToClaim"},
  /**
   * Introductions exist but none has vested yet.
   */
  7: {message:"NotYetVested"},
  8: {message:"NotRecoverable"}
}


export interface Introducer {
  code: string;
  display_name: string;
  owner: string;
}


/**
 * One introduction. Carries the AUM the commission is owed on, never the
 * commission itself.
 */
export interface Attribution {
  at: u64;
  /**
 * Marked when the introducer claims it; the issuer then settles off-chain.
 */
claimed: boolean;
  code: string;
  id: u32;
  investor: string;
  /**
 * Clawed back by the issuer because the investor redeemed early.
 */
recovered: boolean;
  subscribed: i128;
  units: i128;
  /**
 * When the commission on this introduction becomes payable.
 */
vests_at: u64;
}

export interface Client {
  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mark every vested, unclaimed introduction of this introducer's as
   * claimed, and publish their ids. The issuer's settlement service applies
   * the private rate and pays confidentially.
   * 
   * The event carries ids only. Publishing a total here would hand an
   * observer the subscription basis in one number and put us back where we
   * started.
   */
  claim: ({code}: {code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a recover transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Issuer recovers an introduction whose investor redeemed inside the
   * window. All-or-nothing; real chargeback is pro-rata — see DECISIONS.md
   * D9. No amount is involved: the issuer simply never settles it.
   */
  recover: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_book transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_book: ({code}: {code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Attribution>>>

  /**
   * Construct and simulate a subscribe transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Subscribe through an introducer's code. Pulls USDC, issues units, and
   * records the introduction with its vesting deadline. No commission is
   * computed here — this contract never sees a rate.
   */
  subscribe: ({investor, code, usdc_amount}: {investor: string, code: string, usdc_amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Attribution>>>

  /**
   * Construct and simulate a get_ledger transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_ledger: (options?: MethodOptions) => Promise<AssembledTransaction<Array<Attribution>>>

  /**
   * Construct and simulate a initialise transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialise: ({issuer, usdc, unit, vesting_window_secs, minimum}: {issuer: string, usdc: string, unit: string, vesting_window_secs: u64, minimum: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_introducer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_introducer: ({code}: {code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Introducer>>>

  /**
   * Construct and simulate a claimable_basis transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The AUM an introducer may currently claim commission on: vested, not
   * recovered, not already claimed. This is a subscription total, NOT a
   * payable amount — turning it into money needs the rate, which lives
   * only with the issuer and that introducer.
   */
  claimable_basis: ({code}: {code: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a register_introducer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
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
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACAAAAAAAAAASQWxyZWFkeUluaXRpYWxpc2VkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXNlZAAAAAAAAgAAAAAAAAALVW5rbm93bkNvZGUAAAAAAwAAAAAAAAAJQ29kZVRha2VuAAAAAAAABAAAAAAAAAAMQmVsb3dNaW5pbXVtAAAABQAAAD1ObyBpbnRyb2R1Y3Rpb24gb2YgdGhpcyBpbnRyb2R1Y2VyJ3MgaXMgdmVzdGVkIGFuZCB1bmNsYWltZWQuAAAAAAAADk5vdGhpbmdUb0NsYWltAAAAAAAGAAAALEludHJvZHVjdGlvbnMgZXhpc3QgYnV0IG5vbmUgaGFzIHZlc3RlZCB5ZXQuAAAADE5vdFlldFZlc3RlZAAAAAcAAAAAAAAADk5vdFJlY292ZXJhYmxlAAAAAAAI",
        "AAAAAQAAAAAAAAAAAAAACkludHJvZHVjZXIAAAAAAAMAAAAAAAAABGNvZGUAAAAQAAAAAAAAAAxkaXNwbGF5X25hbWUAAAAQAAAAAAAAAAVvd25lcgAAAAAAABM=",
        "AAAAAQAAAFlPbmUgaW50cm9kdWN0aW9uLiBDYXJyaWVzIHRoZSBBVU0gdGhlIGNvbW1pc3Npb24gaXMgb3dlZCBvbiwgbmV2ZXIgdGhlCmNvbW1pc3Npb24gaXRzZWxmLgAAAAAAAAAAAAALQXR0cmlidXRpb24AAAAACQAAAAAAAAACYXQAAAAAAAYAAABITWFya2VkIHdoZW4gdGhlIGludHJvZHVjZXIgY2xhaW1zIGl0OyB0aGUgaXNzdWVyIHRoZW4gc2V0dGxlcyBvZmYtY2hhaW4uAAAAB2NsYWltZWQAAAAAAQAAAAAAAAAEY29kZQAAABAAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAhpbnZlc3RvcgAAABMAAAA+Q2xhd2VkIGJhY2sgYnkgdGhlIGlzc3VlciBiZWNhdXNlIHRoZSBpbnZlc3RvciByZWRlZW1lZCBlYXJseS4AAAAAAAlyZWNvdmVyZWQAAAAAAAABAAAAAAAAAApzdWJzY3JpYmVkAAAAAAALAAAAAAAAAAV1bml0cwAAAAAAAAsAAAA5V2hlbiB0aGUgY29tbWlzc2lvbiBvbiB0aGlzIGludHJvZHVjdGlvbiBiZWNvbWVzIHBheWFibGUuAAAAAAAACHZlc3RzX2F0AAAABg==",
        "AAAAAAAAAUZNYXJrIGV2ZXJ5IHZlc3RlZCwgdW5jbGFpbWVkIGludHJvZHVjdGlvbiBvZiB0aGlzIGludHJvZHVjZXIncyBhcwpjbGFpbWVkLCBhbmQgcHVibGlzaCB0aGVpciBpZHMuIFRoZSBpc3N1ZXIncyBzZXR0bGVtZW50IHNlcnZpY2UgYXBwbGllcwp0aGUgcHJpdmF0ZSByYXRlIGFuZCBwYXlzIGNvbmZpZGVudGlhbGx5LgoKVGhlIGV2ZW50IGNhcnJpZXMgaWRzIG9ubHkuIFB1Ymxpc2hpbmcgYSB0b3RhbCBoZXJlIHdvdWxkIGhhbmQgYW4Kb2JzZXJ2ZXIgdGhlIHN1YnNjcmlwdGlvbiBiYXNpcyBpbiBvbmUgbnVtYmVyIGFuZCBwdXQgdXMgYmFjayB3aGVyZSB3ZQpzdGFydGVkLgAAAAAABWNsYWltAAAAAAAAAQAAAAAAAAAEY29kZQAAABAAAAABAAAD6QAAAAQAAAAD",
        "AAAAAAAAAMpJc3N1ZXIgcmVjb3ZlcnMgYW4gaW50cm9kdWN0aW9uIHdob3NlIGludmVzdG9yIHJlZGVlbWVkIGluc2lkZSB0aGUKd2luZG93LiBBbGwtb3Itbm90aGluZzsgcmVhbCBjaGFyZ2ViYWNrIGlzIHByby1yYXRhIOKAlCBzZWUgREVDSVNJT05TLm1kCkQ5LiBObyBhbW91bnQgaXMgaW52b2x2ZWQ6IHRoZSBpc3N1ZXIgc2ltcGx5IG5ldmVyIHNldHRsZXMgaXQuAAAAAAAHcmVjb3ZlcgAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAIZ2V0X2Jvb2sAAAABAAAAAAAAAARjb2RlAAAAEAAAAAEAAAPqAAAH0AAAAAtBdHRyaWJ1dGlvbgA=",
        "AAAAAAAAAL1TdWJzY3JpYmUgdGhyb3VnaCBhbiBpbnRyb2R1Y2VyJ3MgY29kZS4gUHVsbHMgVVNEQywgaXNzdWVzIHVuaXRzLCBhbmQKcmVjb3JkcyB0aGUgaW50cm9kdWN0aW9uIHdpdGggaXRzIHZlc3RpbmcgZGVhZGxpbmUuIE5vIGNvbW1pc3Npb24gaXMKY29tcHV0ZWQgaGVyZSDigJQgdGhpcyBjb250cmFjdCBuZXZlciBzZWVzIGEgcmF0ZS4AAAAAAAAJc3Vic2NyaWJlAAAAAAAAAwAAAAAAAAAIaW52ZXN0b3IAAAATAAAAAAAAAARjb2RlAAAAEAAAAAAAAAALdXNkY19hbW91bnQAAAAACwAAAAEAAAPpAAAH0AAAAAtBdHRyaWJ1dGlvbgAAAAAD",
        "AAAAAAAAAAAAAAAKZ2V0X2xlZGdlcgAAAAAAAAAAAAEAAAPqAAAH0AAAAAtBdHRyaWJ1dGlvbgA=",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGlzZQAAAAAABQAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAAR1c2RjAAAAEwAAAAAAAAAEdW5pdAAAABMAAAAAAAAAE3Zlc3Rpbmdfd2luZG93X3NlY3MAAAAABgAAAAAAAAAHbWluaW11bQAAAAALAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAOZ2V0X2ludHJvZHVjZXIAAAAAAAEAAAAAAAAABGNvZGUAAAAQAAAAAQAAA+kAAAfQAAAACkludHJvZHVjZXIAAAAAAAM=",
        "AAAAAAAAAPdUaGUgQVVNIGFuIGludHJvZHVjZXIgbWF5IGN1cnJlbnRseSBjbGFpbSBjb21taXNzaW9uIG9uOiB2ZXN0ZWQsIG5vdApyZWNvdmVyZWQsIG5vdCBhbHJlYWR5IGNsYWltZWQuIFRoaXMgaXMgYSBzdWJzY3JpcHRpb24gdG90YWwsIE5PVCBhCnBheWFibGUgYW1vdW50IOKAlCB0dXJuaW5nIGl0IGludG8gbW9uZXkgbmVlZHMgdGhlIHJhdGUsIHdoaWNoIGxpdmVzCm9ubHkgd2l0aCB0aGUgaXNzdWVyIGFuZCB0aGF0IGludHJvZHVjZXIuAAAAAA9jbGFpbWFibGVfYmFzaXMAAAAAAQAAAAAAAAAEY29kZQAAABAAAAABAAAACw==",
        "AAAAAAAAAAAAAAATcmVnaXN0ZXJfaW50cm9kdWNlcgAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABGNvZGUAAAAQAAAAAAAAAAxkaXNwbGF5X25hbWUAAAAQAAAAAQAAA+kAAAfQAAAACkludHJvZHVjZXIAAAAAAAM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    claim: this.txFromJSON<Result<u32>>,
        recover: this.txFromJSON<Result<void>>,
        get_book: this.txFromJSON<Array<Attribution>>,
        subscribe: this.txFromJSON<Result<Attribution>>,
        get_ledger: this.txFromJSON<Array<Attribution>>,
        initialise: this.txFromJSON<Result<void>>,
        get_introducer: this.txFromJSON<Result<Introducer>>,
        claimable_basis: this.txFromJSON<i128>,
        register_introducer: this.txFromJSON<Result<Introducer>>
  }
}