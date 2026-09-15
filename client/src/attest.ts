/**
 * ClaimLock demo: SHA-256 a synthetic locked claim-set and submit attest_claim_hash on Solana devnet.
 *
 * Usage:
 *   CLAIMLOCK_KEYPAIR=.keys/devnet-attester.json npm run demo
 *
 * Optional:
 *   --memo claimlock-v0
 *   --canonical     hash the fixture only (re-runs collide on the same PDA)
 *   --rpc <url>
 *   --program-id <pubkey>
 */

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ATTESTATION_SEED,
  PROGRAM_ID_FALLBACK,
  packAttestInstruction,
  unpackAttestation,
} from "./layout.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function parseArgs(argv: string[]) {
  const out: {
    memo: string;
    canonical: boolean;
    dryRun: boolean;
    rpc?: string;
    programId?: string;
    keypair?: string;
  } = {
    memo: "claimlock-v0",
    canonical: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--canonical") out.canonical = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--memo") out.memo = argv[++i] ?? out.memo;
    else if (a === "--rpc") out.rpc = argv[++i];
    else if (a === "--program-id") out.programId = argv[++i];
    else if (a === "--keypair") out.keypair = argv[++i];
  }
  return out;
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(",")}}`;
}

function loadKeypair(filePath: string): Keypair {
  const candidates = path.isAbsolute(filePath)
    ? [filePath]
    : [path.resolve(process.cwd(), filePath), path.resolve(repoRoot, filePath)];
  const resolved = candidates.find((p) => existsSync(p));
  if (!resolved) {
    throw new Error(
      `Keypair not found at ${filePath}. Generate with:\n  mkdir -p .keys && solana-keygen new --no-bip39-passphrase --outfile .keys/devnet-attester.json`,
    );
  }
  const raw = JSON.parse(readFileSync(resolved, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function readProgramId(): string {
  const txt = path.join(repoRoot, "programs/claimlock-attestation/program-id.txt");
  if (existsSync(txt)) {
    return readFileSync(txt, "utf8").trim();
  }
  return PROGRAM_ID_FALLBACK;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rpc = args.rpc ?? process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
  const programId = new PublicKey(args.programId ?? process.env.CLAIMLOCK_PROGRAM_ID ?? readProgramId());
  const keypairPath =
    args.keypair ?? process.env.CLAIMLOCK_KEYPAIR ?? path.join(repoRoot, ".keys/devnet-attester.json");

  const fixturePath = path.join(__dirname, "../fixtures/locked-claim-set.demo.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
  const claimSet = args.canonical
    ? fixture
    : { ...fixture, demoRunId: process.env.CLAIMLOCK_RUN_ID ?? new Date().toISOString() };

  const canonical = canonicalStringify(claimSet);
  const claimHash = createHash("sha256").update(canonical).digest();
  const memo = args.memo;

  console.log("ClaimLock attestation demo (Solana devnet)");
  console.log("  program id:   ", programId.toBase58());
  console.log("  claim_hash:   ", claimHash.toString("hex"));
  console.log("  memo:         ", memo);
  if (!args.canonical) {
    console.log("  demoRunId:    ", (claimSet as { demoRunId: string }).demoRunId);
  }

  if (args.dryRun) {
    console.log("  dry-run:      no transaction sent");
    return;
  }

  const attester = loadKeypair(keypairPath);
  const connection = new Connection(rpc, "confirmed");

  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(ATTESTATION_SEED), attester.publicKey.toBuffer(), claimHash],
    programId,
  );

  console.log("  attester:     ", attester.publicKey.toBase58());
  console.log("  PDA:          ", pda.toBase58());

  const existing = await connection.getAccountInfo(pda);
  if (existing) {
    const record = unpackAttestation(Buffer.from(existing.data), (bytes) => new PublicKey(bytes).toBase58());
    console.log("\nAttestation already on-chain (same attester + hash). Not sending a duplicate.");
    console.log(JSON.stringify(record, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
    console.log(`\nAccount: https://explorer.solana.com/address/${pda.toBase58()}?cluster=devnet`);
    return;
  }

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: attester.publicKey, isSigner: true, isWritable: true },
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: packAttestInstruction(claimHash, memo),
  });

  const tx = new Transaction().add(ix);
  const signature = await sendAndConfirmTransaction(connection, tx, [attester], {
    commitment: "confirmed",
  });

  const explorer = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  console.log("  signature:    ", signature);
  console.log("  explorer:     ", explorer);

  const confirmed = await connection.getAccountInfo(pda);
  if (!confirmed) {
    throw new Error("transaction confirmed but attestation account missing");
  }
  const record = unpackAttestation(Buffer.from(confirmed.data), (bytes) => new PublicKey(bytes).toBase58());
  console.log("  on-chain:     ", JSON.stringify(record, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
