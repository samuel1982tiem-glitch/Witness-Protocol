// Witness Protocol
// Copyright (C) 2026 Samuel Matias Tiem
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

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
  // Check if it's a video file
  const isVideo = file.type?.startsWith('video/') || false;
  
  // For videos, use chunked processing to avoid memory issues
  if (isVideo) {
    try {
      // For large videos, process in chunks
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalSize = file.size;
      const chunks: Uint8Array[] = [];
      let offset = 0;
      
      // Read the file in chunks
      while (offset < totalSize) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, totalSize));
        const buffer = await chunk.arrayBuffer();
        chunks.push(new Uint8Array(buffer));
        offset += chunkSize;
      }
      
      // Combine all chunks
      const combinedLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(combinedLength);
      let position = 0;
      for (const chunk of chunks) {
        combined.set(chunk, position);
        position += chunk.length;
      }
      
      // Compute SHA-256 hash
      const sha256 = await sha256Hex(combined.buffer);
      
      return {
        bytes: combined.buffer,
        mimeType: file.type || 'video/mp4',
        size: file.size,
        sha256,
      };
    } catch (error) {
      console.error('Video processing error:', error);
      // Fallback: try processing without chunking
      const bytes = await file.arrayBuffer();
      const sha256 = await sha256Hex(bytes);
      return {
        bytes,
        mimeType: file.type || 'video/mp4',
        size: file.size,
        sha256,
      };
    }
  }
  
  // For images, strip metadata and process normally
  const cleaned = isImage ? await stripImageMetadata(file) : file;
  const bytes = await cleaned.arrayBuffer();
  const sha256 = await sha256Hex(bytes);
  
  return {
    bytes,
    mimeType: cleaned.type || file.type || 'application/octet-stream',
    size: bytes.byteLength,
    sha256,
  };
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
