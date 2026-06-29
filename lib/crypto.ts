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
  {
    name: "AES-GCM",
    iv: payload.iv,
  },
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
