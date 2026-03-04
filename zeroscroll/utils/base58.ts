// base58 encoding function for encoding binary data (like public keys) into a human-readable format
// used in crypto addresses for less error prone copying and pasting
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = 58n;

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  // Count leading zeros
  let zeros = 0;
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    zeros++;
  }

  // Convert to big integer
  let num = 0n;
  for (const byte of bytes) {
    num = num * 256n + BigInt(byte);
  }

  // Convert to base58
  let result = "";
  while (num > 0n) {
    const mod = Number(num % BASE);
    result = ALPHABET[mod] + result;
    num = num / BASE;
  }

  // Add leading '1's for each leading zero byte
  return "1".repeat(zeros) + result;
}
