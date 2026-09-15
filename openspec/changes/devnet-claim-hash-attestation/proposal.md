# Change: Devnet claim-hash attestation

## Why

ClaimLock's Colosseum story is propose → challenge → human-lock → **attest**. This repo had the pitch and positioning, but no on-chain path. A minimal Solana **devnet** program that stores a 32-byte claim-set hash (Merkle root or SHA-256 of locked claims JSON) gives an explorer-verifiable receipt without inventing mainnet traction or customer data.

Cubiczan CHP / ServiceSell×FinBridge remains disclosed prior art. This change is the crypto-native Solana wedge only.

## What Changes

- Native Solana program with a single instruction `attest_claim_hash`.
- On-chain record: `claim_hash` (32 bytes), attester pubkey, unix timestamp, optional memo/tag (e.g. `claimlock-v0`).
- TypeScript demo client: hash a synthetic locked claim-set, submit the tx, print signature + Solana explorer URL (`cluster=devnet`).
- README: build, deploy, airdrop, run demo, verify on explorer. Honest framing. No private keys committed.

## Non-goals

- Mainnet deploy, token, governance, or yield.
- Full propose/challenge UI or CHP engine port.
- Anchor (native is enough for one instruction).
- Real customer/PII claims.

## Impact

- New capability: `claim-hash-attestation`.
- New docs/scripts under `programs/`, `client/`, `scripts/`.
