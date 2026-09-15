#!/usr/bin/env bash
# Shared env for ClaimLock Solana scripts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.local/share/solana/install/active_release/bin:${PATH}"

CLUSTER_URL="${SOLANA_RPC:-https://api.devnet.solana.com}"
ATTESTER_KEYPAIR="${CLAIMLOCK_KEYPAIR:-${ROOT}/.keys/devnet-attester.json}"
PROGRAM_KEYPAIR="${CLAIMLOCK_PROGRAM_KEYPAIR:-${ROOT}/.keys/program-keypair.json}"
PROGRAM_ID_FILE="${ROOT}/programs/claimlock-attestation/program-id.txt"

require_cli() {
  if ! command -v solana >/dev/null 2>&1; then
    echo "Solana CLI not found. Install with:" >&2
    echo "  sh -c \"\$(curl -sSfL https://release.anza.xyz/stable/install)\"" >&2
    echo "Then: export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\"" >&2
    exit 1
  fi
}

solana_devnet() {
  require_cli
  solana config set --url "${CLUSTER_URL}" >/dev/null
  if [[ -f "${ATTESTER_KEYPAIR}" ]]; then
    solana config set --keypair "${ATTESTER_KEYPAIR}" >/dev/null
  fi
}
