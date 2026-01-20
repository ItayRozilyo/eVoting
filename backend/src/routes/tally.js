/**
 * Tallying routes
 * Handles vote counting and result verification
 */

import express from 'express';
import { sha256 } from '../crypto/encryption.js';

const router = express.Router();

export function createTallyRouter(db, centerId, getCenterResults) {
  
  /**
   * Get vote counts for this center
   * GET /api/tally/counts
   */
  router.get('/counts', (req, res) => {
    try {
      const counts = db.countVotes();
      const totalVotes = counts.reduce((sum, c) => sum + c.count, 0);
      
      // Format results
      const results = {
        Democrat: 0,
        Republican: 0
      };
      
      for (const count of counts) {
        results[count.candidate] = count.count;
      }
      
      res.json({
        centerId,
        results,
        totalVotes,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Tally error:', error);
      res.status(500).json({ error: 'Failed to get vote counts' });
    }
  });

  /**
   * Get aggregated results from all centers
   * GET /api/tally/aggregate
   */
  router.get('/aggregate', async (req, res) => {
    try {
      // Get this center's results
      const localCounts = db.countVotes();
      const localResults = {
        centerId,
        Democrat: 0,
        Republican: 0,
        total: 0
      };
      
      for (const count of localCounts) {
        localResults[count.candidate] = count.count;
        localResults.total += count.count;
      }
      
      // Get results from other centers
      const allCenterResults = [localResults];
      
      try {
        const otherResults = await getCenterResults(centerId);
        allCenterResults.push(...otherResults);
      } catch (error) {
        console.error('Failed to get other center results:', error);
      }
      
      // Aggregate
      const aggregate = {
        Democrat: 0,
        Republican: 0,
        total: 0,
        byCenter: allCenterResults
      };
      
      for (const result of allCenterResults) {
        aggregate.Democrat += result.Democrat || 0;
        aggregate.Republican += result.Republican || 0;
        aggregate.total += result.total || 0;
      }
      
      // Determine winner
      let winner = null;
      if (aggregate.Democrat > aggregate.Republican) {
        winner = 'Democrat';
      } else if (aggregate.Republican > aggregate.Democrat) {
        winner = 'Republican';
      } else {
        winner = 'Tie';
      }
      
      // Create verification hash
      const verificationData = JSON.stringify({
        results: aggregate,
        timestamp: new Date().toISOString()
      });
      const verificationHash = sha256(verificationData);
      
      res.json({
        results: aggregate,
        winner,
        verificationHash,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Aggregate tally error:', error);
      res.status(500).json({ error: 'Failed to aggregate results' });
    }
  });

  /**
   * Get all votes for verification (hashes only)
   * GET /api/tally/votes
   */
  router.get('/votes', (req, res) => {
    try {
      const votes = db.getAllVotes();
      
      // Return only hashes and timestamps (no candidate info for privacy)
      const voteRecords = votes.map(v => ({
        id: v.id,
        hash: v.vote_hash,
        timestamp: v.timestamp
      }));
      
      res.json({
        centerId,
        voteCount: voteRecords.length,
        votes: voteRecords
      });
      
    } catch (error) {
      console.error('Get votes error:', error);
      res.status(500).json({ error: 'Failed to get votes' });
    }
  });

  /**
   * Get audit log
   * GET /api/tally/audit
   */
  router.get('/audit', (req, res) => {
    try {
      const logs = db.getAuditLog();
      
      res.json({
        centerId,
        logs: logs.slice(0, 100) // Last 100 entries
      });
      
    } catch (error) {
      console.error('Audit log error:', error);
      res.status(500).json({ error: 'Failed to get audit log' });
    }
  });

  /**
   * Verify election integrity
   * GET /api/tally/verify-integrity
   */
  router.get('/verify-integrity', (req, res) => {
    try {
      const votes = db.getAllVotes();
      const voters = db.getAllVoters();
      
      // Count voters who voted
      const votersWhoVoted = voters.filter(v => v.has_voted === 1).length;
      
      // Check consistency
      const voteCount = votes.length;
      const consistent = voteCount === votersWhoVoted;
      
      // Calculate vote hash chain
      let chainHash = sha256('genesis');
      for (const vote of votes) {
        chainHash = sha256(chainHash + vote.vote_hash);
      }
      
      res.json({
        centerId,
        integrity: {
          consistent,
          voteCount,
          votersWhoVoted,
          chainHash,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Integrity check error:', error);
      res.status(500).json({ error: 'Failed to verify integrity' });
    }
  });

  /**
   * Get voter statistics
   * GET /api/tally/stats
   */
  router.get('/stats', (req, res) => {
    try {
      const voters = db.getAllVoters();
      const votes = db.countVotes();
      
      const stats = {
        centerId,
        totalRegistered: voters.length,
        totalVoted: voters.filter(v => v.has_voted === 1).length,
        turnout: voters.length > 0 
          ? ((voters.filter(v => v.has_voted === 1).length / voters.length) * 100).toFixed(1) + '%'
          : '0%',
        voteBreakdown: {}
      };
      
      for (const count of votes) {
        stats.voteBreakdown[count.candidate] = count.count;
      }
      
      res.json(stats);
      
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  return router;
}
