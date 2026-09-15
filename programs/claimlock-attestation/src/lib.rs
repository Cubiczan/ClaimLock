//! ClaimLock claim-hash attestation (Solana).
//!
//! One instruction: `attest_claim_hash`.
//! Stores `claim_hash` (32 bytes), attester pubkey, unix timestamp, optional memo.
//!
//! PDA seeds: `["attestation", attester, claim_hash]` — one record per attester+hash.

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

solana_program::declare_id!("2SzLAUB9oMh9k5zkTXnSnZ4KJHxPNcf9JokBssggBiYu");

/// Instruction tag for `attest_claim_hash`.
pub const INSTRUCTION_ATTEST: u8 = 0;

/// PDA seed prefix.
pub const ATTESTATION_SEED: &[u8] = b"attestation";

/// Account magic / discriminator: "CLATTEST".
pub const DISCRIMINATOR: &[u8; 8] = b"CLATTEST";

/// Maximum memo/tag length (e.g. "claimlock-v0").
pub const MAX_MEMO_LEN: usize = 32;

/// Packed attestation account size.
pub const ATTESTATION_SIZE: usize = 8  // discriminator
    + 32 // claim_hash
    + 32 // attester
    + 8  // unix_timestamp
    + 1  // memo_len
    + MAX_MEMO_LEN;

/// On-chain attestation record.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Attestation {
    pub claim_hash: [u8; 32],
    pub attester: Pubkey,
    pub unix_timestamp: i64,
    pub memo_len: u8,
    pub memo: [u8; MAX_MEMO_LEN],
}

impl Attestation {
    pub fn pack(&self) -> [u8; ATTESTATION_SIZE] {
        let mut out = [0u8; ATTESTATION_SIZE];
        out[0..8].copy_from_slice(DISCRIMINATOR);
        out[8..40].copy_from_slice(&self.claim_hash);
        out[40..72].copy_from_slice(self.attester.as_ref());
        out[72..80].copy_from_slice(&self.unix_timestamp.to_le_bytes());
        out[80] = self.memo_len;
        out[81..113].copy_from_slice(&self.memo);
        out
    }

    pub fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < ATTESTATION_SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        if &data[0..8] != DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }
        let claim_hash: [u8; 32] = data[8..40]
            .try_into()
            .map_err(|_| ProgramError::InvalidAccountData)?;
        let attester = Pubkey::new_from_array(
            data[40..72]
                .try_into()
                .map_err(|_| ProgramError::InvalidAccountData)?,
        );
        let unix_timestamp = i64::from_le_bytes(
            data[72..80]
                .try_into()
                .map_err(|_| ProgramError::InvalidAccountData)?,
        );
        let memo_len = data[80];
        if memo_len as usize > MAX_MEMO_LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        let mut memo = [0u8; MAX_MEMO_LEN];
        memo.copy_from_slice(&data[81..113]);
        Ok(Self {
            claim_hash,
            attester,
            unix_timestamp,
            memo_len,
            memo,
        })
    }
}

/// Parsed `attest_claim_hash` payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttestClaimHash {
    pub claim_hash: [u8; 32],
    pub memo: Vec<u8>,
}

impl AttestClaimHash {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // tag (1) + hash (32) + memo_len (1) [+ memo]
        if input.len() < 34 {
            return Err(ProgramError::InvalidInstructionData);
        }
        if input[0] != INSTRUCTION_ATTEST {
            return Err(ProgramError::InvalidInstructionData);
        }
        let claim_hash: [u8; 32] = input[1..33]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?;
        let memo_len = input[33] as usize;
        if memo_len > MAX_MEMO_LEN {
            return Err(ProgramError::InvalidInstructionData);
        }
        if input.len() < 34 + memo_len {
            return Err(ProgramError::InvalidInstructionData);
        }
        Ok(Self {
            claim_hash,
            memo: input[34..34 + memo_len].to_vec(),
        })
    }

    pub fn pack(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(34 + self.memo.len());
        out.push(INSTRUCTION_ATTEST);
        out.extend_from_slice(&self.claim_hash);
        out.push(self.memo.len() as u8);
        out.extend_from_slice(&self.memo);
        out
    }
}

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let ix = AttestClaimHash::unpack(instruction_data)?;
    attest_claim_hash(program_id, accounts, ix)
}

