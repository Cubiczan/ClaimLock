/** Mirrors programs/claimlock-attestation packed layout. */

export const PROGRAM_ID_FALLBACK = "2SzLAUB9oMh9k5zkTXnSnZ4KJHxPNcf9JokBssggBiYu";

export const INSTRUCTION_ATTEST = 0;
export const ATTESTATION_SEED = "attestation";
export const DISCRIMINATOR = Buffer.from("CLATTEST");
export const MAX_MEMO_LEN = 32;
export const ATTESTATION_SIZE = 113;

export function packAttestInstruction(claimHash: Uint8Array, memo: string): Buffer {
  if (claimHash.length !== 32) {
    throw new Error(`claim_hash must be 32 bytes, got ${claimHash.length}`);
  }
  const memoBytes = Buffer.from(memo, "utf8");
  if (memoBytes.length > MAX_MEMO_LEN) {
    throw new Error(`memo exceeds ${MAX_MEMO_LEN} bytes`);
  }
  const data = Buffer.alloc(34 + memoBytes.length);
  data.writeUInt8(INSTRUCTION_ATTEST, 0);
  Buffer.from(claimHash).copy(data, 1);
  data.writeUInt8(memoBytes.length, 33);
  memoBytes.copy(data, 34);
  return data;
}

export type AttestationRecord = {
  claimHashHex: string;
  attester: string;
  unixTimestamp: bigint;
  memo: string;
};

export function unpackAttestation(data: Buffer, attesterBase58: (bytes: Buffer) => string): AttestationRecord {
  if (data.length < ATTESTATION_SIZE) {
    throw new Error(`attestation account too small: ${data.length}`);
  }
  if (!data.subarray(0, 8).equals(DISCRIMINATOR)) {
    throw new Error("attestation discriminator mismatch");
  }
  const memoLen = data[80];
  return {
    claimHashHex: data.subarray(8, 40).toString("hex"),
    attester: attesterBase58(data.subarray(40, 72)),
    unixTimestamp: data.readBigInt64LE(72),
    memo: data.subarray(81, 81 + memoLen).toString("utf8"),
  };
}
