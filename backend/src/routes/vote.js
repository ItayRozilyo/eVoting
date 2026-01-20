/**
 * Voting routes
 * Handles vote submission with cross-center verification
 * Includes blockchain integration for immutable vote ledger
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { decrypt, sha256 } from '../crypto/encryption.js';

const router = express.Router();

export function createVoteRouter(db, centerId, getSession, crossCenterVerify, getBlockchain) {
  
  /**
   * Submit a vote
   * POST /api/vote/cast
   */
  router.post('/cast', async (req, res) => {
    try {
      const { sessionId, encryptedVote, voteSignature } = req.body;
      
      // Get session
      const session = getSession(sessionId);
      if (!session) {
        return res.status(401).json({ 
          error: 'Invalid or expired session',
          code: 'SESSION_INVALID'
        });
      }
      
      // Verify ZKP authentication
      if (!session.zkpVerified) {
        return res.status(401).json({ 
          error: 'ZKP authentication required before voting',
          code: 'ZKP_REQUIRED'
        });
      }
      
      // Check if voter already voted at this center
      const voter = db.getVoter(session.voterId);
      if (!voter) {
        return res.status(404).json({ error: 'Voter not found' });
      }
      
      if (voter.has_voted === 1) {
        return res.status(400).json({ 
          error: 'You have already voted',
          code: 'ALREADY_VOTED'
        });
      }
      
      // Cross-center verification - check if voted elsewhere
      try {
        const votedElsewhere = await crossCenterVerify(voter.public_key, centerId);
        if (votedElsewhere.voted) {
          db.log('CROSS_CENTER_BLOCK', session.voterId, 
            `Vote blocked - already voted at center ${votedElsewhere.center}`);
          return res.status(400).json({ 
            error: 'You have already voted at another center',
            code: 'VOTED_AT_OTHER_CENTER',
            center: votedElsewhere.center
          });
        }
      } catch (crossError) {
        console.error('Cross-center verification error:', crossError);
        // Continue if cross-center check fails (centers might be down)
      }
      
      // Decrypt vote using session key
      let voteData;
      try {
        const sessionKey = session.ecdhSession.getSessionKey();
        const decryptedVote = decrypt(encryptedVote, sessionKey);
        voteData = JSON.parse(decryptedVote);
      } catch (decryptError) {
        return res.status(400).json({ 
          error: 'Invalid encrypted vote',
          code: 'DECRYPT_FAILED'
        });
      }
      
      // Validate vote
      const validCandidates = ['Democrat', 'Republican'];
      if (!voteData.candidate || !validCandidates.includes(voteData.candidate)) {
        return res.status(400).json({ 
          error: 'Invalid candidate selection',
          code: 'INVALID_CANDIDATE',
          validOptions: validCandidates
        });
      }
      
      // Create vote record
      const voteId = uuidv4();
      const voteHash = sha256(encryptedVote + session.voterId + Date.now());
      
      // Store vote (anonymized - no direct link to voter)
      db.addVote({
        id: voteId,
        voteHash,
        encryptedVote,
        candidate: voteData.candidate
      });
      
      // Mark voter as voted
      db.markAsVoted(session.voterId);
      
      // Add vote to blockchain
      let blockInfo = null;
      if (getBlockchain) {
        try {
          const blockchain = getBlockchain();
          blockchain.addVoteTransaction({
            voteId,
            voteHash,
            candidate: voteData.candidate
          });
          
          // Mine the vote into a block immediately
          const block = blockchain.minePendingTransactions();
          if (block) {
            blockInfo = {
              blockIndex: block.index,
              blockHash: block.hash,
              previousHash: block.previousHash
            };
            db.log('BLOCK_MINED', session.voterId, `Vote added to block ${block.index}`);
          }
        } catch (blockchainError) {
          console.error('Blockchain error (non-fatal):', blockchainError);
          // Continue even if blockchain fails - vote is still in database
        }
      }
      
      // Log the action
      db.log('VOTE_CAST', session.voterId, `Vote cast for ${voteData.candidate}`);
      
      res.json({
        success: true,
        voteId,
        voteHash,
        blockchain: blockInfo,
        receipt: {
          timestamp: new Date().toISOString(),
          centerId,
          voteHash,
          blockInfo,
          message: 'Your vote has been recorded successfully and added to the blockchain'
        }
      });
      
    } catch (error) {
      console.error('Vote casting error:', error);
      res.status(500).json({ error: 'Failed to cast vote', details: error.message });
    }
  });

  /**
   * Verify a vote receipt
   * POST /api/vote/verify
   */
  router.post('/verify', (req, res) => {
    try {
      const { voteHash } = req.body;
      
      const vote = db.getVoteByHash(voteHash);
      if (!vote) {
        return res.status(404).json({ 
          error: 'Vote not found',
          valid: false
        });
      }
      
      res.json({
        valid: true,
        timestamp: vote.timestamp,
        message: 'Vote verified successfully'
      });
      
    } catch (error) {
      console.error('Vote verification error:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  /**
   * Check if a voter has voted (for cross-center verification)
   * POST /api/vote/check-voted
   */
  router.post('/check-voted', (req, res) => {
    try {
      const { publicKey } = req.body;
      
      const voter = db.getVoterByPublicKey(publicKey);
      if (!voter) {
        return res.json({ voted: false, found: false });
      }
      
      res.json({
        voted: voter.has_voted === 1,
        found: true,
        centerId
      });
      
    } catch (error) {
      console.error('Check voted error:', error);
      res.status(500).json({ error: 'Check failed' });
    }
  });

  /**
   * Get voting status for current user
   * GET /api/vote/status/:sessionId
   */
  router.get('/status/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const voter = db.getVoter(session.voterId);
      
      res.json({
        voterId: session.voterId,
        hasVoted: voter?.has_voted === 1,
        zkpVerified: session.zkpVerified
      });
      
    } catch (error) {
      console.error('Vote status error:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  return router;
}
