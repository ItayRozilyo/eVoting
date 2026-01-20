/**
 * ECDH Key Exchange for Browser
 */

import {
  Point,
  scalarMultiply,
  generatePrivateKey,
  generatePublicKey,
  privateKeyToHex,
  hexToPrivateKey,
  compressPublicKey,
  decompressPublicKey
} from './ecc.js';

function generateEphemeralKeyPair() {
  const privateKey = generatePrivateKey();
  const publicKey = generatePublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    privateKeyHex: privateKeyToHex(privateKey),
    publicKeyCompressed: compressPublicKey(publicKey)
  };
}

function computeSharedSecret(ourPrivateKey, theirPublicKey) {
  const privKey = typeof ourPrivateKey === 'string' 
    ? hexToPrivateKey(ourPrivateKey) 
    : ourPrivateKey;
  
  const pubKey = typeof theirPublicKey === 'string'
    ? decompressPublicKey(theirPublicKey)
    : theirPublicKey;

  const sharedPoint = scalarMultiply(privKey, pubKey);
  return sharedPoint.x;
}

async function deriveSymmetricKey(sharedSecret) {
  const secretHex = sharedSecret.toString(16).padStart(64, '0');
  const secretBytes = new Uint8Array(secretHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
  const hashBuffer = await crypto.subtle.digest('SHA-256', secretBytes);
  return new Uint8Array(hashBuffer);
}

async function performECDH(ourPrivateKey, theirPublicKey) {
  const sharedSecret = computeSharedSecret(ourPrivateKey, theirPublicKey);
  const sessionKey = await deriveSymmetricKey(sharedSecret);
  return sessionKey;
}

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

  getPublicKey() {
    return this.publicKeyCompressed;
  }

  async setRemotePublicKey(peerPublicKeyCompressed) {
    this.peerPublicKey = decompressPublicKey(peerPublicKeyCompressed);
    this.sessionKey = await performECDH(this.privateKey, this.peerPublicKey);
    return this.sessionKey;
  }

  getSessionKey() {
    if (!this.sessionKey) {
      throw new Error('Session key not yet derived. Call setRemotePublicKey first.');
    }
    return this.sessionKey;
  }
}

// Browser-based AES-GCM encryption
async function encrypt(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'AES-GCM' }, false, ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(ciphertext, key) {
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'AES-GCM' }, false, ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}

async function sha256(data) {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export {
  generateEphemeralKeyPair,
  computeSharedSecret,
  deriveSymmetricKey,
  performECDH,
  ECDHSession,
  encrypt,
  decrypt,
  sha256
};
