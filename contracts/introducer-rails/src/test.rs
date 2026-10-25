#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

/// Stands in for OpenZeppelin's confidential token. Records what it was asked
/// to credit, so a test can assert the fee actually left as a deposit rather
/// than a public transfer.
#[contract]
pub struct MockConfidentialToken;

#[contractimpl]
impl MockConfidentialToken {
    pub fn deposit(e: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        e.storage().instance().set(&symbol_short!("last_to"), &to);
        e.storage().instance().set(&symbol_short!("last_amt"), &amount);
    }

    pub fn last_deposit(e: Env) -> (Address, i128) {
        (
            e.storage().instance().get(&symbol_short!("last_to")).unwrap(),
            e.storage().instance().get(&symbol_short!("last_amt")).unwrap_or(0),
        )
    }
}

const DAY: u64 = 86_400;
const WINDOW: u64 = 90 * DAY;

struct Fixture<'a> {
    env: Env,
    cono: Address,
    client: IntroducerRailsClient<'a>,
    usdc: token::Client<'a>,
    issuer: Address,
    introducer: Address,
    investor: Address,
}

fn setup<'a>() -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let introducer = Address::generate(&env);
    let investor = Address::generate(&env);

    let usdc_sac = env.register_stellar_asset_contract_v2(issuer.clone());
    let unit_sac = env.register_stellar_asset_contract_v2(issuer.clone());
    let usdc = token::Client::new(&env, &usdc_sac.address());
    let usdc_admin = token::StellarAssetClient::new(&env, &usdc_sac.address());
    let unit_admin = token::StellarAssetClient::new(&env, &unit_sac.address());

    let cono = env.register(MockConfidentialToken, ());
    let contract_id = env.register(IntroducerRails, ());
    let client = IntroducerRailsClient::new(&env, &contract_id);

    // The investor arrives holding USDC; the contract holds the unit supply.
    usdc_admin.mint(&investor, &2_000_000);
    unit_admin.mint(&contract_id, &10_000_000);

    client.initialise(
        &issuer,
        &usdc_sac.address(),
        &unit_sac.address(),
        &50u32,
        &WINDOW,
        &50_000i128,
        &cono,
    );

    Fixture { env, cono, client, usdc, issuer, introducer, investor }
}

fn code(env: &Env) -> String {
    String::from_str(env, "CALDER-PR7")
}

#[test]
fn subscribe_records_attribution_and_accrues_fee() {
    let f = setup();
    f.client.register_introducer(
        &f.introducer,
        &code(&f.env),
        &String::from_str(&f.env, "Raghunathan Family Office"),
    );

    let a = f.client.subscribe(&f.investor, &code(&f.env), &250_000i128);

    assert_eq!(a.subscribed, 250_000);
    assert_eq!(a.units, 250_000);
    // 50 bps of 250,000 is exactly 1,250 — the arithmetic a reader can check.
    assert_eq!(a.fee, 1_250);
    assert_eq!(a.vests_at, a.at + WINDOW);
    assert!(!a.settled && !a.recovered);

    assert_eq!(f.client.get_book(&code(&f.env)).len(), 1);
    assert_eq!(f.client.get_ledger().len(), 1);
}

#[test]
fn fee_is_not_claimable_until_it_vests() {
    let f = setup();
    f.client.register_introducer(&f.introducer, &code(&f.env), &String::from_str(&f.env, "RFO"));
    f.client.subscribe(&f.investor, &code(&f.env), &250_000i128);

    assert_eq!(f.client.claimable(&code(&f.env)), 0);
    assert_eq!(
        f.client.try_claim_fee(&code(&f.env)),
        Err(Ok(Error::NotYetVested)),
    );

    f.env.ledger().with_mut(|l| l.timestamp += WINDOW + 1);

    assert_eq!(f.client.claimable(&code(&f.env)), 1_250);
    assert_eq!(f.client.claim_fee(&code(&f.env)), 1_250);
    // It arrives as a confidential deposit, so the PUBLIC balance is unchanged.
    assert_eq!(f.usdc.balance(&f.introducer), 0);
    let (to, amount) = MockConfidentialTokenClient::new(&f.env, &f.cono).last_deposit();
    assert_eq!((to, amount), (f.introducer.clone(), 1_250));

    // Paid once, not twice.
    assert_eq!(f.client.claimable(&code(&f.env)), 0);
    assert_eq!(
        f.client.try_claim_fee(&code(&f.env)),
        Err(Ok(Error::NothingToClaim)),
    );
}

#[test]
fn issuer_can_recover_inside_the_window_but_not_after() {
    let f = setup();
    f.client.register_introducer(&f.introducer, &code(&f.env), &String::from_str(&f.env, "RFO"));
    let a = f.client.subscribe(&f.investor, &code(&f.env), &400_000i128);
    assert_eq!(a.fee, 2_000);

    assert_eq!(f.client.recover_fee(&a.id), 2_000);
    // Recovered fees never become claimable.
    f.env.ledger().with_mut(|l| l.timestamp += WINDOW + 1);
    assert_eq!(f.client.claimable(&code(&f.env)), 0);

    // And a second recovery of the same row is refused.
    assert_eq!(f.client.try_recover_fee(&a.id), Err(Ok(Error::NotRecoverable)));
}

#[test]
fn rejects_unknown_codes_and_small_subscriptions() {
    let f = setup();
    f.client.register_introducer(&f.introducer, &code(&f.env), &String::from_str(&f.env, "RFO"));

    assert_eq!(
        f.client.try_subscribe(&f.investor, &String::from_str(&f.env, "NOPE"), &250_000i128),
        Err(Ok(Error::UnknownCode)),
    );
    assert_eq!(
        f.client.try_subscribe(&f.investor, &code(&f.env), &1_000i128),
        Err(Ok(Error::BelowMinimum)),
    );
    assert_eq!(
        f.client.try_register_introducer(&f.issuer, &code(&f.env), &String::from_str(&f.env, "x")),
        Err(Ok(Error::CodeTaken)),
    );
}


#[test]
fn a_claimed_fee_is_deposited_into_the_confidential_token() {
    let f = setup();
    f.client.register_introducer(&f.introducer, &code(&f.env), &String::from_str(&f.env, "RFO"));
    f.client.subscribe(&f.investor, &code(&f.env), &250_000i128);
    f.env.ledger().with_mut(|l| l.timestamp += WINDOW + 1);

    let paid = f.client.claim_fee(&code(&f.env));
    assert_eq!(paid, 1_250);

    // It left as a confidential deposit credited to the introducer, not as a
    // public transfer to their account.
    let mock = MockConfidentialTokenClient::new(&f.env, &f.cono);
    let (to, amount) = mock.last_deposit();
    assert_eq!(to, f.introducer);
    assert_eq!(amount, 1_250);
    assert_eq!(f.usdc.balance(&f.introducer), 0);
}
