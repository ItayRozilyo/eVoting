/**
 * Elliptic Curve Diffie-Hellman (ECDH) Key Exchange
 * 
 * From Understanding Cryptography Chapter 9:
 * - Alice computes: aB = a(bP) = abP
 * - Bob computes: bA = b(aP) = abP
 * - Both arrive at same shared secret point
 */

import {
  Point,
  scalarMultiply,
  getGenerator,
  generatePrivateKeySync,
  generatePublicKey,
  privateKeyToHex,
  hexToPrivateKey,
  compressPublicKey,
  decompressPublicKey,
  mod,
  CURVE
} from './ecc.js';
import crypto from 'crypto';

/**
 * Generate an ephemeral key pair for ECDH
 */
function generateEphemeralKeyPair() {
  const privateKey = generatePrivateKeySync();
  const publicKey = generatePublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    privateKeyHex: privateKeyToHex(privateKey),
    publicKeyCompressed: compressPublicKey(publicKey)
  };
}

/**
 * Compute shared secret from our private key and their public key
 * sharedSecret = ourPrivateKey * theirPublicKey
 */
function computeSharedSecret(ourPrivateKey, theirPublicKey) {
  // Ensure proper types
  const privKey = typeof ourPrivateKey === 'string' 
    ? hexToPrivateKey(ourPrivateKey) 
    : ourPrivateKey;
  
  const pubKey = typeof theirPublicKey === 'string'
    ? decompressPublicKey(theirPublicKey)
    : theirPublicKey;

  // Compute shared point
  const sharedPoint = scalarMultiply(privKey, pubKey);
  
  // Return x-coordinate as shared secret (standard practice)
  return sharedPoint.x;
}

/**
 * Derive a symmetric key from the shared secret using SHA-256
 */
function deriveSymmetricKey(sharedSecret) {
  const secretHex = sharedSecret.toString(16).padStart(64, '0');
  const secretBuffer = Buffer.from(secretHex, 'hex');
  const hash = crypto.createHash('sha256').update(secretBuffer).digest();
  return hash;
}

/**
 * Complete ECDH key exchange - returns session key
 */
function performECDH(ourPrivateKey, theirPublicKey) {
  const sharedSecret = computeSharedSecret(ourPrivateKey, theirPublicKey);
  const sessionKey = deriveSymmetricKey(sharedSecret);
  return sessionKey;
}

/**
 * ECDH session object for managing key exchange
 */
class ECDHSession {
  constructor() {
    const { privateKey, publicKey, privateKeyHex, publicKeyCompressed } = generateEphemeralKeyPair();
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.privateKeyHex = privateKeyHex;
    this.publicKeyCompressed = publicKeyCompressed;
    this.sessionKey = null;
    this.peerPublicKey = null;
  }

  /**
   * Get our public key to send to peer
   */
  getPublicKey() {
    return this.publicKeyCompressed;
  }

  /**
   * Set peer's public key and compute session key
   */
  setRemotePublicKey(peerPublicKeyCompressed) {
    this.peerPublicKey = decompressPublicKey(peerPublicKeyCompressed);
    this.sessionKey = performECDH(this.privateKey, this.peerPublicKey);
    return this.sessionKey;
  }

  /**
   * Get the derived session key (must call setRemotePublicKey first)
   */
  getSessionKey() {
    if (!this.sessionKey) {
      throw new Error('Session key not yet derived. Call setRemotePublicKey first.');
    }
    return this.sessionKey;
  }
}

export {
  generateEphemeralKeyPair,
  computeSharedSecret,
  deriveSymmetricKey,
  performECDH,
  ECDHSession
};
