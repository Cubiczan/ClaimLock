#!/usr/bin/env bash
# Generate gitignored keypairs if missing, then airdrop SOL on Solana devnet.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
require_cli
mkdir -p "${ROOT}/.keys"

if [[ ! -f "${ATTESTER_KEYPAIR}" ]]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "${ATTESTER_KEYPAIR}"
  echo "Wrote attester keypair (gitignored): ${ATTESTER_KEYPAIR}"
fi
if [[ ! -f "${PROGRAM_KEYPAIR}" ]]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "${PROGRAM_KEYPAIR}"
  echo "Wrote program keypair (gitignored): ${PROGRAM_KEYPAIR}"
  solana-keygen pubkey "${PROGRAM_KEYPAIR}" > "${PROGRAM_ID_FILE}"
  echo "Program id: $(cat "${PROGRAM_ID_FILE}")"
  echo "Update declare_id! in programs/claimlock-attestation/src/lib.rs to match before building."
fi

echo "Attester pubkey: $(solana-keygen pubkey "${ATTESTER_KEYPAIR}")"
echo "Program id:      $(solana-keygen pubkey "${PROGRAM_KEYPAIR}")"

solana_devnet
RECIPIENT="$(solana-keygen pubkey "${ATTESTER_KEYPAIR}")"
echo "Airdropping 2 SOL to ${RECIPIENT} (devnet faucet may rate-limit; retry if it fails)..."
solana airdrop 2 "${RECIPIENT}" --url "${CLUSTER_URL}" || true
sleep 2
solana airdrop 2 "${RECIPIENT}" --url "${CLUSTER_URL}" || true
echo "Balance:"
solana balance "${RECIPIENT}" --url "${CLUSTER_URL}"
