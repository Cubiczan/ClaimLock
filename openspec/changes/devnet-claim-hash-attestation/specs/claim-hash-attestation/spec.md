## ADDED Requirements

### Requirement: Attest a claim-set hash on Solana

The program SHALL expose a single instruction `attest_claim_hash` that creates an attestation account storing:

- `claim_hash`: exactly 32 bytes (Merkle root or SHA-256 of locked claims JSON)
- `attester`: the signing pubkey that paid rent
- `unix_timestamp`: Solana `Clock` unix timestamp at instruction execution
- optional memo/tag: UTF-8, at most 32 bytes (example: `claimlock-v0`)

The attestation account SHALL be a PDA seeded by `["attestation", attester, claim_hash]` so the same attester cannot overwrite an existing hash record.

#### Scenario: Successful first attestation

- **GIVEN** a funded attester keypair on Solana devnet and a 32-byte claim hash
- **WHEN** the attester submits `attest_claim_hash` with an optional memo
- **THEN** a new program-owned PDA is created containing that hash, the attester pubkey, a unix timestamp, and the memo
- **AND** the transaction signature is explorer-verifiable at `https://explorer.solana.com/tx/<sig>?cluster=devnet`

#### Scenario: Duplicate attestation is rejected

- **GIVEN** an existing attestation PDA for the same attester and claim hash
- **WHEN** `attest_claim_hash` is submitted again with those values
- **THEN** the instruction fails without mutating the existing record

### Requirement: Demo client hashes a synthetic locked claim-set

The TypeScript client SHALL SHA-256 a checked-in demo composite claim-set (no customer PII), submit `attest_claim_hash`, and print the signature plus a devnet explorer URL.

#### Scenario: Operator runs the demo

- **GIVEN** the program is deployed to devnet and the attester keypair is airdropped
- **WHEN** the operator runs the documented demo command
- **THEN** stdout includes the 32-byte hash (hex), transaction signature, and explorer URL with `cluster=devnet`

### Requirement: Honest deploy documentation

The README SHALL document build, deploy, airdrop, demo, and explorer verification for **devnet only**. Private key JSON SHALL NOT be committed. Copy SHALL name the brand Cubiczan, disclose Cubiczan CHP as prior art, and MUST NOT claim mainnet traction.

#### Scenario: Contributor follows README

- **GIVEN** a fresh clone without local keypairs
- **WHEN** they follow the README
- **THEN** they generate keypairs under a gitignored path, airdrop on devnet, deploy, run the demo, and can open the printed explorer URL