/// Derive the attestation PDA for `(attester, claim_hash)`.
pub fn attestation_pda(attester: &Pubkey, claim_hash: &[u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ATTESTATION_SEED, attester.as_ref(), claim_hash],
        &id(),
    )
}

fn attest_claim_hash(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    ix: AttestClaimHash,
) -> ProgramResult {
    if program_id != &id() {
        return Err(ProgramError::IncorrectProgramId);
    }

    let account_iter = &mut accounts.iter();
    let attester = next_account_info(account_iter)?;
    let attestation_account = next_account_info(account_iter)?;
    let system_program = next_account_info(account_iter)?;

    if !attester.is_signer {
        msg!("attester must sign");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !attester.is_writable {
        msg!("attester must be writable (fee/rent payer)");
        return Err(ProgramError::InvalidAccountData);
    }
    if !attestation_account.is_writable {
        msg!("attestation account must be writable");
        return Err(ProgramError::InvalidAccountData);
    }
    if *system_program.key != solana_program::system_program::id() {
        msg!("invalid system program");
        return Err(ProgramError::IncorrectProgramId);
    }

    let (expected_pda, bump) = Pubkey::find_program_address(
        &[ATTESTATION_SEED, attester.key.as_ref(), &ix.claim_hash],
        program_id,
    );
    if expected_pda != *attestation_account.key {
        msg!("attestation PDA mismatch");
        return Err(ProgramError::InvalidSeeds);
    }

    if attestation_account.lamports() > 0 || !attestation_account.data_is_empty() {
        msg!("attestation already exists for this attester + claim_hash");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(ATTESTATION_SIZE);
    invoke_signed(
        &system_instruction::create_account(
            attester.key,
            attestation_account.key,
            lamports,
            ATTESTATION_SIZE as u64,
            program_id,
        ),
        &[
            attester.clone(),
            attestation_account.clone(),
            system_program.clone(),
        ],
        &[&[
            ATTESTATION_SEED,
            attester.key.as_ref(),
            &ix.claim_hash,
            &[bump],
        ]],
    )?;

    let clock = Clock::get()?;
    let mut memo = [0u8; MAX_MEMO_LEN];
    memo[..ix.memo.len()].copy_from_slice(&ix.memo);

    let record = Attestation {
        claim_hash: ix.claim_hash,
        attester: *attester.key,
        unix_timestamp: clock.unix_timestamp,
        memo_len: ix.memo.len() as u8,
        memo,
    };

    attestation_account
        .try_borrow_mut_data()?
        .copy_from_slice(&record.pack());

    msg!(
        "ClaimLock attested hash; ts={}",
        clock.unix_timestamp
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pack_roundtrip_instruction() {
        let ix = AttestClaimHash {
            claim_hash: [7u8; 32],
            memo: b"claimlock-v0".to_vec(),
        };
        let packed = ix.pack();
        let unpacked = AttestClaimHash::unpack(&packed).unwrap();
        assert_eq!(ix, unpacked);
        assert_eq!(packed[0], INSTRUCTION_ATTEST);
        assert_eq!(packed.len(), 34 + 12);
    }

    #[test]
    fn pack_roundtrip_account() {
        let record = Attestation {
            claim_hash: [9u8; 32],
            attester: Pubkey::new_from_array([3u8; 32]),
            unix_timestamp: 1_778_000_000,
            memo_len: 4,
            memo: {
                let mut m = [0u8; 32];
                m[..4].copy_from_slice(b"demo");
                m
            },
        };
        let packed = record.pack();
        assert_eq!(&packed[0..8], DISCRIMINATOR);
        assert_eq!(packed.len(), ATTESTATION_SIZE);
        assert_eq!(Attestation::unpack(&packed).unwrap(), record);
    }

    #[test]
    fn rejects_unknown_instruction() {
        let mut data = vec![1u8; 34];
        data[0] = 99;
        assert!(AttestClaimHash::unpack(&data).is_err());
    }

    #[test]
    fn rejects_oversized_memo() {
        let mut data = vec![0u8; 34 + 33];
        data[33] = 33;
        assert!(AttestClaimHash::unpack(&data).is_err());
    }
}
