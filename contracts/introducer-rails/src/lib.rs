#![no_std]
//! Introducer Rails — attribution and vesting for tokenized fund distribution.
//!
//! This contract deliberately does **not** know what anyone earns.
//!
//! It records who introduced whom, how much that investor subscribed, and when
//! the resulting commission vests. It does not store a fee, a rate, or any
//! payable amount, because a rate on chain is a rate the world can read — and
//! in distribution the commercially sensitive number is the rate, not the
//! subscription. A fund manager will disclose flows; they will not let one
//! distributor learn another's terms.
//!
//! Settlement happens off this contract: the issuer holds a confidential
//! balance and pays each introducer from it, applying that introducer's own
//! privately negotiated rate. `claim` is the authorization and the settlement
//! record — it proves the commission has vested and marks it taken — and it
//! emits only attribution ids, never a number.
//!
//! What an observer can still derive: who introduced whom, and how much each
//! investor subscribed (both are public transfers). What they cannot: any
//! rate, any fee, or any introducer's earnings.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
    String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub issuer: Address,
    /// SAC address of the subscription currency.
    pub usdc: Address,
    /// SAC address of the fund unit (classic asset, authorization required).
    pub unit: Address,
    pub vesting_window_secs: u64,
    pub minimum: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Introducer {
    pub code: String,
    pub owner: Address,
    pub display_name: String,
}

/// One introduction. Carries the AUM the commission is owed on, never the
/// commission itself.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attribution {
    pub id: u32,
    pub code: String,
    pub investor: Address,
    pub subscribed: i128,
    pub units: i128,
    pub at: u64,
    /// When the commission on this introduction becomes payable.
    pub vests_at: u64,
    /// Marked when the introducer claims it; the issuer then settles off-chain.
    pub claimed: bool,
    /// Clawed back by the issuer because the investor redeemed early.
    pub recovered: bool,
}

#[contracttype]
pub enum DataKey {
    Config,
    Introducer(String),
    Attributions,
    NextId,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialised = 1,
    NotInitialised = 2,
    UnknownCode = 3,
    CodeTaken = 4,
    BelowMinimum = 5,
    /// No introduction of this introducer's is vested and unclaimed.
    NothingToClaim = 6,
    /// Introductions exist but none has vested yet.
    NotYetVested = 7,
    NotRecoverable = 8,
}

#[contract]
pub struct IntroducerRails;

impl IntroducerRails {
    fn config(env: &Env) -> Result<Config, Error> {
        env.storage().instance().get(&DataKey::Config).ok_or(Error::NotInitialised)
    }

    fn attributions(env: &Env) -> Vec<Attribution> {
        env.storage()
            .instance()
            .get(&DataKey::Attributions)
            .unwrap_or_else(|| Vec::new(env))
    }

    fn introducer(env: &Env, code: &String) -> Result<Introducer, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Introducer(code.clone()))
            .ok_or(Error::UnknownCode)
    }
}

