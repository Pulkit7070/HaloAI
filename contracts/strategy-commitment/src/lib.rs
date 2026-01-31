#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env,
};

// ─── Storage keys ────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    NextId,
    Commitment(u64),
}

// ─── Stored commitment record ────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct CommitmentRecord {
    pub owner: Address,
    pub commitment: BytesN<32>,
    pub revealed: bool,
    pub strategy: Bytes,
    pub timestamp: u64,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    AlreadyRevealed = 2,
    NotOwner = 3,
    HashMismatch = 4,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct StrategyCommitment;

#[contractimpl]
impl StrategyCommitment {
    /// Commit a strategy hash on-chain. Returns the commit_id.
    ///
    /// `commitment` = SHA-256(strategy_bytes || salt_bytes), computed off-chain.
    pub fn commit(env: Env, owner: Address, commitment: BytesN<32>) -> u64 {
        owner.require_auth();

        // Auto-increment ID
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0);

        let record = CommitmentRecord {
            owner: owner.clone(),
            commitment,
            revealed: false,
            strategy: Bytes::new(&env),
            timestamp: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Commitment(id), &record);

        env.storage()
            .instance()
            .set(&DataKey::NextId, &(id + 1));

        // Emit event
        env.events()
            .publish((symbol_short!("commit"),), (id, owner));

        id
    }

    /// Read a commitment record by ID.
    pub fn get(env: Env, commit_id: u64) -> CommitmentRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Commitment(commit_id))
            .unwrap_or_else(|| panic!("commitment not found"))
    }

    /// Reveal: prove that hash(strategy || salt) == commitment.
    ///
    /// On success, stores the plaintext strategy in the record and marks revealed.
    pub fn reveal(env: Env, commit_id: u64, strategy: Bytes, salt: Bytes) {
        let mut record: CommitmentRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Commitment(commit_id))
            .unwrap_or_else(|| panic!("commitment not found"));

        // Only the owner can reveal
        record.owner.require_auth();

        if record.revealed {
            panic!("already revealed");
        }

        // Reconstruct: hash(strategy || salt)
        let mut preimage = Bytes::new(&env);
        preimage.append(&strategy);
        preimage.append(&salt);

        let computed: BytesN<32> = env.crypto().sha256(&preimage).into();

        if computed != record.commitment {
            panic!("hash mismatch");
        }

        record.revealed = true;
        record.strategy = strategy;

        env.storage()
            .persistent()
            .set(&DataKey::Commitment(commit_id), &record);

        // Emit event
        env.events()
            .publish((symbol_short!("reveal"),), (commit_id, record.owner));
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_commit_get_reveal() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, StrategyCommitment);
        let client = StrategyCommitmentClient::new(&env, &contract_id);

        let owner = Address::generate(&env);

        // Build commitment off-chain: sha256(strategy || salt)
        let strategy = Bytes::from_slice(&env, b"buy XLM when RSI < 30");
        let salt = Bytes::from_slice(&env, b"random_salt_1234");

        let mut preimage = Bytes::new(&env);
        preimage.append(&strategy);
        preimage.append(&salt);
        let commitment: BytesN<32> = env.crypto().sha256(&preimage).into();

        // 1. Commit
        let id = client.commit(&owner, &commitment);
        assert_eq!(id, 0);

        // 2. Get
        let record = client.get(&id);
        assert_eq!(record.owner, owner);
        assert_eq!(record.commitment, commitment);
        assert!(!record.revealed);

        // 3. Reveal
        client.reveal(&id, &strategy, &salt);

        let revealed = client.get(&id);
        assert!(revealed.revealed);
        assert_eq!(revealed.strategy, strategy);
    }

    #[test]
    #[should_panic(expected = "hash mismatch")]
    fn test_bad_reveal() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, StrategyCommitment);
        let client = StrategyCommitmentClient::new(&env, &contract_id);

        let owner = Address::generate(&env);

        let strategy = Bytes::from_slice(&env, b"buy XLM when RSI < 30");
        let salt = Bytes::from_slice(&env, b"random_salt_1234");

        let mut preimage = Bytes::new(&env);
        preimage.append(&strategy);
        preimage.append(&salt);
        let commitment: BytesN<32> = env.crypto().sha256(&preimage).into();

        let id = client.commit(&owner, &commitment);

        // Try reveal with wrong salt
        let bad_salt = Bytes::from_slice(&env, b"wrong_salt");
        client.reveal(&id, &strategy, &bad_salt);
    }

    #[test]
    fn test_multiple_commits() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, StrategyCommitment);
        let client = StrategyCommitmentClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let commitment: BytesN<32> = BytesN::from_array(&env, &[1u8; 32]);

        let id0 = client.commit(&owner, &commitment);
        let id1 = client.commit(&owner, &commitment);
        let id2 = client.commit(&owner, &commitment);

        assert_eq!(id0, 0);
        assert_eq!(id1, 1);
        assert_eq!(id2, 2);
    }
}
