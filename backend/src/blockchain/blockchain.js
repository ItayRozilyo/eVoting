/**
 * Blockchain Implementation for E-Voting System
 * 
 * Each vote is a transaction, grouped into blocks.
 * Each block contains a hash of the previous block, creating an immutable chain.
 */

import crypto from 'crypto';

/**
 * Calculate SHA-256 hash
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Block class - represents a single block in the chain
 */
class Block {
  constructor(index, timestamp, transactions, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions; // Array of vote transactions
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  /**
   * Calculate block hash
   */
  calculateHash() {
    return sha256(
      this.index +
      this.timestamp +
      JSON.stringify(this.transactions) +
      this.previousHash +
      this.nonce
    );
  }

  /**
   * Mine block with proof of work
   * @param {number} difficulty - Number of leading zeros required
   */
  mineBlock(difficulty) {
    const target = '0'.repeat(difficulty);
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    console.log(`Block mined: ${this.hash}`);
  }

  /**
   * Convert to JSON-safe object
   */
  toJSON() {
    return {
      index: this.index,
      timestamp: this.timestamp,
      transactions: this.transactions,
      previousHash: this.previousHash,
      nonce: this.nonce,
      hash: this.hash
    };
  }

  /**
   * Create block from JSON
   */
  static fromJSON(json) {
    const block = new Block(
      json.index,
      json.timestamp,
      json.transactions,
      json.previousHash
    );
    block.nonce = json.nonce;
    block.hash = json.hash;
    return block;
  }
}

/**
 * Blockchain class - manages the chain of blocks
 */
class Blockchain {
  constructor(centerId, difficulty = 2) {
    this.centerId = centerId;
    this.chain = [this.createGenesisBlock()];
    this.difficulty = difficulty; // Low difficulty for demo (2 leading zeros)
    this.pendingTransactions = [];
    this.miningReward = 0; // No mining reward in voting system
  }

  /**
   * Create the first block (genesis block)
   */
  createGenesisBlock() {
    return new Block(0, new Date().toISOString(), [{
      type: 'GENESIS',
      message: 'E-Voting Blockchain Genesis Block',
      centerId: this.centerId
    }], '0');
  }

  /**
   * Get the latest block in the chain
   */
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Add a vote transaction to pending transactions
   */
  addVoteTransaction(transaction) {
    // Validate transaction
    if (!transaction.voteHash || !transaction.candidate) {
      throw new Error('Invalid transaction: missing required fields');
    }

    // Add metadata
    transaction.timestamp = new Date().toISOString();
    transaction.type = 'VOTE';
    transaction.centerId = this.centerId;

    this.pendingTransactions.push(transaction);
    
    return transaction;
  }

  /**
   * Mine pending transactions into a new block
   */
  minePendingTransactions() {
    if (this.pendingTransactions.length === 0) {
      console.log('No pending transactions to mine');
      return null;
    }

    const block = new Block(
      this.chain.length,
      new Date().toISOString(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );

    console.log(`Mining block ${block.index}...`);
    block.mineBlock(this.difficulty);

    this.chain.push(block);
    this.pendingTransactions = [];

    console.log(`Block ${block.index} added to chain`);
    return block;
  }

  /**
   * Validate the entire blockchain
   */
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Recalculate hash and compare
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        console.log(`Block ${i} has invalid hash`);
        return false;
      }

      // Check link to previous block
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.log(`Block ${i} has invalid previous hash link`);
        return false;
      }
    }
    return true;
  }

  /**
   * Get all votes from the blockchain
   */
  getAllVotes() {
    const votes = [];
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.type === 'VOTE') {
          votes.push({
            ...tx,
            blockIndex: block.index,
            blockHash: block.hash
          });
        }
      }
    }
    return votes;
  }

  /**
   * Count votes from blockchain
   */
  countVotesFromChain() {
    const counts = { Democrat: 0, Republican: 0 };
    const votes = this.getAllVotes();
    
    for (const vote of votes) {
      if (counts.hasOwnProperty(vote.candidate)) {
        counts[vote.candidate]++;
      }
    }
    
    return {
      ...counts,
      total: votes.length
    };
  }

  /**
   * Verify a specific vote exists in the blockchain
   */
  verifyVote(voteHash) {
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.type === 'VOTE' && tx.voteHash === voteHash) {
          return {
            found: true,
            block: block.index,
            blockHash: block.hash,
            timestamp: tx.timestamp
          };
        }
      }
    }
    return { found: false };
  }

  /**
   * Get chain statistics
   */
  getStats() {
    const votes = this.getAllVotes();
    return {
      centerId: this.centerId,
      chainLength: this.chain.length,
      totalVotes: votes.length,
      pendingTransactions: this.pendingTransactions.length,
      difficulty: this.difficulty,
      isValid: this.isChainValid(),
      latestBlockHash: this.getLatestBlock().hash
    };
  }

  /**
   * Export chain to JSON
   */
  toJSON() {
    return {
      centerId: this.centerId,
      difficulty: this.difficulty,
      chain: this.chain.map(block => block.toJSON()),
      pendingTransactions: this.pendingTransactions
    };
  }

  /**
   * Import chain from JSON
   */
  static fromJSON(json) {
    const blockchain = new Blockchain(json.centerId, json.difficulty);
    blockchain.chain = json.chain.map(blockJson => Block.fromJSON(blockJson));
    blockchain.pendingTransactions = json.pendingTransactions || [];
    return blockchain;
  }

  /**
   * Replace chain if a longer valid chain is received
   */
  replaceChain(newChain) {
    if (newChain.length <= this.chain.length) {
      console.log('Received chain is not longer than current chain');
      return false;
    }

    // Validate the new chain
    const tempBlockchain = new Blockchain(this.centerId, this.difficulty);
    tempBlockchain.chain = newChain.map(blockJson => 
      blockJson instanceof Block ? blockJson : Block.fromJSON(blockJson)
    );

    if (!tempBlockchain.isChainValid()) {
      console.log('Received chain is invalid');
      return false;
    }

    console.log('Replacing chain with longer valid chain');
    this.chain = tempBlockchain.chain;
    return true;
  }
}

/**
 * BlockchainManager - manages blockchain instances for each center
 */
class BlockchainManager {
  constructor() {
    this.blockchains = new Map();
  }

  /**
   * Get or create blockchain for a center
   */
  getBlockchain(centerId) {
    if (!this.blockchains.has(centerId)) {
      this.blockchains.set(centerId, new Blockchain(centerId));
    }
    return this.blockchains.get(centerId);
  }

  /**
   * Add vote to blockchain and mine immediately
   */
  addVoteAndMine(centerId, voteData) {
    const blockchain = this.getBlockchain(centerId);
    blockchain.addVoteTransaction(voteData);
    return blockchain.minePendingTransactions();
  }

  /**
   * Get combined stats from all blockchains
   */
  getAllStats() {
    const stats = [];
    for (const [centerId, blockchain] of this.blockchains) {
      stats.push(blockchain.getStats());
    }
    return stats;
  }
}

// Singleton instance
const blockchainManager = new BlockchainManager();

export {
  Block,
  Blockchain,
  BlockchainManager,
  blockchainManager,
  sha256
};
