## Context

ClaimLock needs a working end-to-end attestation demo for Colosseum. The repo was a pitch scaffold (README + video). Scope is one instruction on Solana **devnet**.

## Goals / Non-Goals

**Goals**

- Persist `(claim_hash, attester, timestamp, memo)` on-chain.
- Deterministic PDA so records are findable without an indexer.
- Client that hashes a synthetic locked claim-set and prints an explorer URL.
- Documented program id; no private keys in git.

**Non-goals**

- Anchor IDL / full CHP workflow UI.
- Mainnet, SAS/Solana Attestation Service integration, or Merkle proof verification on-chain (hash is treated as opaque 32 bytes).

## Decisions

1. **Native program, not Anchor.** One instruction; native packing keeps the client and deploy path small and avoids Anchor toolchain pinning.
2. **Opaque 32-byte hash.** Program does not interpret Merkle vs SHA-256. The client SHA-256s canonical JSON of the demo claim-set.
3. **PDA uniqueness** `["attestation", attester, claim_hash]`. Re-attesting the same pair fails. Different attesters may attest the same hash.
4. **Manual pack (no Borsh in the program).** Layout is documented and mirrored in TypeScript so the demo has no IDL dependency.
5. **Keypairs live in `.keys/` (gitignored JSON).** Only public program id and attester pubkey are documented.

## Account layout (113 bytes)

| Offset | Size | Field |
|--------|------|--------|
| 0 | 8 | discriminator `CLATTEST` |
| 8 | 32 | claim_hash |
| 40 | 32 | attester pubkey |
| 72 | 8 | unix_timestamp (i64 LE) |
| 80 | 1 | memo_len |
| 81 | 32 | memo (zero-padded) |

Instruction data: `u8 tag=0` + 32-byte hash + `u8 memo_len` + memo bytes.

## Risks / Trade-offs

- Devnet faucet rate limits can block airdrop/deploy. Document retries and that this is a demo, not production SLA.
- Program id is baked into `declare_id!`. Redeploy with a new keypair requires a source edit.
- No revoke/update instruction. Intentional for a lock-style receipt.

## Migration Plan

Greenfield. Devnet-only; no production data to migrate.

## Open Questions

None for v0. SAS integration can be a later change if Colosseum judges want a public-good attestation layer instead of a dedicated program.
