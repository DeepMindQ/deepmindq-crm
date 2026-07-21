/* ═══════════════════════════════════════════════════
   Password Hashing Utility (Web Crypto PBKDF2)
   
   Uses PBKDF2 with SHA-256, 100k iterations.
   Stores salt + hash as hex strings separated by "$".
   No external dependencies required.
   ═══════════════════════════════════════════════════ */

const PBKDF2_ITERATIONS = 100_000;
const HASH_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8
  );

  return toHex(new Uint8Array(derivedBits));
}

/**
 * Hash a password. Returns "salt$hash" hex string.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await deriveKey(password, salt);
  return `${toHex(salt)}$${hash}`;
}

/**
 * Verify a password against a stored hash.
 * Stored format: "salt$hash"
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const [saltHex, hashHex] = storedHash.split('$');
    if (!saltHex || !hashHex) return false;
    const salt = fromHex(saltHex);
    const computedHash = await deriveKey(password, salt);
    // Constant-time comparison
    if (computedHash.length !== hashHex.length) return false;
    let result = 0;
    for (let i = 0; i < computedHash.length; i++) {
      result |= computedHash.charCodeAt(i) ^ hashHex.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}