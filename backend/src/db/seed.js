/**
 * Seed database with initial voters (10 per center)
 * These voters have pre-generated votes
 */

import { VotingDatabase } from './database.js';
import { generateKeyPair, compressPublicKey, privateKeyToHex } from '../crypto/ecc.js';
import { generateSecretGraph } from '../zkp/graphIsomorphism.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Voter names for seeding
const voterNames = [
  // Center 1 voters
  ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Emma Davis',
   'Frank Miller', 'Grace Wilson', 'Henry Moore', 'Ivy Taylor', 'Jack Anderson'],
  // Center 2 voters
  ['Karen Thomas', 'Leo Jackson', 'Maria White', 'Nathan Harris', 'Olivia Martin',
   'Paul Garcia', 'Quinn Martinez', 'Rachel Robinson', 'Sam Clark', 'Tina Rodriguez'],
  // Center 3 voters
  ['Uma Lewis', 'Victor Lee', 'Wendy Walker', 'Xavier Hall', 'Yolanda Allen',
   'Zach Young', 'Amy King', 'Brian Wright', 'Cindy Scott', 'Derek Green']
];

// Pre-determined votes (Democrat or Republican)
const preVotes = [
  // Center 1 votes
  ['Democrat', 'Republican', 'Democrat', 'Democrat', 'Republican',
   'Democrat', 'Republican', 'Democrat', 'Republican', 'Democrat'],
  // Center 2 votes
  ['Republican', 'Democrat', 'Republican', 'Democrat', 'Democrat',
   'Republican', 'Democrat', 'Republican', 'Democrat', 'Republican'],
  // Center 3 votes
  ['Democrat', 'Democrat', 'Republican', 'Democrat', 'Republican',
   'Democrat', 'Republican', 'Democrat', 'Democrat', 'Republican']
];

/**
 * Generate voter credentials file (for demo purposes)
 */
function generateCredentials(centerId) {
  const credentials = [];
  const names = voterNames[centerId - 1];
  
  for (let i = 0; i < names.length; i++) {
    const voterId = uuidv4();
    const { privateKey, publicKey } = generateKeyPair();
    const secretSeed = `${voterId}-${names[i]}-secret`;
    const graph = generateSecretGraph(secretSeed);
    
    credentials.push({
      id: voterId,
      name: names[i],
      age: 25 + Math.floor(Math.random() * 40), // Ages 25-64
      centerId: centerId,
      privateKey: privateKeyToHex(privateKey),
      publicKey: compressPublicKey(publicKey),
      secretSeed: secretSeed,
      graphCommitment: graph.getHash(),
      preVote: preVotes[centerId - 1][i]
    });
  }
  
  return credentials;
}

/**
 * Seed a single center's database
 */
async function seedCenter(centerId) {
  const dbPath = path.resolve(__dirname, `../../data/center${centerId}.db`);
  const db = new VotingDatabase(centerId, dbPath);
  
  console.log(`\nSeeding Center ${centerId}...`);
  
  // Generate and store voter credentials
  const credentials = generateCredentials(centerId);
  const credentialsPath = path.resolve(__dirname, `../../data/center${centerId}_credentials.json`);
  
  // Store credentials for demo (in real system, voters would generate their own)
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  console.log(`  Credentials saved to: ${credentialsPath}`);
  
  // Add voters to database
  for (const cred of credentials) {
    try {
      db.addVoter({
        id: cred.id,
        name: cred.name,
        age: cred.age,
        publicKey: cred.publicKey,
        graphCommitment: cred.graphCommitment,
        centerId: cred.centerId
      });
      console.log(`  Added voter: ${cred.name} (age: ${cred.age})`);
    } catch (error) {
      console.error(`  Error adding ${cred.name}:`, error.message);
    }
  }
  
  // Add pre-existing votes for the first 10 voters
  for (let i = 0; i < credentials.length; i++) {
    const cred = credentials[i];
    const voteId = uuidv4();
    const voteData = JSON.stringify({ candidate: cred.preVote, timestamp: new Date().toISOString() });
    const voteHash = crypto.createHash('sha256').update(voteData + cred.id).digest('hex');
    
    try {
      db.addVote({
        id: voteId,
        voteHash: voteHash,
        encryptedVote: Buffer.from(voteData).toString('base64'),
        candidate: cred.preVote
      });
      db.markAsVoted(cred.id);
      console.log(`  Recorded vote for: ${cred.name} -> ${cred.preVote}`);
    } catch (error) {
      console.error(`  Error recording vote for ${cred.name}:`, error.message);
    }
  }
  
  // Log vote counts
  const counts = db.countVotes();
  console.log(`  Vote counts:`, counts);
  
  // Set center info
  const { privateKey, publicKey } = generateKeyPair();
  db.setCenterInfo(centerId, `Voting Center ${centerId}`, compressPublicKey(publicKey));
  
  // Save center private key (for ECDH)
  const centerKeyPath = path.resolve(__dirname, `../../data/center${centerId}_key.json`);
  fs.writeFileSync(centerKeyPath, JSON.stringify({
    centerId,
    privateKey: privateKeyToHex(privateKey),
    publicKey: compressPublicKey(publicKey)
  }, null, 2));
  
  db.log('SEED', null, `Database seeded with ${credentials.length} voters`);
  db.close();
  
  console.log(`  Center ${centerId} seeded successfully!`);
}

/**
 * Seed all centers
 */
async function seedAllCenters() {
  console.log('='.repeat(50));
  console.log('Seeding E-Voting System Database');
  console.log('='.repeat(50));
  
  // Ensure data directory exists
  const dataDir = path.resolve(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Clear existing databases
  for (let i = 1; i <= 3; i++) {
    const dbPath = path.resolve(dataDir, `center${i}.db`);
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log(`Removed existing database: center${i}.db`);
    }
  }
  
  // Seed each center
  for (let i = 1; i <= 3; i++) {
    await seedCenter(i);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Seeding complete!');
  console.log('='.repeat(50));
  
  // Print summary
  console.log('\nSummary:');
  console.log('- 3 voting centers initialized');
  console.log('- 10 voters per center (30 total)');
  console.log('- All voters have already cast their votes');
  console.log('- 5 additional voters can be added during defense');
  console.log('\nCredentials files created in backend/data/ directory');
}

// Run if executed directly
seedAllCenters().catch(console.error);
