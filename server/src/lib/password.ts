import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from "crypto";

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Password hashing built on Node's native `scrypt` — a memory-hard KDF that
 * OWASP lists as an acceptable choice for password storage, with no native
 * build dependencies. Hashes are self-describing so the cost parameters can be
 * raised over time without breaking verification of older hashes:
 *
 *   scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
 */
const COST = 1 << 15; // N: CPU/memory cost
const BLOCK_SIZE = 8; // r
const PARALLELIZATION = 1; // p
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
// scrypt needs ~128 * N * r bytes; give it headroom above the 32MB default.
const MAX_MEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEM,
  });
  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

/**
 * Verify a plaintext password against a stored hash in constant time. Returns
 * `false` (rather than throwing) for malformed hashes so callers can treat it
 * as a failed login.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, costStr, blockStr, parallelStr, saltHex, hashHex] = parts;
  const cost = Number(costStr);
  const blockSize = Number(blockStr);
  const parallelization = Number(parallelStr);
  if (!cost || !blockSize || !parallelization || !saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scryptAsync(password, salt, expected.length, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: MAX_MEM,
  });

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
