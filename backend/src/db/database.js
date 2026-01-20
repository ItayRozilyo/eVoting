/**
 * Database setup and management using better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize database with schema
 */
function initDatabase(dbPath) {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    -- Voters table
    CREATE TABLE IF NOT EXISTS voters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      public_key TEXT NOT NULL,
      graph_commitment TEXT NOT NULL,
      center_id INTEGER NOT NULL,
      has_voted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(public_key)
    );

    -- Votes table (anonymized - no link to voter)
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      vote_hash TEXT NOT NULL UNIQUE,
      encrypted_vote TEXT NOT NULL,
      candidate TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Sessions table for ZKP and ECDH
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      voter_id TEXT,
      ecdh_public_key TEXT,
      session_key_hash TEXT,
      zkp_verified INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (voter_id) REFERENCES voters(id)
    );

    -- Audit log for verification
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      voter_id TEXT,
      details TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Center info
    CREATE TABLE IF NOT EXISTS center_info (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      public_key TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

/**
 * Database wrapper class
 */
class VotingDatabase {
  constructor(centerId, dbPath) {
    this.centerId = centerId;
    this.db = initDatabase(dbPath);
    this.prepareStatements();
  }

  prepareStatements() {
    // Voter statements
    this.stmts = {
      insertVoter: this.db.prepare(`
        INSERT INTO voters (id, name, age, public_key, graph_commitment, center_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      
      getVoterById: this.db.prepare(`
        SELECT * FROM voters WHERE id = ?
      `),
      
      getVoterByPublicKey: this.db.prepare(`
        SELECT * FROM voters WHERE public_key = ?
      `),
      
      getAllVoters: this.db.prepare(`
        SELECT id, name, age, center_id, has_voted, created_at FROM voters
      `),
      
      markVoted: this.db.prepare(`
        UPDATE voters SET has_voted = 1 WHERE id = ?
      `),
      
      hasVoted: this.db.prepare(`
        SELECT has_voted FROM voters WHERE id = ?
      `),

      // Vote statements
      insertVote: this.db.prepare(`
        INSERT INTO votes (id, vote_hash, encrypted_vote, candidate)
        VALUES (?, ?, ?, ?)
      `),
      
      getVoteByHash: this.db.prepare(`
        SELECT * FROM votes WHERE vote_hash = ?
      `),
      
      countVotes: this.db.prepare(`
        SELECT candidate, COUNT(*) as count FROM votes GROUP BY candidate
      `),
      
      getAllVotes: this.db.prepare(`
        SELECT id, vote_hash, candidate, timestamp FROM votes
      `),

      // Session statements
      insertSession: this.db.prepare(`
        INSERT INTO sessions (id, voter_id, ecdh_public_key, expires_at)
        VALUES (?, ?, ?, ?)
      `),
      
      getSession: this.db.prepare(`
        SELECT * FROM sessions WHERE id = ?
      `),
      
      updateSessionZKP: this.db.prepare(`
        UPDATE sessions SET zkp_verified = 1 WHERE id = ?
      `),
      
      deleteSession: this.db.prepare(`
        DELETE FROM sessions WHERE id = ?
      `),

      // Audit statements
      insertAuditLog: this.db.prepare(`
        INSERT INTO audit_log (action, voter_id, details)
        VALUES (?, ?, ?)
      `),
      
      getAuditLog: this.db.prepare(`
        SELECT * FROM audit_log ORDER BY timestamp DESC
      `),

      // Center info
      insertCenterInfo: this.db.prepare(`
        INSERT OR REPLACE INTO center_info (id, name, public_key)
        VALUES (?, ?, ?)
      `),
      
      getCenterInfo: this.db.prepare(`
        SELECT * FROM center_info WHERE id = ?
      `)
    };
  }

  // Voter methods
  addVoter(voter) {
    return this.stmts.insertVoter.run(
      voter.id,
      voter.name,
      voter.age,
      voter.publicKey,
      voter.graphCommitment,
      voter.centerId
    );
  }

  getVoter(id) {
    return this.stmts.getVoterById.get(id);
  }

  getVoterByPublicKey(publicKey) {
    return this.stmts.getVoterByPublicKey.get(publicKey);
  }

  getAllVoters() {
    return this.stmts.getAllVoters.all();
  }

  markAsVoted(voterId) {
    this.stmts.markVoted.run(voterId);
    this.log('VOTE_CAST', voterId, 'Voter marked as voted');
  }

  hasVoted(voterId) {
    const result = this.stmts.hasVoted.get(voterId);
    return result ? result.has_voted === 1 : false;
  }

  // Vote methods
  addVote(vote) {
    return this.stmts.insertVote.run(
      vote.id,
      vote.voteHash,
      vote.encryptedVote,
      vote.candidate
    );
  }

  getVoteByHash(hash) {
    return this.stmts.getVoteByHash.get(hash);
  }

  countVotes() {
    return this.stmts.countVotes.all();
  }

  getAllVotes() {
    return this.stmts.getAllVotes.all();
  }

  // Session methods
  createSession(session) {
    return this.stmts.insertSession.run(
      session.id,
      session.voterId,
      session.ecdhPublicKey,
      session.expiresAt
    );
  }

  getSession(id) {
    return this.stmts.getSession.get(id);
  }

  verifySessionZKP(id) {
    return this.stmts.updateSessionZKP.run(id);
  }

  deleteSession(id) {
    return this.stmts.deleteSession.run(id);
  }

  // Audit methods
  log(action, voterId, details) {
    this.stmts.insertAuditLog.run(action, voterId, details);
  }

  getAuditLog() {
    return this.stmts.getAuditLog.all();
  }

  // Center methods
  setCenterInfo(id, name, publicKey) {
    return this.stmts.insertCenterInfo.run(id, name, publicKey);
  }

  getCenterInfo(id) {
    return this.stmts.getCenterInfo.get(id);
  }

  // Close database
  close() {
    this.db.close();
  }
}

export { initDatabase, VotingDatabase };
