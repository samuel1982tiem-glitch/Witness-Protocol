// Media handling: EXIF stripping + hashing prep.

import { sha256Hex } from "./crypto"

export interface ProcessedMedia {
  bytes: ArrayBuffer
  mimeType: string
  size: number
  sha256: string
}

/**
 * Re-encode an image through a canvas to drop EXIF/metadata.
 * Images are also resized to reduce memory usage on Android.
 */
export async function stripImageMetadata(file: Blob): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file

  try {
    const bitmap = await createImageBitmap(file)

    const MAX_SIZE = 1600

    let width = bitmap.width
    let height = bitmap.height

    if (width > height && width > MAX_SIZE) {
      height = Math.round(height * MAX_SIZE / width)
      width = MAX_SIZE
    } else if (height > MAX_SIZE) {
      width = Math.round(width * MAX_SIZE / height)
      height = MAX_SIZE
    }

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close?.()
      return file
    }

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const outType =
      file.type === "image/png" ? "image/png" : "image/jpeg"

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), outType, 0.85),
    )

    return blob ?? file
  } catch {
    return file
  }
}

/**
 * Prepare a file for encrypted storage:
 * strips metadata from images, then computes a SHA-256 hash of the bytes.
 */
export async function processMedia(
  file: Blob,
  isImage: boolean,
): Promise<ProcessedMedia> {
  const cleaned = isImage ? await stripImageMetadata(file) : file
  const bytes = await cleaned.arrayBuffer()
  const sha256 = await sha256Hex(bytes)
  return {
    bytes,
    mimeType: cleaned.type || file.type || "application/octet-stream",
    size: bytes.byteLength,
    sha256,
  }
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
