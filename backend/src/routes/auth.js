/**
 * Authentication routes
 * Handles voter registration and ZKP-based login
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ECDHSession } from '../crypto/ecdh.js';
import { SimpleZKPVerifier, generateSecretGraph } from '../zkp/graphIsomorphism.js';
import { sha256 } from '../crypto/encryption.js';

const router = express.Router();

// Store active sessions and ZKP verifiers
const activeSessions = new Map();
const zkpVerifiers = new Map();

export function createAuthRouter(db, centerId) {
  
  /**
   * Register a new voter
   * POST /api/auth/register
   */
  router.post('/register', (req, res) => {
    try {
      const { name, age, publicKey, graphCommitment } = req.body;
      
      // Validate age (must be 18+)
      if (!age || age < 18) {
        return res.status(400).json({ 
          error: 'Voter must be at least 18 years old',
          code: 'AGE_REQUIREMENT'
        });
      }
      
      // Validate required fields
      if (!name || !publicKey || !graphCommitment) {
        return res.status(400).json({ 
          error: 'Missing required fields: name, publicKey, graphCommitment',
          code: 'MISSING_FIELDS'
        });
      }
      
      // Check if public key already registered
      const existing = db.getVoterByPublicKey(publicKey);
      if (existing) {
        return res.status(400).json({ 
          error: 'This public key is already registered',
          code: 'ALREADY_REGISTERED'
        });
      }
      
      // Create voter
      const voterId = uuidv4();
      db.addVoter({
        id: voterId,
        name,
        age,
        publicKey,
        graphCommitment,
        centerId
      });
      
      db.log('REGISTER', voterId, `New voter registered: ${name}`);
      
      res.json({
        success: true,
        voterId,
        centerId,
        message: 'Registration successful'
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed', details: error.message });
    }
  });

  /**
   * Start authentication session (ECDH key exchange)
   * POST /api/auth/start-session
   */
  router.post('/start-session', (req, res) => {
    try {
      const { publicKey, voterPublicKey } = req.body;
      
      if (!publicKey) {
        return res.status(400).json({ error: 'Voter public key required' });
      }
      
      // Find voter by public key
      const voter = db.getVoterByPublicKey(publicKey);
      if (!voter) {
        return res.status(404).json({ 
          error: 'Voter not found in this center',
          code: 'NOT_FOUND'
        });
      }
      
      // Check if voter belongs to this center
      if (voter.center_id !== centerId) {
        return res.status(403).json({ 
          error: 'Voter is registered at a different center',
          code: 'WRONG_CENTER',
          correctCenter: voter.center_id
        });
      }
      
      // Create ECDH session
      const sessionId = uuidv4();
      const ecdhSession = new ECDHSession();
      
      // Store session
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
      
      activeSessions.set(sessionId, {
        ecdhSession,
        voterId: voter.id,
        voterPublicKey: publicKey,
        graphCommitment: voter.graph_commitment,
        zkpVerified: false,
        createdAt: new Date().toISOString()
      });
      
      db.createSession({
        id: sessionId,
        voterId: voter.id,
        ecdhPublicKey: ecdhSession.getPublicKey(),
        expiresAt
      });
      
      db.log('SESSION_START', voter.id, 'Authentication session started');
      
      res.json({
        sessionId,
        centerPublicKey: ecdhSession.getPublicKey(),
        voterId: voter.id,
        voterName: voter.name,
        hasVoted: voter.has_voted === 1
      });
      
    } catch (error) {
      console.error('Session start error:', error);
      res.status(500).json({ error: 'Failed to start session', details: error.message });
    }
  });

  /**
   * Complete ECDH key exchange
   * POST /api/auth/complete-ecdh
   */
  router.post('/complete-ecdh', (req, res) => {
    try {
      const { sessionId, voterEphemeralPublicKey } = req.body;
      
      const session = activeSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Complete ECDH
      session.ecdhSession.setRemotePublicKey(voterEphemeralPublicKey);
      session.ecdhComplete = true;
      
      db.log('ECDH_COMPLETE', session.voterId, 'ECDH key exchange completed');
      
      res.json({
        success: true,
        message: 'ECDH key exchange complete. Ready for ZKP authentication.'
      });
      
    } catch (error) {
      console.error('ECDH completion error:', error);
      res.status(500).json({ error: 'ECDH completion failed', details: error.message });
    }
  });

  /**
   * Start ZKP authentication
   * POST /api/auth/zkp/start
   */
  router.post('/zkp/start', (req, res) => {
    try {
      const { sessionId } = req.body;
      
      const session = activeSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Create ZKP verifier
      const verifier = new SimpleZKPVerifier();
      const zkpSession = verifier.startSession(sessionId, session.graphCommitment);
      
      zkpVerifiers.set(sessionId, verifier);
      
      db.log('ZKP_START', session.voterId, 'ZKP authentication started');
      
      res.json({
        success: true,
        zkpSessionId: sessionId,
        maxRounds: zkpSession.maxRounds,
        message: 'ZKP session started. Send commitment for round 0.'
      });
      
    } catch (error) {
      console.error('ZKP start error:', error);
      res.status(500).json({ error: 'ZKP start failed', details: error.message });
    }
  });

  /**
   * ZKP round - send commitment, receive challenge
   * POST /api/auth/zkp/commitment
   */
  router.post('/zkp/commitment', (req, res) => {
    try {
      const { sessionId, permutedGraph } = req.body;
      
      const verifier = zkpVerifiers.get(sessionId);
      if (!verifier) {
        return res.status(404).json({ error: 'ZKP session not found' });
      }
      
      // Generate challenge
      const challenge = verifier.generateChallenge(sessionId, permutedGraph);
      
      res.json({
        success: true,
        challengeNode: challenge.challengeNode,
        round: challenge.round
      });
      
    } catch (error) {
      console.error('ZKP commitment error:', error);
      res.status(500).json({ error: 'ZKP commitment failed', details: error.message });
    }
  });

  /**
   * ZKP round - verify response
   * POST /api/auth/zkp/response
   */
  router.post('/zkp/response', (req, res) => {
    try {
      const { sessionId, originalGraph, permutation, challengeNode } = req.body;
      
      const verifier = zkpVerifiers.get(sessionId);
      if (!verifier) {
        return res.status(404).json({ error: 'ZKP session not found' });
      }
      
      const session = activeSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Verify response
      const result = verifier.verifyResponse(sessionId, originalGraph, permutation, challengeNode);
      
      // Check if ZKP is complete
      const status = verifier.isComplete(sessionId);
      
      if (status.complete) {
        if (status.success) {
          session.zkpVerified = true;
          db.verifySessionZKP(sessionId);
          db.log('ZKP_SUCCESS', session.voterId, 'ZKP authentication successful');
        } else {
          db.log('ZKP_FAILED', session.voterId, 'ZKP authentication failed');
        }
        
        // Clean up verifier
        zkpVerifiers.delete(sessionId);
      }
      
      res.json({
        success: true,
        roundValid: result.valid,
        roundsRemaining: result.remaining,
        complete: status.complete,
        authenticated: status.success
      });
      
    } catch (error) {
      console.error('ZKP response error:', error);
      res.status(500).json({ error: 'ZKP verification failed', details: error.message });
    }
  });

  /**
   * Get session status
   * GET /api/auth/session/:sessionId
   */
  router.get('/session/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = activeSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const voter = db.getVoter(session.voterId);
      
      res.json({
        sessionId,
        voterId: session.voterId,
        voterName: voter?.name,
        zkpVerified: session.zkpVerified,
        hasVoted: voter?.has_voted === 1,
        createdAt: session.createdAt
      });
      
    } catch (error) {
      console.error('Session status error:', error);
      res.status(500).json({ error: 'Failed to get session status' });
    }
  });

  /**
   * Logout / end session
   * POST /api/auth/logout
   */
  router.post('/logout', (req, res) => {
    try {
      const { sessionId } = req.body;
      
      const session = activeSessions.get(sessionId);
      if (session) {
        db.log('LOGOUT', session.voterId, 'Session ended');
        activeSessions.delete(sessionId);
        zkpVerifiers.delete(sessionId);
        db.deleteSession(sessionId);
      }
      
      res.json({ success: true, message: 'Logged out successfully' });
      
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  /**
   * Get all voters (for admin panel)
   * GET /api/auth/voters
   */
  router.get('/voters', (req, res) => {
    try {
      const voters = db.getAllVoters();
      res.json({ voters, centerId });
    } catch (error) {
      console.error('Get voters error:', error);
      res.status(500).json({ error: 'Failed to get voters' });
    }
  });

  // Export session getter for other routes
  router.getSession = (sessionId) => activeSessions.get(sessionId);
  
  return router;
}

export { activeSessions };
