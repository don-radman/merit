#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    token, Address, Env,
};

const DAY: u64 = 86_400;
const WINDOW: u64 = 90 * DAY;

struct Fixture<'a> {
    env: Env,
    client: IntroducerRailsClient<'a>,
    usdc: token::Client<'a>,
    contract_id: Address,
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

    let contract_id = env.register(IntroducerRails, ());
    let client = IntroducerRailsClient::new(&env, &contract_id);

    usdc_admin.mint(&investor, &2_000_000);
    unit_admin.mint(&contract_id, &10_000_000);

    client.initialise(
        &issuer,
        &usdc_sac.address(),
        &unit_sac.address(),
        &WINDOW,
        &50_000i128,
    );

    Fixture { env, client, usdc, contract_id, issuer, introducer, investor }
}

fn code(env: &Env) -> String {
    String::from_str(env, "CALDER-PR7")
}

fn register(f: &Fixture) {
    f.client.register_introducer(
        &f.introducer,
        &code(&f.env),
        &String::from_str(&f.env, "Raghunathan Family Office"),
    );
}

#[test]
fn subscribe_records_the_introduction_and_moves_the_money() {
    let f = setup();
    register(&f);

    let a = f.client.subscribe(&f.investor, &code(&f.env), &250_000i128);

    assert_eq!(a.subscribed, 250_000);
    assert_eq!(a.units, 250_000);
    assert_eq!(a.vests_at, a.at + WINDOW);
    assert!(!a.claimed && !a.recovered);

    // Money really moved: the investor paid, the contract holds it.
    assert_eq!(f.usdc.balance(&f.investor), 1_750_000);
    assert_eq!(f.usdc.balance(&f.contract_id), 250_000);

    assert_eq!(f.client.get_book(&code(&f.env)).len(), 1);
    assert_eq!(f.client.get_ledger().len(), 1);
}

#[test]
fn nothing_on_chain_reveals_a_rate_or_a_fee() {
    let f = setup();
    register(&f);
    let a = f.client.subscribe(&f.investor, &code(&f.env), &250_000i128);
    f.env.ledger().with_mut(|l| l.timestamp += WINDOW + 1);

    // The claimable figure is an AUM basis, not a payable amount: it equals
    // the subscription exactly, with no rate applied anywhere.
    assert_eq!(f.client.claimable_basis(&code(&f.env)), a.subscribed);

    // And a claim moves no money at all — settlement is off-chain.
    let before = f.usdc.balance(&f.introducer);
    assert_eq!(f.client.claim(&code(&f.env)), 1);
    assert_eq!(f.usdc.balance(&f.introducer), before);
    assert_eq!(f.usdc.balance(&f.introducer), 0);
}

#[test]
fn a_claim_is_refused_until_the_commission_vests() {
    let f = setup();
    register(&f);
    f.client.subscribe(&f.investor, &code(&f.env), &250_000i128);

    assert_eq!(f.client.claimable_basis(&code(&f.env)), 0);
    assert_eq!(f.client.try_claim(&code(&f.env)), Err(Ok(Error::NotYetVested)));

    f.env.ledger().with_mut(|l| l.timestamp += WINDOW + 1);

    assert_eq!(f.client.claimable_basis(&code(&f.env)), 250_000);
    assert_eq!(f.client.claim(&code(&f.env)), 1);

    // Claimed once, not twice.
    assert_eq!(f.client.claimable_basis(&code(&f.env)), 0);
    assert_eq!(f.client.try_claim(&code(&f.env)), Err(Ok(Error::NothingToClaim)));
}

#[test]
fn claim_takes_every_vested_introduction_and_leaves_the_rest() {
    let f = setup();
    register(&f);
    f.client.subscribe(&f.investor, &code(&f.env), &250_000i128);
    f.client.subscribe(&f.investor, &code(&f.env), &400_000i128);

    f.env.ledger().with_mut(|l| l.timestamp += WINDOW + 1);
    f.client.subscribe(&f.investor, &code(&f.env), &100_000i128); // fresh, unvested

    assert_eq!(f.client.claimable_basis(&code(&f.env)), 650_000);
    assert_eq!(f.client.claim(&code(&f.env)), 2);

    // The fresh one is still vesting, so a second claim is refused as such.
    assert_eq!(f.client.claimable_basis(&code(&f.env)), 0);
    assert_eq!(f.client.try_claim(&code(&f.env)), Err(Ok(Error::NotYetVested)));
}

