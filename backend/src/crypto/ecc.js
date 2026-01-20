/**
 * Elliptic Curve Cryptography Implementation from Scratch
 * Using secp256k1 curve parameters
 * 
 * Based on Understanding Cryptography by Christof Paar and Jan Pelzl
 * Chapter 9 - Elliptic Curve Cryptography
 */

import crypto from 'crypto';

// secp256k1 curve parameters
// y² = x³ + ax + b (mod p)
const CURVE = {
  // Prime field
  p: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'),
  // Curve coefficients
  a: BigInt(0),
  b: BigInt(7),
  // Generator point G
  Gx: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
  Gy: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8'),
  // Order of the group (number of points)
  n: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'),
  // Cofactor
  h: BigInt(1)
};

/**
 * Modular arithmetic utilities
 */

// Extended Euclidean Algorithm for modular inverse
function extendedGcd(a, b) {
  if (a === 0n) return { gcd: b, x: 0n, y: 1n };
  const { gcd, x, y } = extendedGcd(mod(b, a), a);
  return { gcd, x: y - (b / a) * x, y: x };
}

// Modular operation ensuring positive result
function mod(a, m) {
  const result = a % m;
  return result >= 0n ? result : result + m;
}

// Modular inverse using extended Euclidean algorithm
function modInverse(a, m) {
  a = mod(a, m);
  const { gcd, x } = extendedGcd(a, m);
  if (gcd !== 1n) {
    throw new Error('Modular inverse does not exist');
  }
  return mod(x, m);
}

// Modular exponentiation using square-and-multiply
function modPow(base, exp, m) {
  base = mod(base, m);
  let result = 1n;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = mod(result * base, m);
    }
    exp = exp / 2n;
    base = mod(base * base, m);
  }
  return result;
}

/**
 * Point class representing a point on the elliptic curve
 */
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  // Check if point is at infinity (identity element)
  isInfinity() {
    return this.x === null && this.y === null;
  }

  // Create point at infinity
  static infinity() {
    return new Point(null, null);
  }

  // Check if point is on the curve
  isOnCurve() {
    if (this.isInfinity()) return true;
    const left = mod(this.y * this.y, CURVE.p);
    const right = mod(this.x * this.x * this.x + CURVE.a * this.x + CURVE.b, CURVE.p);
    return left === right;
  }

  // Point equality
  equals(other) {
    if (this.isInfinity() && other.isInfinity()) return true;
    if (this.isInfinity() || other.isInfinity()) return false;
    return this.x === other.x && this.y === other.y;
  }

  // Negate point (reflection over x-axis)
  negate() {
    if (this.isInfinity()) return Point.infinity();
    return new Point(this.x, mod(-this.y, CURVE.p));
  }

  // Convert to string representation
  toString() {
    if (this.isInfinity()) return 'Point(Infinity)';
    return `Point(${this.x.toString(16)}, ${this.y.toString(16)})`;
  }

  // Convert to JSON-serializable object
  toJSON() {
    if (this.isInfinity()) return { x: null, y: null };
    return { x: this.x.toString(16), y: this.y.toString(16) };
  }

  // Create point from JSON
  static fromJSON(json) {
    if (json.x === null && json.y === null) return Point.infinity();
    return new Point(BigInt('0x' + json.x), BigInt('0x' + json.y));
  }
}

/**
 * Point Addition on Elliptic Curve
 * Implements the formulas from the textbook:
 * x₃ = s² - x₁ - x₂ (mod p)
 * y₃ = s(x₁ - x₃) - y₁ (mod p)
 */
function pointAdd(P, Q) {
  // Handle infinity cases
  if (P.isInfinity()) return Q;
  if (Q.isInfinity()) return P;

  // If points are inverses, return infinity
  if (P.x === Q.x && mod(P.y + Q.y, CURVE.p) === 0n) {
    return Point.infinity();
  }

  let s;
  
  if (P.x === Q.x && P.y === Q.y) {
    // Point doubling: s = (3x₁² + a) / (2y₁)
    if (P.y === 0n) return Point.infinity();
    const numerator = mod(3n * P.x * P.x + CURVE.a, CURVE.p);
    const denominator = mod(2n * P.y, CURVE.p);
    s = mod(numerator * modInverse(denominator, CURVE.p), CURVE.p);
  } else {
    // Point addition: s = (y₂ - y₁) / (x₂ - x₁)
    const numerator = mod(Q.y - P.y, CURVE.p);
    const denominator = mod(Q.x - P.x, CURVE.p);
    s = mod(numerator * modInverse(denominator, CURVE.p), CURVE.p);
  }

  // Calculate new point
  const x3 = mod(s * s - P.x - Q.x, CURVE.p);
  const y3 = mod(s * (P.x - x3) - P.y, CURVE.p);

  return new Point(x3, y3);
}

