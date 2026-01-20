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

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Port 3000)                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │ Register│  │  Login  │  │  Vote   │  │     Results     │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘ │
└───────┼────────────┼────────────┼────────────────┼──────────┘
        │            │            │                │
   ┌────▼────────────▼────────────▼────────────────▼────┐
   │              API Layer (ECDH + ZKP)                │
   └────────────────────────────────────────────────────┘
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │Center 1 │◄────────►│Center 2 │◄────────►│Center 3 │
   │Port 3001│          │Port 3002│          │Port 3003│
   └────┬────┘          └────┬────┘          └────┬────┘
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │SQLite DB│          │SQLite DB│          │SQLite DB│
   └─────────┘          └─────────┘          └─────────┘
```

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

## Usage Guide

### Registering a New Voter
1. Go to "Register" page
2. Enter name and age (must be 18+)
3. System generates ECC key pair and ZKP secret graph
4. **Download and save your credentials file** - you'll need this to vote
5. Complete registration

### Voting
1. Go to "Login" page
2. Load your credentials file or enter manually
3. System performs:
   - ECDH key exchange with the center
   - ZKP authentication (5 rounds of graph isomorphism proof)
4. Select your candidate (Democrat or Republican)
5. Confirm and submit your encrypted vote
6. Receive vote receipt with verification hash

### Viewing Results
- Go to "Results" page to see aggregate results from all centers
- Each center's individual results are shown
- Verification hash provided for audit

### Admin Panel
- View registered voters and their status
- Monitor voting statistics
- Check audit logs
- Verify system integrity

## Project Structure

```
CryptoV1/
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── server.js           # Express server
│   │   ├── crypto/
│   │   │   ├── ecc.js          # ECC implementation
│   │   │   ├── ecdh.js         # ECDH key exchange
│   │   │   └── encryption.js   # AES-256-GCM encryption
│   │   ├── zkp/
│   │   │   └── graphIsomorphism.js  # ZKP implementation
│   │   ├── routes/
│   │   │   ├── auth.js         # Registration & authentication
│   │   │   ├── vote.js         # Voting endpoints
│   │   │   └── tally.js        # Result tallying
│   │   ├── middleware/
│   │   │   └── crossCenterVerify.js  # Multi-center verification
│   │   └── db/
│   │       ├── database.js     # SQLite setup
│   │       └── seed.js         # Database seeding
│   ├── centers/                # Center configurations
│   └── data/                   # SQLite databases & credentials
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── VoterLogin.jsx
│   │   │   ├── VoterRegistration.jsx
│   │   │   ├── VotingBooth.jsx
│   │   │   ├── ResultsView.jsx
│   │   │   └── AdminPanel.jsx
│   │   ├── crypto/             # Client-side crypto
│   │   │   ├── ecc.js
│   │   │   ├── ecdh.js
│   │   │   └── zkpProver.js
│   │   └── styles/
│   │       └── theme.css
│   └── public/
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new voter
- `POST /api/auth/start-session` - Start authentication session
- `POST /api/auth/complete-ecdh` - Complete ECDH key exchange
- `POST /api/auth/zkp/start` - Start ZKP authentication
- `POST /api/auth/zkp/commitment` - Send ZKP commitment
- `POST /api/auth/zkp/response` - Send ZKP response
- `GET /api/auth/voters` - List all voters (admin)

### Voting
- `POST /api/vote/cast` - Cast encrypted vote
- `POST /api/vote/verify` - Verify vote receipt
- `POST /api/vote/check-voted` - Check if voter has voted (cross-center)
- `GET /api/vote/status/:sessionId` - Get voting status

### Tallying
- `GET /api/tally/counts` - Get vote counts
- `GET /api/tally/aggregate` - Get aggregated results from all centers
- `GET /api/tally/votes` - Get all vote hashes
- `GET /api/tally/audit` - Get audit log
- `GET /api/tally/verify-integrity` - Verify system integrity
- `GET /api/tally/stats` - Get voting statistics

## Security Considerations

### What This System Protects Against
- Unauthorized voting (ZKP authentication)
- Double voting at same center (database flag)
- Multi-center voting (cross-center verification)
- Vote interception (ECDH encryption)
- Vote tampering (hash verification)
- Result manipulation (audit log + integrity checks)

### Defense Demonstration
During the defense, you can:
1. Add 5 new voters through the registration interface
2. Attempt to vote twice (system will reject)
3. Attempt to vote at multiple centers (cross-center check)
4. Verify results match the audit log
5. Check integrity hashes

## Cryptography References

Based on "Understanding Cryptography" by Christof Paar and Jan Pelzl, Chapter 9:
- Elliptic Curve Cryptography over prime fields Zp
- Point addition and doubling formulas
- Double-and-Add algorithm for scalar multiplication
- secp256k1 curve parameters

## License

Educational project for Cryptography course assignment.
