#![no_std]
//! Introducer Rails — confidential attribution and fee payouts.
//!
//! The contract is the escrow. Investors send USDC to it; it issues fund units
//! from the supply the issuer parked here at setup, records who introduced
//! whom, and accrues a trail fee that the introducer can withdraw once it has
//! vested. Holding both sides here means `subscribe` needs only the investor's
//! signature, not a second one from the issuer on every transaction.
//!
//! Fee amounts are plain i128 in this contract. Making them confidential is
//! the separate OpenZeppelin confidential-token path — see contracts/SPIKE.md
//! and DECISIONS.md D1 for why fees and not holdings.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String, Vec,
};

const BPS_DENOMINATOR: i128 = 10_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub issuer: Address,
    /// SAC address of the subscription currency.
    pub usdc: Address,
    /// SAC address of the fund unit (classic asset, authorization required).
    pub unit: Address,
    pub trail_fee_bps: u32,
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

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attribution {
    pub id: u32,
    pub code: String,
    pub investor: Address,
    pub subscribed: i128,
    pub units: i128,
    pub fee: i128,
    pub at: u64,
    /// When the fee becomes withdrawable. Before this the issuer can recover it.
    pub vests_at: u64,
    pub settled: bool,
    /// Clawed back by the issuer because the investor redeemed early.
    pub recovered: bool,
}

#[contracttype]
pub enum DataKey {
    Config,
    Introducer(String),
    Attributions,
    Claimed(String),
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
    NothingToClaim = 6,
    NotYetVested = 7,
    NotRecoverable = 8,
}

#[contract]
pub struct IntroducerRails;

// Helpers live outside #[contractimpl] so they are not exported.
impl IntroducerRails {
    fn config(env: &Env) -> Result<Config, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialised)
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

    fn claimed(env: &Env, code: &String) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Claimed(code.clone()))
            .unwrap_or(0)
    }
}

#[contractimpl]
impl IntroducerRails {
    pub fn initialise(
        env: Env,
        issuer: Address,
        usdc: Address,
        unit: Address,
        trail_fee_bps: u32,
        vesting_window_secs: u64,
        minimum: i128,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialised);
        }
        issuer.require_auth();
        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                issuer,
                usdc,
                unit,
                trail_fee_bps,
                vesting_window_secs,
                minimum,
            },
        );
        env.storage().instance().set(&DataKey::NextId, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::Attributions, &Vec::<Attribution>::new(&env));
        Ok(())
    }

    /// Register an introducer and claim a code. Anyone may register; the code
    /// is first-come, and the owner is who gets paid.
    pub fn register_introducer(
        env: Env,
        owner: Address,
        code: String,
        display_name: String,
    ) -> Result<Introducer, Error> {
        owner.require_auth();
        if env
            .storage()
            .persistent()
            .has(&DataKey::Introducer(code.clone()))
        {
            return Err(Error::CodeTaken);
        }
        let introducer = Introducer {
            code: code.clone(),
            owner,
            display_name,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Introducer(code), &introducer);
        Ok(introducer)
    }

    pub fn get_introducer(env: Env, code: String) -> Result<Introducer, Error> {
        Self::introducer(&env, &code)
    }

    /// Subscribe through an introducer's code. Pulls USDC from the investor,
    /// issues units, and records the attribution with its vesting deadline.
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

        let fee = usdc_amount * (cfg.trail_fee_bps as i128) / BPS_DENOMINATOR;
        let now = env.ledger().timestamp();
        let id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);

        let attribution = Attribution {
            id,
            code,
            investor,
            subscribed: usdc_amount,
            units,
            fee,
            at: now,
            vests_at: now + cfg.vesting_window_secs,
            settled: false,
            recovered: false,
        };

        let mut all = Self::attributions(&env);
        all.push_back(attribution.clone());
        env.storage().instance().set(&DataKey::Attributions, &all);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        Ok(attribution)
    }

    /// One introducer's own book.
    pub fn get_book(env: Env, code: String) -> Vec<Attribution> {
        let mut out = Vec::new(&env);
        for a in Self::attributions(&env).iter() {
            if a.code == code {
                out.push_back(a);
            }
        }
        out
    }

    /// Every attribution. Issuer view.
    pub fn get_ledger(env: Env) -> Vec<Attribution> {
        Self::attributions(&env)
    }

    /// Withdrawable right now: vested, not recovered, not already paid.
    pub fn claimable(env: Env, code: String) -> i128 {
        let now = env.ledger().timestamp();
        let mut vested = 0i128;
        for a in Self::attributions(&env).iter() {
            if a.code == code && !a.recovered && a.vests_at <= now {
                vested += a.fee;
            }
        }
        vested - Self::claimed(&env, &code)
    }

    /// Pay out the vested portion. Rejects `NotYetVested` when a fee exists but
    /// is still inside its window — a different sentence on screen from having
    /// earned nothing at all.
    pub fn claim_fee(env: Env, code: String) -> Result<i128, Error> {
        let cfg = Self::config(&env)?;
        let introducer = Self::introducer(&env, &code)?;
        introducer.owner.require_auth();

        let now = env.ledger().timestamp();
        let mut vested = 0i128;
        let mut accrued = 0i128;
        for a in Self::attributions(&env).iter() {
            if a.code != code || a.recovered {
                continue;
            }
            accrued += a.fee;
            if a.vests_at <= now {
                vested += a.fee;
            }
        }

        let claimed = Self::claimed(&env, &code);
        let payable = vested - claimed;
        if payable <= 0 {
            if accrued - claimed > 0 {
                return Err(Error::NotYetVested);
            }
            return Err(Error::NothingToClaim);
        }

        token::Client::new(&env, &cfg.usdc).transfer(
            &env.current_contract_address(),
            &introducer.owner,
            &payable,
        );
        env.storage()
            .persistent()
            .set(&DataKey::Claimed(code), &(claimed + payable));

        // Mark the vested rows settled so the issuer ledger reads correctly.
        let mut all = Self::attributions(&env);
        for i in 0..all.len() {
            let mut a = all.get_unchecked(i);
            if a.vests_at <= now && !a.recovered && !a.settled {
                a.settled = true;
                all.set(i, a);
            }
        }
        env.storage().instance().set(&DataKey::Attributions, &all);

        Ok(payable)
    }

    /// Issuer recovers a fee whose investor redeemed inside the window.
    /// All-or-nothing; real chargeback is pro-rata — see DECISIONS.md D9.
    pub fn recover_fee(env: Env, id: u32) -> Result<i128, Error> {
        let cfg = Self::config(&env)?;
        cfg.issuer.require_auth();

        let now = env.ledger().timestamp();
        let mut all = Self::attributions(&env);
        for i in 0..all.len() {
            let mut a = all.get_unchecked(i);
            if a.id != id {
                continue;
            }
            if a.settled || a.recovered || a.vests_at <= now {
                return Err(Error::NotRecoverable);
            }
            let fee = a.fee;
            a.recovered = true;
            all.set(i, a);
            env.storage().instance().set(&DataKey::Attributions, &all);
            return Ok(fee);
        }
        Err(Error::NotRecoverable)
    }
}

mod test;
