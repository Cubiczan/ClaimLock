#!/usr/bin/env bash
# Deploy ClaimLock attestation program to Solana devnet using the gitignored program keypair.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
require_cli
solana_devnet

SO="${ROOT}/target/deploy/claimlock_attestation.so"
if [[ ! -f "${SO}" ]]; then
  echo "Missing ${SO}; run scripts/build-program.sh first." >&2
  exit 1
fi
if [[ ! -f "${PROGRAM_KEYPAIR}" ]]; then
  echo "Missing ${PROGRAM_KEYPAIR}; run scripts/airdrop-devnet.sh first." >&2
  exit 1
fi
if [[ ! -f "${ATTESTER_KEYPAIR}" ]]; then
  echo "Missing attester keypair ${ATTESTER_KEYPAIR}." >&2
  exit 1
fi

EXPECTED="$(tr -d '[:space:]' < "${PROGRAM_ID_FILE}")"
ACTUAL="$(solana-keygen pubkey "${PROGRAM_KEYPAIR}")"
if [[ "${EXPECTED}" != "${ACTUAL}" ]]; then
  echo "program-id.txt (${EXPECTED}) != program keypair pubkey (${ACTUAL})" >&2
  echo "declare_id! and program-id.txt must match the keypair used to deploy." >&2
  exit 1
fi

echo "Deploying ${SO}"
echo "  program id: ${ACTUAL}"
echo "  payer:      $(solana-keygen pubkey "${ATTESTER_KEYPAIR}")"
echo "  cluster:    ${CLUSTER_URL}"

solana program deploy "${SO}" \
  --program-id "${PROGRAM_KEYPAIR}" \
  --url "${CLUSTER_URL}" \
  --keypair "${ATTESTER_KEYPAIR}"

echo
echo "Program: https://explorer.solana.com/address/${ACTUAL}?cluster=devnet"