/**
 * Point Doubling
 * Special case of point addition when P = Q
 */
function pointDouble(P) {
  return pointAdd(P, P);
}

/**
 * Scalar Multiplication using Double-and-Add Algorithm
 * Computes T = dP where d is a scalar and P is a point
 * 
 * From textbook:
 * FOR i = t-1 DOWNTO 0
 *   T = T + T (mod n)
 *   IF d_i = 1 THEN T = T + P (mod n)
 * RETURN T
 */
function scalarMultiply(k, P) {
  if (k === 0n) return Point.infinity();
  if (k < 0n) {
    k = -k;
    P = P.negate();
  }

  let result = Point.infinity();
  let addend = P;

  while (k > 0n) {
    if (k & 1n) {
      result = pointAdd(result, addend);
    }
    addend = pointDouble(addend);
    k = k >> 1n;
  }

  return result;
}

/**
 * Get generator point G
 */
function getGenerator() {
  return new Point(CURVE.Gx, CURVE.Gy);
}

/**
 * Generate a cryptographically secure random private key (Node.js)
 */
function generatePrivateKeySync() {
  const bytes = crypto.randomBytes(32);
  
  let privateKey = 0n;
  for (const byte of bytes) {
    privateKey = (privateKey << 8n) + BigInt(byte);
  }
  
  privateKey = mod(privateKey, CURVE.n - 1n) + 1n;
  return privateKey;
}

/**
 * Alias for compatibility
 */
function generatePrivateKey() {
  return generatePrivateKeySync();
}

/**
 * Generate public key from private key
 * Public key = privateKey * G
 */
function generatePublicKey(privateKey) {
  const G = getGenerator();
  return scalarMultiply(privateKey, G);
}

/**
 * Generate a key pair
 */
function generateKeyPair() {
  const privateKey = generatePrivateKeySync();
  const publicKey = generatePublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Convert private key to hex string
 */
function privateKeyToHex(privateKey) {
  return privateKey.toString(16).padStart(64, '0');
}

/**
 * Convert hex string to private key
 */
function hexToPrivateKey(hex) {
  return BigInt('0x' + hex);
}

/**
 * Compress public key (x-coordinate + parity of y)
 */
function compressPublicKey(publicKey) {
  if (publicKey.isInfinity()) return '00';
  const prefix = publicKey.y % 2n === 0n ? '02' : '03';
  return prefix + publicKey.x.toString(16).padStart(64, '0');
}

/**
 * Decompress public key
 */
function decompressPublicKey(compressed) {
  if (compressed === '00') return Point.infinity();
  
  const prefix = compressed.slice(0, 2);
  const x = BigInt('0x' + compressed.slice(2));
  
  // Calculate y² = x³ + ax + b
  const ySquared = mod(x * x * x + CURVE.a * x + CURVE.b, CURVE.p);
  
  // Calculate square root using Tonelli-Shanks (simplified for p ≡ 3 mod 4)
  // y = ySquared^((p+1)/4) mod p
  let y = modPow(ySquared, (CURVE.p + 1n) / 4n, CURVE.p);
  
  // Choose correct y based on prefix (parity)
  const isEven = y % 2n === 0n;
  if ((prefix === '02' && !isEven) || (prefix === '03' && isEven)) {
    y = mod(-y, CURVE.p);
  }
  
  return new Point(x, y);
}

/**
 * Verify that a point is valid (on the curve and in the correct subgroup)
 */
function isValidPublicKey(publicKey) {
  if (publicKey.isInfinity()) return false;
  if (!publicKey.isOnCurve()) return false;
  
  // Check that n*P = infinity (point is in correct subgroup)
  const check = scalarMultiply(CURVE.n, publicKey);
  return check.isInfinity();
}

/**
 * Simple hash function for creating deterministic values
 */
function simpleHash(data) {
  let hash = 0n;
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  for (let i = 0; i < str.length; i++) {
    hash = mod((hash * 31n + BigInt(str.charCodeAt(i))), CURVE.n);
  }
  return hash || 1n;
}

export {
  CURVE,
  Point,
  mod,
  modInverse,
  modPow,
  pointAdd,
  pointDouble,
  scalarMultiply,
  getGenerator,
  generatePrivateKey,
  generatePrivateKeySync,
  generatePublicKey,
  generateKeyPair,
  privateKeyToHex,
  hexToPrivateKey,
  compressPublicKey,
  decompressPublicKey,
  isValidPublicKey,
  simpleHash
};