#[contractimpl]
impl IntroducerRails {
    pub fn initialise(
        env: Env,
        issuer: Address,
        usdc: Address,
        unit: Address,
        vesting_window_secs: u64,
        minimum: i128,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialised);
        }
        issuer.require_auth();
        env.storage().instance().set(
            &DataKey::Config,
            &Config { issuer, usdc, unit, vesting_window_secs, minimum },
        );
        env.storage().instance().set(&DataKey::NextId, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::Attributions, &Vec::<Attribution>::new(&env));
        Ok(())
    }

    pub fn register_introducer(
        env: Env,
        owner: Address,
        code: String,
        display_name: String,
    ) -> Result<Introducer, Error> {
        owner.require_auth();
        if env.storage().persistent().has(&DataKey::Introducer(code.clone())) {
            return Err(Error::CodeTaken);
        }
        let introducer = Introducer { code: code.clone(), owner, display_name };
        env.storage()
            .persistent()
            .set(&DataKey::Introducer(code), &introducer);
        env.events().publish(
            (symbol_short!("register"), introducer.code.clone()),
            introducer.owner.clone(),
        );
        Ok(introducer)
    }

    pub fn get_introducer(env: Env, code: String) -> Result<Introducer, Error> {
        Self::introducer(&env, &code)
    }

    /// Subscribe through an introducer's code. Pulls USDC, issues units, and
    /// records the introduction with its vesting deadline. No commission is
    /// computed here — this contract never sees a rate.
    pub fn subscribe(
        env: Env,
        investor: Address,
        code: String,
        usdc_amount: i128,
    ) -> Result<Attribution, Error> {
        investor.require_auth();
        let cfg = Self::config(&env)?;
        if usdc_amount < cfg.minimum {
            return Err(Error::BelowMinimum);
        }
        Self::introducer(&env, &code)?;

        let here = env.current_contract_address();
        token::Client::new(&env, &cfg.usdc).transfer(&investor, &here, &usdc_amount);

        // Unit price is 1.00 in this build, so units track the subscription
        // one for one. A NAV line is on the cut list; see README.
        let units = usdc_amount;
        token::Client::new(&env, &cfg.unit).transfer(&here, &investor, &units);

        let now = env.ledger().timestamp();
        let id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);

        let attribution = Attribution {
            id,
            code,
            investor,
            subscribed: usdc_amount,
            units,
            at: now,
            vests_at: now + cfg.vesting_window_secs,
            claimed: false,
            recovered: false,
        };

        let mut all = Self::attributions(&env);
        all.push_back(attribution.clone());
        env.storage().instance().set(&DataKey::Attributions, &all);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        // Both values are already public: the subscription is a public SAC
        // transfer and the attribution is a public read. Emitting them lets an
        // indexer WATCH attribution happen instead of polling get_ledger and
        // diffing it. No rate is derivable from either.
        env.events().publish(
            (symbol_short!("subscribe"), attribution.code.clone()),
            (attribution.id, attribution.subscribed),
        );

        Ok(attribution)
    }

    pub fn get_book(env: Env, code: String) -> Vec<Attribution> {
        let mut out = Vec::new(&env);
        for a in Self::attributions(&env).iter() {
            if a.code == code {
                out.push_back(a);
            }
        }
        out
    }

    pub fn get_ledger(env: Env) -> Vec<Attribution> {
        Self::attributions(&env)
    }

    /// The AUM an introducer may currently claim commission on: vested, not
    /// recovered, not already claimed. This is a subscription total, NOT a
    /// payable amount — turning it into money needs the rate, which lives
    /// only with the issuer and that introducer.
    pub fn claimable_basis(env: Env, code: String) -> i128 {
        let now = env.ledger().timestamp();
        let mut basis = 0i128;
        for a in Self::attributions(&env).iter() {
            if a.code == code && !a.recovered && !a.claimed && a.vests_at <= now {
                basis += a.subscribed;
            }
        }
        basis
    }

    /// Mark every vested, unclaimed introduction of this introducer's as
    /// claimed, and publish their ids. The issuer's settlement service applies
    /// the private rate and pays confidentially.
    ///
    /// The event carries ids only. Publishing a total here would hand an
    /// observer the subscription basis in one number and put us back where we
    /// started.
    pub fn claim(env: Env, code: String) -> Result<u32, Error> {
        Self::config(&env)?;
        let introducer = Self::introducer(&env, &code)?;
        introducer.owner.require_auth();
        Self::mark_settled(&env, &code)
    }

    /// The issuer pays a vested introduction without the introducer having to
    /// ask for it.
    ///
    /// `claim` requires the introducer's signature, which makes being paid
    /// something they have to remember to do. A distributor who is told they
    /// never have to chase a commission should not have to press a button to
    /// receive one, so the issuer can settle on their behalf and `claim`
    /// becomes an optional "collect now" rather than the only way through.
    ///
    /// Deliberately the same effect as `claim`: it marks the same rows and
    /// emits the same `claimed` event, because to everyone downstream — the
    /// book, the ledger, the settlement service — a paid introduction is a
    /// paid introduction regardless of who triggered it.
    pub fn settle(env: Env, code: String) -> Result<u32, Error> {
        let cfg = Self::config(&env)?;
        cfg.issuer.require_auth();
        // Still has to exist: settling an unknown code should say so rather
        // than quietly report nothing to pay.
        Self::introducer(&env, &code)?;
        Self::mark_settled(&env, &code)
    }

    /// Mark every vested, unclaimed, unrecovered introduction of this code as
    /// claimed and publish the ids.
    ///
    /// Shared by `claim` and `settle`. The only thing that differs between
    /// them is who had to authorise it, so the rule for what gets paid lives
    /// here once — two copies would drift, and the copy that drifted would be
    /// the one deciding whether someone gets paid.
    ///
    /// The event carries ids only. Publishing a total would hand an observer
    /// the exact settlement basis in one number and undo D10.
    fn mark_settled(env: &Env, code: &String) -> Result<u32, Error> {
        let now = env.ledger().timestamp();
        let mut all = Self::attributions(env);
        let mut ids = Vec::new(env);
        let mut unvested = 0u32;

        for i in 0..all.len() {
            let mut a = all.get_unchecked(i);
            if &a.code != code || a.recovered || a.claimed {
                continue;
            }
            if a.vests_at > now {
                unvested += 1;
                continue;
            }
            ids.push_back(a.id);
            a.claimed = true;
            all.set(i, a);
        }

        if ids.is_empty() {
            // Distinguish "you have earned nothing" from "you have earned
            // something that has not vested" — different sentences on screen.
            return Err(if unvested > 0 { Error::NotYetVested } else { Error::NothingToClaim });
        }

        env.storage().instance().set(&DataKey::Attributions, &all);
        let count = ids.len();
        env.events().publish((symbol_short!("claimed"), code.clone()), ids);
        Ok(count)
    }

    /// Issuer recovers an introduction whose investor redeemed inside the
    /// window. All-or-nothing; real chargeback is pro-rata — see DECISIONS.md
    /// D9. No amount is involved: the issuer simply never settles it.
    pub fn recover(env: Env, id: u32) -> Result<(), Error> {
        let cfg = Self::config(&env)?;
        cfg.issuer.require_auth();

        let now = env.ledger().timestamp();
        let mut all = Self::attributions(&env);
        for i in 0..all.len() {
            let mut a = all.get_unchecked(i);
            if a.id != id {
                continue;
            }
            if a.claimed || a.recovered || a.vests_at <= now {
                return Err(Error::NotRecoverable);
            }
            a.recovered = true;
            let code = a.code.clone();
            all.set(i, a);
            env.storage().instance().set(&DataKey::Attributions, &all);
            // A clawback is the one action a distributor most wants evidence
            // of. Silent recovery leaves none.
            env.events().publish((symbol_short!("recovered"), code), id);
            return Ok(());
        }
        Err(Error::NotRecoverable)
    }
}

mod test;
