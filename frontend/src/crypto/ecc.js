/**
 * Elliptic Curve Cryptography Implementation for Browser
 * Using secp256k1 curve parameters
 * 
 * Based on Understanding Cryptography by Christof Paar and Jan Pelzl
 * Chapter 9 - Elliptic Curve Cryptography
 */

// secp256k1 curve parameters
const CURVE = {
  p: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'),
  a: BigInt(0),
  b: BigInt(7),
  Gx: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
  Gy: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8'),
  n: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'),
  h: BigInt(1)
};

function mod(a, m) {
  const result = a % m;
  return result >= 0n ? result : result + m;
}

function extendedGcd(a, b) {
  if (a === 0n) return { gcd: b, x: 0n, y: 1n };
  const { gcd, x, y } = extendedGcd(mod(b, a), a);
  return { gcd, x: y - (b / a) * x, y: x };
}

function modInverse(a, m) {
  a = mod(a, m);
  const { gcd, x } = extendedGcd(a, m);
  if (gcd !== 1n) throw new Error('Modular inverse does not exist');
  return mod(x, m);
}

function modPow(base, exp, m) {
  base = mod(base, m);
  let result = 1n;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = mod(result * base, m);
    exp = exp / 2n;
    base = mod(base * base, m);
  }
  return result;
}

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  isInfinity() {
    return this.x === null && this.y === null;
  }

  static infinity() {
    return new Point(null, null);
  }

  isOnCurve() {
    if (this.isInfinity()) return true;
    const left = mod(this.y * this.y, CURVE.p);
    const right = mod(this.x * this.x * this.x + CURVE.a * this.x + CURVE.b, CURVE.p);
    return left === right;
  }

  equals(other) {
    if (this.isInfinity() && other.isInfinity()) return true;
    if (this.isInfinity() || other.isInfinity()) return false;
    return this.x === other.x && this.y === other.y;
  }

  negate() {
    if (this.isInfinity()) return Point.infinity();
    return new Point(this.x, mod(-this.y, CURVE.p));
  }

  toJSON() {
    if (this.isInfinity()) return { x: null, y: null };
    return { x: this.x.toString(16), y: this.y.toString(16) };
  }

  static fromJSON(json) {
    if (json.x === null && json.y === null) return Point.infinity();
    return new Point(BigInt('0x' + json.x), BigInt('0x' + json.y));
  }
}

function pointAdd(P, Q) {
  if (P.isInfinity()) return Q;
  if (Q.isInfinity()) return P;
  if (P.x === Q.x && mod(P.y + Q.y, CURVE.p) === 0n) return Point.infinity();

  let s;
  if (P.x === Q.x && P.y === Q.y) {
    if (P.y === 0n) return Point.infinity();
    const numerator = mod(3n * P.x * P.x + CURVE.a, CURVE.p);
    const denominator = mod(2n * P.y, CURVE.p);
    s = mod(numerator * modInverse(denominator, CURVE.p), CURVE.p);
  } else {
    const numerator = mod(Q.y - P.y, CURVE.p);
    const denominator = mod(Q.x - P.x, CURVE.p);
    s = mod(numerator * modInverse(denominator, CURVE.p), CURVE.p);
  }

  const x3 = mod(s * s - P.x - Q.x, CURVE.p);
  const y3 = mod(s * (P.x - x3) - P.y, CURVE.p);
  return new Point(x3, y3);
}

function pointDouble(P) {
  return pointAdd(P, P);
}

function scalarMultiply(k, P) {
  if (k === 0n) return Point.infinity();
  if (k < 0n) {
    k = -k;
    P = P.negate();
  }

  let result = Point.infinity();
  let addend = P;

  while (k > 0n) {
    if (k & 1n) result = pointAdd(result, addend);
    addend = pointDouble(addend);
    k = k >> 1n;
  }
  return result;
}

function getGenerator() {
  return new Point(CURVE.Gx, CURVE.Gy);
}

function generatePrivateKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let privateKey = 0n;
  for (const byte of bytes) {
    privateKey = (privateKey << 8n) + BigInt(byte);
  }
  return mod(privateKey, CURVE.n - 1n) + 1n;
}

function generatePublicKey(privateKey) {
  return scalarMultiply(privateKey, getGenerator());
}

function generateKeyPair() {
  const privateKey = generatePrivateKey();
  const publicKey = generatePublicKey(privateKey);
  return { privateKey, publicKey };
}

function privateKeyToHex(privateKey) {
  return privateKey.toString(16).padStart(64, '0');
}

function hexToPrivateKey(hex) {
  return BigInt('0x' + hex);
}

function compressPublicKey(publicKey) {
  if (publicKey.isInfinity()) return '00';
  const prefix = publicKey.y % 2n === 0n ? '02' : '03';
  return prefix + publicKey.x.toString(16).padStart(64, '0');
}

function decompressPublicKey(compressed) {
  if (compressed === '00') return Point.infinity();
  const prefix = compressed.slice(0, 2);
  const x = BigInt('0x' + compressed.slice(2));
  const ySquared = mod(x * x * x + CURVE.a * x + CURVE.b, CURVE.p);
  let y = modPow(ySquared, (CURVE.p + 1n) / 4n, CURVE.p);
  const isEven = y % 2n === 0n;
  if ((prefix === '02' && !isEven) || (prefix === '03' && isEven)) {
    y = mod(-y, CURVE.p);
  }
  return new Point(x, y);
}

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
  generatePublicKey,
  generateKeyPair,
  privateKeyToHex,
  hexToPrivateKey,
  compressPublicKey,
  decompressPublicKey,
  simpleHash
};