#[test]
fn the_issuer_can_recover_inside_the_window_but_not_after() {
    let f = setup();
    register(&f);
    let a = f.client.subscribe(&f.investor, &code(&f.env), &400_000i128);

    f.client.recover(&a.id);
    assert_eq!(f.client.try_recover(&a.id), Err(Ok(Error::NotRecoverable)));

    // A recovered introduction never becomes claimable.
    f.env.ledger().with_mut(|l| l.timestamp += WINDOW + 1);
    assert_eq!(f.client.claimable_basis(&code(&f.env)), 0);
    assert_eq!(f.client.try_claim(&code(&f.env)), Err(Ok(Error::NothingToClaim)));
}

#[test]
fn a_vested_or_claimed_introduction_cannot_be_recovered() {
    let f = setup();
    register(&f);
    let a = f.client.subscribe(&f.investor, &code(&f.env), &400_000i128);
    f.env.ledger().with_mut(|l| l.timestamp += WINDOW + 1);

    assert_eq!(f.client.try_recover(&a.id), Err(Ok(Error::NotRecoverable)));
    f.client.claim(&code(&f.env));
    assert_eq!(f.client.try_recover(&a.id), Err(Ok(Error::NotRecoverable)));
}

#[test]
fn rejects_unknown_codes_small_subscriptions_and_duplicate_codes() {
    let f = setup();
    register(&f);

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


/// Events from OUR contract for the LAST invocation. `all()` is per-call, not
/// cumulative, and `subscribe` also triggers two SAC transfer events that are
/// not ours — hence the filter.
fn our_events(f: &Fixture) -> usize {
    f.env.events().all().filter_by_contract(&f.contract_id).events().len()
}

#[test]
fn no_state_change_is_silent() {
    let f = setup();

    f.client.register_introducer(&f.introducer, &code(&f.env), &String::from_str(&f.env, "RFO"));
    assert_eq!(our_events(&f), 1, "register_introducer must emit");

    let a = f.client.subscribe(&f.investor, &code(&f.env), &250_000i128);
    assert_eq!(our_events(&f), 1, "subscribe must emit");

    // A clawback is the one action a distributor most wants evidence of.
    f.client.recover(&a.id);
    assert_eq!(our_events(&f), 1, "recover must emit");

    f.client.subscribe(&f.investor, &code(&f.env), &400_000i128);
    f.env.ledger().with_mut(|l| l.timestamp += WINDOW + 1);
    f.client.claim(&code(&f.env));
    assert_eq!(our_events(&f), 1, "claim must emit");

    // A refused call changes nothing, so it must say nothing.
    let _ = f.client.try_claim(&code(&f.env));
    assert_eq!(our_events(&f), 0, "a refused claim must stay silent");
}

/// The product promise is that a scout never chases a commission. That only
/// holds if someone other than the scout can trigger the payment, so this
/// covers the issuer doing it — and, more importantly, covers it obeying the
/// same rules as `claim` rather than becoming a second, laxer way to pay.
#[test]
fn the_issuer_can_settle_without_the_introducer_asking() {
    let f = setup();
    register(&f);
    let paid = f.client.subscribe(&f.investor, &code(&f.env), &250_000i128);
    let clawed = f.client.subscribe(&f.investor, &code(&f.env), &180_000i128);

    // Refused before vesting, for the same reason and with the same error a
    // claim would give.
    assert_eq!(f.client.try_settle(&code(&f.env)), Err(Ok(Error::NotYetVested)));

    f.client.recover(&clawed.id);
    f.env.ledger().with_mut(|l| l.timestamp += WINDOW + 1);

    // One row settled, not two: the clawed-back introduction stays unpaid even
    // though the issuer — who clawed it back — is the one asking.
    assert_eq!(f.client.settle(&code(&f.env)), 1);
    assert!(f.env.auths().iter().any(|(a, _)| a == &f.issuer));

    let book = f.client.get_book(&code(&f.env));
    let settled = book.iter().find(|a| a.id == paid.id).unwrap();
    assert!(settled.claimed);
    let refused = book.iter().find(|a| a.id == clawed.id).unwrap();
    assert!(!refused.claimed && refused.recovered);

    // Indistinguishable from a claim downstream: nothing left by either route.
    assert_eq!(f.client.claimable_basis(&code(&f.env)), 0);
    assert_eq!(f.client.try_claim(&code(&f.env)), Err(Ok(Error::NothingToClaim)));
}

/// Settling a code that was never registered should say so, rather than
/// reporting that there is nothing to pay.
#[test]
fn settling_an_unknown_code_is_refused() {
    let f = setup();
    register(&f);
    let unknown = String::from_str(&f.env, "CALDER-XXX");
    assert_eq!(f.client.try_settle(&unknown), Err(Ok(Error::UnknownCode)));
}
