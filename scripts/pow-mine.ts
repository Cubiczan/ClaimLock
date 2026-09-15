/**
 * Ellipsis Labs proof-of-work faucet miner (devnet).
 * Program: PoWSNH2hEZogtCg1Zgm51FnkmJperzYDgPK4fvs8taL
 *
 * Usage (from client/ after npm install):
 *   npx tsx ../scripts/pow-mine.ts --keypair ../.keys/devnet-attester.json --target-sol 1.5
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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

const POW_PROGRAM = new PublicKey("PoWSNH2hEZogtCg1Zgm51FnkmJperzYDgPK4fvs8taL");
const AIRDROP_DISC = createHash("sha256").update("global:airdrop").digest().subarray(0, 8);

type Spec = {
  spec: PublicKey;
  source: PublicKey;
  difficulty: number;
  amount: bigint;
};

function loadKeypair(p: string): Keypair {
  const raw = JSON.parse(readFileSync(p, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function leadingAs(pubkey: PublicKey): number {
  const s = pubkey.toBase58();
  let n = 0;
  for (const ch of s) {
    if (ch !== "A") break;
    n++;
  }
  return n;
}

function specPda(difficulty: number, amount: bigint): PublicKey {
  const d = Buffer.alloc(1);
  d.writeUInt8(difficulty);
  const a = Buffer.alloc(8);
  a.writeBigUInt64LE(amount);
  return PublicKey.findProgramAddressSync([Buffer.from("spec"), d, a], POW_PROGRAM)[0];
}

function sourcePda(spec: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("source"), spec.toBuffer()], POW_PROGRAM)[0];
}

function receiptPda(signer: PublicKey, difficulty: number): PublicKey {
  const d = Buffer.alloc(1);
  d.writeUInt8(difficulty);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), signer.toBuffer(), d],
    POW_PROGRAM,
  )[0];
}

async function loadSpecs(connection: Connection): Promise<Spec[]> {
  const accounts = await connection.getProgramAccounts(POW_PROGRAM, {
    filters: [{ dataSize: 17 }],
  });
  const out: Spec[] = [];
  for (const acc of accounts) {
    const difficulty = acc.account.data[8];
    const amount = acc.account.data.readBigUInt64LE(9);
    if (amount < 895880n) continue;
    const spec = acc.pubkey;
    const source = sourcePda(spec);
    const bal = await connection.getBalance(source);
    if (bal < Number(amount)) continue;
    out.push({ spec, source, difficulty, amount });
  }
  out.sort((a, b) => {
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return Number(b.amount - a.amount);
  });
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  let keypairPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.keys/devnet-attester.json");
  let targetSol = 1.5;
  let rpc = "https://api.devnet.solana.com";
  let minDiff = 3;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--keypair") keypairPath = path.resolve(argv[++i]);
    else if (argv[i] === "--target-sol") targetSol = Number(argv[++i]);
    else if (argv[i] === "--rpc") rpc = argv[++i];
    else if (argv[i] === "--min-diff") minDiff = Number(argv[++i]);
  }

  const payer = loadKeypair(keypairPath);
  const connection = new Connection(rpc, "confirmed");
  const targetLamports = BigInt(Math.floor(targetSol * 1e9));

  console.log("payer", payer.publicKey.toBase58());
  console.log("balance", await connection.getBalance(payer.publicKey));
  const specs = (await loadSpecs(connection)).filter((s) => s.difficulty >= minDiff);
  if (specs.length === 0) {
    throw new Error("No funded POW faucets found at/above min difficulty");
  }
  for (const s of specs.slice(0, 12)) {
    console.log(
      `faucet difficulty=${s.difficulty} reward=${Number(s.amount) / 1e9} SOL source=${s.source.toBase58()}`,
    );
  }

  const minPrefix = Math.min(...specs.map((s) => s.difficulty));
  console.log("grinding for leading A prefix >=", minPrefix);

  let gained = 0n;
  let attempts = 0;
  const started = Date.now();
  while (gained < targetLamports) {
    const signer = Keypair.generate();
    attempts++;
    const prefix = leadingAs(signer.publicKey);
    if (prefix < minPrefix) continue;

    const candidates = specs
      .filter((s) => s.difficulty <= prefix)
      .sort((a, b) => Number(b.amount - a.amount));
    console.log(
      `mined ${signer.publicKey.toBase58()} prefix=${prefix} after ${attempts} attempts (${Date.now() - started}ms)`,
    );

    const usedDiff = new Set<number>();
    for (const spec of candidates) {
      if (usedDiff.has(spec.difficulty)) continue;
      const payerBal = await connection.getBalance(payer.publicKey);
      if (payerBal < 5000) {
        throw new Error("Payer needs ~5000 lamports for fees before POW claims can be submitted");
      }
      const ix = new TransactionInstruction({
        programId: POW_PROGRAM,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: signer.publicKey, isSigner: true, isWritable: false },
          { pubkey: receiptPda(signer.publicKey, spec.difficulty), isSigner: false, isWritable: true },
          { pubkey: spec.spec, isSigner: false, isWritable: false },
          { pubkey: spec.source, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(AIRDROP_DISC),
      });
      try {
        const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer, signer], {
          commitment: "confirmed",
        });
        gained += spec.amount;
        usedDiff.add(spec.difficulty);
        console.log(`claimed ${Number(spec.amount) / 1e9} SOL  ${sig}  total=${Number(gained) / 1e9}`);
      } catch (err) {
        console.log("claim failed:", err instanceof Error ? err.message : err);
      }
    }
  }
  console.log("done. balance", await connection.getBalance(payer.publicKey));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
