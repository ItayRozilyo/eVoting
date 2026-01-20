/**
 * E-Voting System Server
 * Runs as one of 3 voting centers
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { VotingDatabase } from './db/database.js';
import { createAuthRouter, activeSessions } from './routes/auth.js';
import { createVoteRouter } from './routes/vote.js';
import { createTallyRouter } from './routes/tally.js';
import { createBlockchainRouter } from './routes/blockchain.js';
import { createCrossCenterMiddleware } from './middleware/crossCenterVerify.js';
import { generateKeyPair, compressPublicKey, privateKeyToHex } from './crypto/ecc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get center configuration from environment
const CENTER_ID = parseInt(process.env.CENTER_ID || '1', 10);
const PORT = parseInt(process.env.PORT || '3001', 10);

// Center names
const CENTER_NAMES = {
  1: 'Voting Center Alpha',
  2: 'Voting Center Beta',
  3: 'Voting Center Gamma'
};

// Initialize express app
const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Initialize database
const dbPath = path.resolve(__dirname, `../data/center${CENTER_ID}.db`);
const db = new VotingDatabase(CENTER_ID, dbPath);

// Initialize center key pair if not exists
const keyPath = path.resolve(__dirname, `../data/center${CENTER_ID}_key.json`);
let centerKeys;
if (fs.existsSync(keyPath)) {
  centerKeys = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
} else {
  const { privateKey, publicKey } = generateKeyPair();
  centerKeys = {
    centerId: CENTER_ID,
    privateKey: privateKeyToHex(privateKey),
    publicKey: compressPublicKey(publicKey)
  };
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, JSON.stringify(centerKeys, null, 2));
}

// Set center info in database
db.setCenterInfo(CENTER_ID, CENTER_NAMES[CENTER_ID], centerKeys.publicKey);

// Create cross-center middleware
const crossCenter = createCrossCenterMiddleware(CENTER_ID);

// Session getter function
const getSession = (sessionId) => activeSessions.get(sessionId);

// Create routers
const authRouter = createAuthRouter(db, CENTER_ID);
const blockchainRouter = createBlockchainRouter(db, CENTER_ID);
const voteRouter = createVoteRouter(db, CENTER_ID, getSession, crossCenter.checkVotedElsewhere, blockchainRouter.getBlockchain);
const tallyRouter = createTallyRouter(db, CENTER_ID, crossCenter.getCenterResults);

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/vote', voteRouter);
app.use('/api/tally', tallyRouter);
app.use('/api/blockchain', blockchainRouter);

// Center info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    centerId: CENTER_ID,
    name: CENTER_NAMES[CENTER_ID],
    publicKey: centerKeys.publicKey,
    port: PORT
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    centerId: CENTER_ID,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('═'.repeat(50));
  console.log(`  ${CENTER_NAMES[CENTER_ID]}`);
  console.log('═'.repeat(50));
  console.log(`  Center ID:    ${CENTER_ID}`);
  console.log(`  Port:         ${PORT}`);
  console.log(`  Database:     center${CENTER_ID}.db`);
  console.log(`  Public Key:   ${centerKeys.publicKey.substring(0, 20)}...`);
  console.log('═'.repeat(50));
  console.log(`  API Endpoints:`);
  console.log(`  - POST /api/auth/register`);
  console.log(`  - POST /api/auth/start-session`);
  console.log(`  - POST /api/auth/zkp/*`);
  console.log(`  - POST /api/vote/cast`);
  console.log(`  - GET  /api/tally/counts`);
  console.log(`  - GET  /api/tally/aggregate`);
  console.log(`  - GET  /api/blockchain/chain`);
  console.log(`  - GET  /api/blockchain/validate`);
  console.log('═'.repeat(50));
  
  // Log initial stats
  const voters = db.getAllVoters();
  const votes = db.countVotes();
  console.log(`  Registered Voters: ${voters.length}`);
  console.log(`  Votes Cast:        ${votes.reduce((s, v) => s + v.count, 0)}`);
  console.log('═'.repeat(50));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  db.close();
  process.exit(0);
});

export { app };
