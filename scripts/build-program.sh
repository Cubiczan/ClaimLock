#!/usr/bin/env bash
# Build the ClaimLock attestation SBF program.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
require_cli

if ! command -v cargo-build-sbf >/dev/null 2>&1; then
  echo "cargo-build-sbf not on PATH (install Solana/Agave CLI)." >&2
  exit 1
fi

cd "${ROOT}/programs/claimlock-attestation"
cargo-build-sbf
echo "Built: ${ROOT}/target/deploy/claimlock_attestation.so"
