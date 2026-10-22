import { argon2, randomBytes, timingSafeEqual } from "node:crypto";

const ARGON2_VERSION = 19;
const ARGON2_MEMORY = 64 * 1024;
const ARGON2_PASSES = 3;
const ARGON2_PARALLELISM = 1;
const ARGON2_TAG_LENGTH = 32;
const SALT_LENGTH = 16;

interface Argon2Parameters {
  memory: number;
  passes: number;
  parallelism: number;
  tagLength: number;
}

export interface PasswordVerificationResult {
  valid: boolean;
  needsRehash: boolean;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await deriveArgon2id(password, salt, {
    memory: ARGON2_MEMORY,
    passes: ARGON2_PASSES,
    parallelism: ARGON2_PARALLELISM,
    tagLength: ARGON2_TAG_LENGTH,
  });

  return `$argon2id$v=${ARGON2_VERSION}$m=${ARGON2_MEMORY},t=${ARGON2_PASSES},p=${ARGON2_PARALLELISM}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<PasswordVerificationResult> {
  const parsed = parseArgon2idHash(encodedHash);
  if (!parsed) return { valid: false, needsRehash: false };

  const calculatedHash = await deriveArgon2id(password, parsed.salt, {
    memory: parsed.memory,
    passes: parsed.passes,
    parallelism: parsed.parallelism,
    tagLength: parsed.hash.length,
  });
  const valid = calculatedHash.length === parsed.hash.length && timingSafeEqual(calculatedHash, parsed.hash);
  const needsRehash =
    valid &&
    (parsed.memory !== ARGON2_MEMORY ||
      parsed.passes !== ARGON2_PASSES ||
      parsed.parallelism !== ARGON2_PARALLELISM ||
      parsed.hash.length !== ARGON2_TAG_LENGTH);

  return { valid, needsRehash };
}

function deriveArgon2id(password: string, salt: Buffer, parameters: Argon2Parameters) {
  return new Promise<Buffer>((resolve, reject) => {
    argon2(
      "argon2id",
      {
        message: password,
        nonce: salt,
        memory: parameters.memory,
        passes: parameters.passes,
        parallelism: parameters.parallelism,
        tagLength: parameters.tagLength,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

function parseArgon2idHash(encodedHash: string) {
  const match = /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/u.exec(encodedHash);
  if (!match || Number(match[1]) !== ARGON2_VERSION) return null;

  const memory = Number(match[2]);
  const passes = Number(match[3]);
  const parallelism = Number(match[4]);
  const salt = Buffer.from(match[5], "base64");
  const hash = Buffer.from(match[6], "base64");

  if (
    memory < 8 * 1024 ||
    memory > 256 * 1024 ||
    passes < 1 ||
    passes > 10 ||
    parallelism < 1 ||
    parallelism > 8 ||
    salt.length < 16 ||
    hash.length < 16 ||
    hash.length > 64
  ) {
    return null;
  }

  return { memory, passes, parallelism, salt, hash };
}

function toBase64(value: Buffer) {
  return value.toString("base64").replace(/=+$/u, "");
}
