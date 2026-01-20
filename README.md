# E-Voting System with ECC, ECDH, and ZKP

A secure electronic voting system implementation using cryptographic primitives.

## Features

### Security Properties
1. **Only authorized voters can vote** - Age verification (18+) and ZKP authentication
2. **No double voting** - Database tracks who has voted
3. **No multi-center voting** - Cross-center verification prevents voting at multiple centers
4. **Vote privacy** - Votes encrypted with ECDH-derived session keys
5. **No vote duplication** - Cryptographic signatures prevent replay
6. **Correct computation** - All votes are tallied correctly
7. **Verifiable results** - Hash chains and audit logs for verification
8. **Resilient to attacks** - Multiple centers prevent single point of failure

### Cryptographic Implementations

#### Elliptic Curve Cryptography (ECC)
- **Curve**: secp256k1
- **Operations**: Point addition, point doubling, scalar multiplication
- **Key Generation**: Random 256-bit private key, public key = privateKey × G
- **Implemented from scratch** following the textbook formulas

#### ECDH Key Exchange
- Ephemeral key pairs for each session
- Shared secret = voterPrivateKey × centerPublicKey
- Session key derived using SHA-256

#### Zero-Knowledge Proof (Graph Isomorphism)
- **Prover** (Client): Has secret graph G and permutation π
- **Verifier** (Server): Challenges prover to prove knowledge without revealing secret
- **Protocol**: 5 rounds of commitment-challenge-response
- **Security**: Probability of cheating = 1/2^5 = 3.125%

## Setup Instructions

### Prerequisites
- Node.js v18 or higher
- npm or yarn

### Installation

1. **Install Backend Dependencies**
```bash
cd backend
npm install
```

2. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

3. **Seed the Database** (Creates 10 voters per center with pre-cast votes)
```bash
cd backend
npm run seed
```

### Running the System

1. **Start All Voting Centers** (in separate terminals or use concurrently)
```bash
# Terminal 1 - Center 1
cd backend
set CENTER_ID=1 && set PORT=3001 && npm start

# Terminal 2 - Center 2
cd backend
set CENTER_ID=2 && set PORT=3002 && npm start

# Terminal 3 - Center 3
cd backend
set CENTER_ID=3 && set PORT=3003 && npm start
```

Or use the combined command:
```bash
cd backend
npm run start:all
```

2. **Start the Frontend**
```bash
cd frontend
npm run dev
```

3. **Access the Application**
- Frontend: http://localhost:3000
- Center 1 API: http://localhost:3001
- Center 2 API: http://localhost:3002
- Center 3 API: http://localhost:3003

## License

Educational project for Cryptography course assignment.
