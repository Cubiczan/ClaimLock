# ClaimLock

ClaimLock — propose → challenge → human-lock claims with Solana attestation (Colosseum Crypto World's Fair). Cubiczan prior art disclosed.

**Honest positioning:** not a chatbot CFO, not DeFi yield, not another tracker. Crypto treasury/close still runs on spreadsheets + Discord; AI CFO demos invent numbers. ClaimLock is the crypto-native wedge: propose → challenge → human lock → Solana attestation (explorer-verifiable receipt).

Cubiczan CHP / ServiceSell×FinBridge is prior art; ClaimLock focuses the Solana attestation path in-window for Colosseum.

This is a **devnet** demo, not mainnet traction.

## Devnet claim-hash attestation

A native Solana program stores an opaque 32-byte claim-set hash (Merkle root **or** SHA-256 of locked claims JSON), the attester pubkey, a unix timestamp, and an optional memo/tag such as `claimlock-v0`.

| | |
|---|---|
| **Cluster** | Solana **devnet** only |
| **Program id** | `2SzLAUB9oMh9k5zkTXnSnZ4KJHxPNcf9JokBssggBiYu` |
| **Instruction** | `attest_claim_hash` |
| **PDA seeds** | `["attestation", attester, claim_hash]` |

Explorer (program): [https://explorer.solana.com/address/2SzLAUB9oMh9k5zkTXnSnZ4KJHxPNcf9JokBssggBiYu?cluster=devnet](https://explorer.solana.com/address/2SzLAUB9oMh9k5zkTXnSnZ4KJHxPNcf9JokBssggBiYu?cluster=devnet)

Explorer (program): [https://explorer.solana.com/address/2SzLAUB9oMh9k5zkTXnSnZ4KJHxPNcf9JokBssggBiYu?cluster=devnet](https://explorer.solana.com/address/2SzLAUB9oMh9k5zkTXnSnZ4KJHxPNcf9JokBssggBiYu?cluster=devnet)

Canonical SHA-256 of `client/fixtures/locked-claim-set.demo.json` (`npm run demo -- --dry-run --canonical`):

`5f150b6e2762f14fc03a928ba950ea9156ba8f72290a28381d8f4ca926e90481`

**Live sample (devnet, 2026-09-15)** — explorer-confirmed, not invented:

| | |
|---|---|
| Attest signature | `3ciSGz9hzwXH7u3F8VzdzVRv8FJcGuhaiWdGPfZCZhLVGMLZNjH6tWs8BLxkxQbUVtifGU2u4VwCsAhixBdzXJkm` |
| Explorer (tx) | [https://explorer.solana.com/tx/3ciSGz9hzwXH7u3F8VzdzVRv8FJcGuhaiWdGPfZCZhLVGMLZNjH6tWs8BLxkxQbUVtifGU2u4VwCsAhixBdzXJkm?cluster=devnet](https://explorer.solana.com/tx/3ciSGz9hzwXH7u3F8VzdzVRv8FJcGuhaiWdGPfZCZhLVGMLZNjH6tWs8BLxkxQbUVtifGU2u4VwCsAhixBdzXJkm?cluster=devnet) |
| Attestation PDA | [2P3V5bzTmGbQMTmeLqHBht5TU5dRKRF6xbKTLVkAfjYY](https://explorer.solana.com/address/2P3V5bzTmGbQMTmeLqHBht5TU5dRKRF6xbKTLVkAfjYY?cluster=devnet) |
| claim_hash | `6b08dbe954595538b03198038a6ca0a0a701f0f5d954acf10b31de45b128514c` |
| memo | `claimlock-v0` |
| attester | `2562fyPRueCtmXqDQ7P2ozgT2gXsELqf5Pm82WMVQ3wm` |
| Program deploy signature | `3jW7T54VXShmqagSuTq1m8BfAkyQk4UyfovxxCaBJNZMs861UXqBk2sKMoiW8j83PTTynqGc4qoxDSJMEKwKHMpr` |
| Explorer (deploy) | [https://explorer.solana.com/tx/3jW7T54VXShmqagSuTq1m8BfAkyQk4UyfovxxCaBJNZMs861UXqBk2sKMoiW8j83PTTynqGc4qoxDSJMEKwKHMpr?cluster=devnet](https://explorer.solana.com/tx/3jW7T54VXShmqagSuTq1m8BfAkyQk4UyfovxxCaBJNZMs861UXqBk2sKMoiW8j83PTTynqGc4qoxDSJMEKwKHMpr?cluster=devnet) |

Attester was funded with ~2.5 SOL on devnet (not mainnet traction). Public `requestAirdrop` was dry at the time; this is a one-wallet demo receipt.

### Prerequisites

- Rust 1.85+ (host compiler; needed for `cargo test` because current `solana-program` crates use edition 2024)
- [Solana / Agave CLI](https://docs.anza.xyz/cli/install) (`solana`, `cargo-build-sbf`)
- Node.js 20+

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version
```

### Generate keypairs (do not commit secrets)

Private key JSON stays under `.keys/` (gitignored). Only public keys belong in docs.

```bash
mkdir -p .keys
solana-keygen new --no-bip39-passphrase --outfile .keys/devnet-attester.json
solana-keygen new --no-bip39-passphrase --outfile .keys/program-keypair.json
solana-keygen pubkey .keys/devnet-attester.json
solana-keygen pubkey .keys/program-keypair.json
```

If you generate a **new** program keypair, set `declare_id!` in `programs/claimlock-attestation/src/lib.rs` and `programs/claimlock-attestation/program-id.txt` to that pubkey before building. This repo's documented program id matches the keypair used for the published devnet deploy.

### Airdrop (devnet)

```bash
chmod +x scripts/*.sh
./scripts/airdrop-devnet.sh
```

Or:

```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 2 .keys/devnet-attester.json
```

The public faucet rate-limits and sometimes runs dry (`requestAirdrop` HTTP 429). Retry after a pause, use [other documented faucets](https://solana.com/developers/cookbook/development/airdrops-and-faucets), or mine via the Ellipsis Labs proof-of-work faucet when those accounts are funded (`npx tsx scripts/pow-mine.ts`). Deploying this ~77KB program typically needs on the order of ~1–2 SOL for rent + fees.

### Build

Host layout tests (no BPF):

```bash
cargo test -p claimlock-attestation
```

SBF program:

```bash
./scripts/build-program.sh
# → target/deploy/claimlock_attestation.so
```

### Deploy (devnet)

```bash
./scripts/deploy-devnet.sh
```

Confirm the printed program id equals `2SzLAUB9oMh9k5zkTXnSnZ4KJHxPNcf9JokBssggBiYu` (or your replacement id).

### Run the demo

The client SHA-256s a **synthetic** locked claim-set (`client/fixtures/locked-claim-set.demo.json` — demo composite, no customers/PII). By default it adds a `demoRunId` timestamp so re-runs create a new PDA instead of colliding.

```bash
cd client
npm install
CLAIMLOCK_KEYPAIR=../.keys/devnet-attester.json npm run demo
# hash only (no SOL / no send):
npm run demo -- --dry-run --canonical
```

Stdout includes `claim_hash` (hex), transaction **signature**, and an explorer URL of the form:

`https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`

To hash the fixture only (same PDA every time):

```bash
CLAIMLOCK_KEYPAIR=../.keys/devnet-attester.json npm run demo -- --canonical
```

### Verify on explorer

1. Open the printed `explorer` URL (`cluster=devnet`).
2. Confirm the program id invoked is `2SzLAUB9oMh9k5zkTXnSnZ4KJHxPNcf9JokBssggBiYu`.
3. Open the PDA account listed in stdout; data starts with ASCII `CLATTEST` followed by the 32-byte hash.

### Account layout (113 bytes)

| Offset | Size | Field |
|--------|------|--------|
| 0 | 8 | discriminator `CLATTEST` |
| 8 | 32 | `claim_hash` |
| 40 | 32 | attester pubkey |
| 72 | 8 | unix timestamp (i64 LE) |
| 80 | 1 | memo length |
| 81 | 32 | memo (zero-padded) |

Instruction data: `u8 tag = 0` + 32-byte hash + `u8 memo_len` + memo bytes.

## Pitch + demo video (~3 min)

Download the Colosseum pitch+demo slide video:

- **Path in repo:** [`docs/media/claimlock-pitch-demo-3min.mp4`](docs/media/claimlock-pitch-demo-3min.mp4)
- **Raw download:** https://github.com/Cubiczan/ClaimLock/raw/main/docs/media/claimlock-pitch-demo-3min.mp4

~180s · 1280×720 · H.264 + AAC soft bed · no invented metrics/customers.

## Stack

- Solana native program (attestation / explorer-verifiable receipt) on **devnet**
- TypeScript demo client (`@solana/web3.js`)
- CHP engine patterns (propose / challenge / human lock) — off-chain prior art; not ported in this slice

## Who

Protocol/DAO finance, crypto-native SMBs, onchain fund admins.

## Repo

https://github.com/Cubiczan/ClaimLock
