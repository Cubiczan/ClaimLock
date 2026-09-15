# Local keypairs (not committed)

This directory holds **local-only** Solana keypairs. JSON secret files are gitignored.

## Generate

```bash
mkdir -p .keys
solana-keygen new --no-bip39-passphrase --outfile .keys/devnet-attester.json
solana-keygen new --no-bip39-passphrase --outfile .keys/program-keypair.json
```

Print public keys (safe to share / commit in docs):

```bash
solana-keygen pubkey .keys/devnet-attester.json
solana-keygen pubkey .keys/program-keypair.json
```

## Use on devnet

```bash
solana config set --url https://api.devnet.solana.com
solana config set --keypair .keys/devnet-attester.json
solana airdrop 2
```

Do **not** commit `*.json` keypairs. The attester **public** key may be documented; the program id is the public key of `program-keypair.json` and is recorded in `programs/claimlock-attestation/program-id.txt`.
