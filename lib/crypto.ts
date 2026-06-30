// Client-side cryptography helpers.
// - AES-256-GCM for confidentiality
// - PBKDF2 (SHA-256) for passcode-based key derivation
// - SHA-256 for file/record hashing
//
// All operations use the Web Crypto API and run entirely in the browser.

const PBKDF2_ITERATIONS = 250_000
const SALT_BYTES = 16
const IV_BYTES = 12

/** A sealed ciphertext payload safe to persist in IndexedDB. */
export interface CipherPayload {
  iv: Uint8Array
  data: ArrayBuffer
}

function getCrypto(): Crypto {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto
  }
  throw new Error("Web Crypto API is not available in this environment.")
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  getCrypto().getRandomValues(bytes)
  return bytes
}

export function generateSalt(): Uint8Array {
  return randomBytes(SALT_BYTES)
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Derive a 256-bit AES-GCM key from a passcode + salt. */
export async function deriveKey(
  passcode: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const crypto = getCrypto()
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function encryptBytes(
  key: CryptoKey,
  data: ArrayBuffer | Uint8Array,
): Promise<CipherPayload> {
  const crypto = getCrypto()
  const iv = randomBytes(IV_BYTES)
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    data as BufferSource,
  )
  return { iv, data: cipher }
}

export async function decryptBytes(
  key: CryptoKey,
  payload: CipherPayload,
): Promise<ArrayBuffer> {
  const crypto = getCrypto()
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: payload.iv },
    key,
    payload.data,
  )
}

export async function encryptJSON(
  key: CryptoKey,
  value: unknown,
): Promise<CipherPayload> {
  return encryptBytes(key, encoder.encode(JSON.stringify(value)))
}

export async function decryptJSON<T>(
  key: CryptoKey,
  payload: CipherPayload,
): Promise<T> {
  const buffer = await decryptBytes(key, payload)
  return JSON.parse(decoder.decode(buffer)) as T
}

/**
 * Encrypt raw bytes for v4 backup evidence storage.
 * Output format: [12 bytes IV][N bytes AES-GCM ciphertext]
 * This is a self-contained blob — no separate IV field needed.
 */
export async function encryptRaw(
  key: CryptoKey,
  data: Uint8Array,
): Promise<Uint8Array> {
  const crypto = getCrypto()
  const iv = randomBytes(IV_BYTES)
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  )
  // Prepend IV to ciphertext: [IV(12)][ciphertext(N)]
  const result = new Uint8Array(IV_BYTES + cipher.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(cipher), IV_BYTES)
  return result
}

/**
 * Decrypt raw bytes produced by encryptRaw.
 * Reads the 12-byte IV prefix then decrypts the remainder.
 */
export async function decryptRaw(
  key: CryptoKey,
  blob: Uint8Array,
): Promise<Uint8Array> {
  if (blob.byteLength < IV_BYTES + 1) {
    throw new Error("Encrypted blob is too small to be valid.")
  }
  const crypto = getCrypto()
  const iv = blob.slice(0, IV_BYTES)
  const ciphertext = blob.slice(IV_BYTES)
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  )
  return new Uint8Array(plain)
}

/**
 * Compress a Uint8Array using deflate-raw (RFC 1951).
 * Available in all modern Android WebViews (Chrome 80+).
 */
export async function compress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("deflate-raw")
  const writer = stream.writable.getWriter()
  const reader = stream.readable.getReader()
  writer.write(data)
  writer.close()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/**
 * Decompress a Uint8Array produced by compress().
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("deflate-raw")
  const writer = stream.writable.getWriter()
  const reader = stream.readable.getReader()
  writer.write(data)
  writer.close()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/** SHA-256 digest as a lowercase hex string. */
export async function sha256Hex(
  data: ArrayBuffer | Uint8Array | string,
): Promise<string> {
  const crypto = getCrypto()
  const bytes =
    typeof data === "string" ? encoder.encode(data) : (data as BufferSource)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return bufferToHex(digest)
}

export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let hex = ""
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0")
  }
  return hex
}

const VERIFIER_PLAINTEXT = "witness-protocol-vault-verifier-v1"

/** Build an encrypted token used to validate a passcode on unlock. */
export async function createVerifier(key: CryptoKey): Promise<CipherPayload> {
  return encryptBytes(key, encoder.encode(VERIFIER_PLAINTEXT))
}

export async function checkVerifier(
  key: CryptoKey,
  payload: CipherPayload,
): Promise<boolean> {
  try {
    const buffer = await decryptBytes(key, payload)
    return decoder.decode(buffer) === VERIFIER_PLAINTEXT
  } catch {
    return false
  }
}
