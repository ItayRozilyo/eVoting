/**
 * Blockchain Routes
 * API endpoints for blockchain operations
 */

import express from 'express';
import { Blockchain, blockchainManager } from '../blockchain/blockchain.js';

const router = express.Router();

// Store blockchain instance per center
const blockchains = new Map();

export function createBlockchainRouter(db, centerId) {
  
  // Initialize blockchain for this center
  if (!blockchains.has(centerId)) {
    blockchains.set(centerId, new Blockchain(centerId, 2)); // Difficulty 2 for demo
  }
  
  const blockchain = blockchains.get(centerId);

  /**
   * Get blockchain info and stats
   * GET /api/blockchain/info
   */
  router.get('/info', (req, res) => {
    try {
      const stats = blockchain.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Blockchain info error:', error);
      res.status(500).json({ error: 'Failed to get blockchain info' });
    }
  });

  /**
   * Get full blockchain
   * GET /api/blockchain/chain
   */
  router.get('/chain', (req, res) => {
    try {
      res.json({
        centerId,
        chain: blockchain.chain.map(block => block.toJSON()),
        length: blockchain.chain.length
      });
    } catch (error) {
      console.error('Get chain error:', error);
      res.status(500).json({ error: 'Failed to get blockchain' });
    }
  });

  /**
   * Get specific block
   * GET /api/blockchain/block/:index
   */
  router.get('/block/:index', (req, res) => {
    try {
      const index = parseInt(req.params.index);
      if (index < 0 || index >= blockchain.chain.length) {
        return res.status(404).json({ error: 'Block not found' });
      }
      res.json(blockchain.chain[index].toJSON());
    } catch (error) {
      console.error('Get block error:', error);
      res.status(500).json({ error: 'Failed to get block' });
    }
  });

  /**
   * Verify vote in blockchain
   * GET /api/blockchain/verify/:voteHash
   */
  router.get('/verify/:voteHash', (req, res) => {
    try {
      const { voteHash } = req.params;
      const result = blockchain.verifyVote(voteHash);
      res.json({
        voteHash,
        ...result,
        centerId
      });
    } catch (error) {
      console.error('Verify vote error:', error);
      res.status(500).json({ error: 'Failed to verify vote' });
    }
  });

  /**
   * Get all votes from blockchain
   * GET /api/blockchain/votes
   */
  router.get('/votes', (req, res) => {
    try {
      const votes = blockchain.getAllVotes();
      res.json({
        centerId,
        votes,
        count: votes.length
      });
    } catch (error) {
      console.error('Get votes error:', error);
      res.status(500).json({ error: 'Failed to get votes' });
    }
  });

  /**
   * Get vote counts from blockchain
   * GET /api/blockchain/counts
   */
  router.get('/counts', (req, res) => {
    try {
      const counts = blockchain.countVotesFromChain();
      res.json({
        centerId,
        ...counts,
        source: 'blockchain'
      });
    } catch (error) {
      console.error('Count votes error:', error);
      res.status(500).json({ error: 'Failed to count votes' });
    }
  });

  /**
   * Validate blockchain integrity
   * GET /api/blockchain/validate
   */
  router.get('/validate', (req, res) => {
    try {
      const isValid = blockchain.isChainValid();
      const stats = blockchain.getStats();
      
      res.json({
        centerId,
        isValid,
        chainLength: stats.chainLength,
        latestBlockHash: stats.latestBlockHash,
        message: isValid ? 'Blockchain is valid' : 'Blockchain integrity compromised!'
      });
    } catch (error) {
      console.error('Validate chain error:', error);
      res.status(500).json({ error: 'Failed to validate blockchain' });
    }
  });

  /**
   * Get pending transactions
   * GET /api/blockchain/pending
   */
  router.get('/pending', (req, res) => {
    try {
      res.json({
        centerId,
        pending: blockchain.pendingTransactions,
        count: blockchain.pendingTransactions.length
      });
    } catch (error) {
      console.error('Get pending error:', error);
      res.status(500).json({ error: 'Failed to get pending transactions' });
    }
  });

  /**
   * Mine pending transactions (manual trigger)
   * POST /api/blockchain/mine
   */
  router.post('/mine', (req, res) => {
    try {
      if (blockchain.pendingTransactions.length === 0) {
        return res.json({
          success: false,
          message: 'No pending transactions to mine'
        });
      }

      const block = blockchain.minePendingTransactions();
      
      db.log('BLOCK_MINED', null, `Block ${block.index} mined with ${block.transactions.length} transactions`);
      
      res.json({
        success: true,
        block: block.toJSON(),
        message: `Block ${block.index} mined successfully`
      });
    } catch (error) {
      console.error('Mine error:', error);
      res.status(500).json({ error: 'Failed to mine block' });
    }
  });

  // Export blockchain instance getter
  router.getBlockchain = () => blockchain;

  return router;
}

export { blockchains };
