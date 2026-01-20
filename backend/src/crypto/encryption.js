/**
 * Symmetric Encryption using AES-256-GCM
 * Used with ECDH-derived session keys
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {Buffer} key - 32-byte key (from ECDH)
 * @returns {string} - Base64 encoded ciphertext with IV and auth tag
 */
function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV + authTag + ciphertext
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64')
  ]);
  
  return combined.toString('base64');
}

/**
 * Decrypt data using AES-256-GCM
 * Compatible with Web Crypto API format: IV | Ciphertext | AuthTag
 * @param {string} ciphertext - Base64 encoded ciphertext
 * @param {Buffer} key - 32-byte key (from ECDH)
 * @returns {string} - Decrypted plaintext
 */
function decrypt(ciphertext, key) {
  const combined = Buffer.from(ciphertext, 'base64');
  
  // Web Crypto API format: IV (12 bytes) | Ciphertext | AuthTag (16 bytes at end)
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, null, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hash data using SHA-256
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a random token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export {
  encrypt,
  decrypt,
  sha256,
  generateToken
};
