/**
 * AEGIS Crypto Module
 * Client-side encryption using Web Crypto API
 * AES-256-GCM + PBKDF2 key derivation
 * Zero server dependency - everything happens in the browser
 */

const AegisCrypto = (() => {
  'use strict';

  const SALT_LENGTH = 16;
  const IV_LENGTH = 12;
  const PBKDF2_ITERATIONS = 600000;
  const KEY_LENGTH = 256;

  /**
   * Derive an AES-256 key from a passphrase using PBKDF2
   */
  async function deriveKey(passphrase, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data with AES-256-GCM
   * Returns: { salt, iv, ciphertext } as Uint8Arrays
   */
  async function encrypt(data, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveKey(passphrase, salt);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );

    return {
      salt: salt,
      iv: iv,
      ciphertext: new Uint8Array(encrypted)
    };
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  async function decrypt(encryptedData, passphrase) {
    const { salt, iv, ciphertext } = encryptedData;
    const key = await deriveKey(passphrase, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Pack encrypted data into a single binary blob
   * Format: [salt:16][iv:12][ciphertext:...]
   */
  function packEncrypted({ salt, iv, ciphertext }) {
    const packed = new Uint8Array(salt.length + iv.length + ciphertext.length);
    packed.set(salt, 0);
    packed.set(iv, salt.length);
    packed.set(ciphertext, salt.length + iv.length);
    return packed;
  }

  /**
   * Unpack binary blob into salt, iv, ciphertext
   */
  function unpackEncrypted(packed) {
    return {
      salt: packed.slice(0, SALT_LENGTH),
      iv: packed.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH),
      ciphertext: packed.slice(SALT_LENGTH + IV_LENGTH)
    };
  }

  /**
   * Encrypt a file (ArrayBuffer) and return packed binary
   */
  async function encryptFile(fileBuffer, passphrase) {
    const data = new Uint8Array(fileBuffer);
    const encrypted = await encrypt(data, passphrase);
    return packEncrypted(encrypted);
  }

  /**
   * Decrypt a packed binary back to ArrayBuffer
   */
  async function decryptFile(packedBuffer, passphrase) {
    const packed = new Uint8Array(packedBuffer);
    const unpacked = unpackEncrypted(packed);
    return decrypt(unpacked, passphrase);
  }

  /**
   * Encrypt a string and return packed binary
   */
  async function encryptString(text, passphrase) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const encrypted = await encrypt(data, passphrase);
    return packEncrypted(encrypted);
  }

  /**
   * Decrypt packed binary back to string
   */
  async function decryptString(packedBuffer, passphrase) {
    const decrypted = await decryptFile(packedBuffer, passphrase);
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Generate SHA-256 hash of data (for Proof of Existence)
   */
  async function sha256(data) {
    const buffer = data instanceof ArrayBuffer ? data : 
                   data instanceof Uint8Array ? data.buffer :
                   new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate a random ID
   */
  function generateId(length = 16) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 to ArrayBuffer
   */
  function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Strip metadata from image files (EXIF, GPS, etc.)
   * Works by re-encoding through Canvas
   */
  async function stripImageMetadata(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          const cleanFile = new File([blob], file.name, {
            type: 'image/png',
            lastModified: 0
          });
          resolve(cleanFile);
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to process image'));
      };

      img.src = url;
    });
  }

  /**
   * Estimate passphrase strength (0-4)
   */
  function estimateStrength(passphrase) {
    if (!passphrase) return 0;
    let score = 0;
    if (passphrase.length >= 8) score++;
    if (passphrase.length >= 16) score++;
    if (/[A-Z]/.test(passphrase) && /[a-z]/.test(passphrase)) score++;
    if (/[0-9]/.test(passphrase)) score++;
    if (/[^A-Za-z0-9]/.test(passphrase)) score++;
    return Math.min(score, 4);
  }

  /**
   * Create an AEGIS evidence package
   * Contains encrypted files + metadata + proof hashes
   */
  async function createEvidencePackage(files, metadata, passphrase) {
    const evidenceFiles = [];
    const proofHashes = [];

    for (const file of files) {
      // Read file
      const buffer = await file.arrayBuffer();
      
      // Hash original for proof of existence
      const originalHash = await sha256(buffer);
      proofHashes.push({
        filename: file.name,
        size: file.size,
        hash: originalHash,
        timestamp: new Date().toISOString()
      });

      // Encrypt file
      const encrypted = await encryptFile(buffer, passphrase);
      evidenceFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        data: bufferToBase64(encrypted)
      });
    }

    // Create package manifest
    const manifest = {
      version: '1.0.0',
      created: new Date().toISOString(),
      id: generateId(),
      metadata: metadata,
      files: evidenceFiles.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size
      })),
      proofHashes: proofHashes
    };

    // Encrypt manifest
    const manifestJson = JSON.stringify(manifest);
    const encryptedManifest = await encryptString(manifestJson, passphrase);

    // Create combined proof hash (hash of all individual hashes)
    const combinedProof = await sha256(
      proofHashes.map(p => p.hash).join(':')
    );

    return {
      package: {
        aegis: true,
        version: '1.0.0',
        id: manifest.id,
        created: manifest.created,
        manifest: bufferToBase64(encryptedManifest),
        files: evidenceFiles,
        combinedProofHash: combinedProof
      },
      proofHashes: proofHashes,
      combinedProofHash: combinedProof
    };
  }

  /**
   * Decrypt an evidence package
   */
  async function decryptEvidencePackage(pkg, passphrase) {
    // Decrypt manifest
    const manifestBuffer = base64ToBuffer(pkg.manifest);
    const manifestJson = await decryptString(manifestBuffer, passphrase);
    const manifest = JSON.parse(manifestJson);

    // Decrypt files
    const decryptedFiles = [];
    for (const encFile of pkg.files) {
      const encBuffer = base64ToBuffer(encFile.data);
      const decBuffer = await decryptFile(encBuffer, passphrase);
      decryptedFiles.push({
        name: encFile.name,
        type: encFile.type,
        data: decBuffer
      });
    }

    return {
      manifest: manifest,
      files: decryptedFiles
    };
  }

  // Public API
  return {
    encrypt,
    decrypt,
    encryptFile,
    decryptFile,
    encryptString,
    decryptString,
    sha256,
    generateId,
    bufferToBase64,
    base64ToBuffer,
    stripImageMetadata,
    estimateStrength,
    createEvidencePackage,
    decryptEvidencePackage,
    packEncrypted,
    unpackEncrypted
  };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AegisCrypto;
}
