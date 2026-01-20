/**
 * Zero-Knowledge Proof Prover (Client-side)
 * Graph Isomorphism based authentication
 */

import { sha256 } from './ecdh.js';

/**
 * Graph class for client-side
 */
class Graph {
  constructor(numNodes) {
    this.numNodes = numNodes;
    this.adjacencyMatrix = Array(numNodes).fill(null)
      .map(() => Array(numNodes).fill(0));
  }

  addEdge(i, j) {
    this.adjacencyMatrix[i][j] = 1;
    this.adjacencyMatrix[j][i] = 1;
  }

  hasEdge(i, j) {
    return this.adjacencyMatrix[i][j] === 1;
  }

  getNeighbors(i) {
    const neighbors = [];
    for (let j = 0; j < this.numNodes; j++) {
      if (this.adjacencyMatrix[i][j] === 1) {
        neighbors.push(j);
      }
    }
    return neighbors;
  }

  toJSON() {
    return {
      numNodes: this.numNodes,
      adjacencyMatrix: this.adjacencyMatrix
    };
  }

  static fromJSON(json) {
    const graph = new Graph(json.numNodes);
    graph.adjacencyMatrix = json.adjacencyMatrix;
    return graph;
  }

  applyPermutation(permutation) {
    const newGraph = new Graph(this.numNodes);
    for (let i = 0; i < this.numNodes; i++) {
      for (let j = i + 1; j < this.numNodes; j++) {
        if (this.adjacencyMatrix[i][j] === 1) {
          newGraph.addEdge(permutation[i], permutation[j]);
        }
      }
    }
    return newGraph;
  }

  async getHash() {
    const data = JSON.stringify(this.adjacencyMatrix);
    return await sha256(data);
  }
}

/**
 * Generate random permutation
 */
function generateRandomPermutation(n) {
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm;
}

/**
 * Generate secret graph from seed (must match server-side)
 */
async function generateSecretGraph(seed, numNodes = 8) {
  // Create hash from seed
  const hashHex = await sha256(seed);
  const hashBytes = [];
  for (let i = 0; i < hashHex.length; i += 2) {
    hashBytes.push(parseInt(hashHex.substr(i, 2), 16));
  }
  
  const graph = new Graph(numNodes);
  let byteIndex = 0;
  let bitIndex = 0;
  
  for (let i = 0; i < numNodes; i++) {
    for (let j = i + 1; j < numNodes; j++) {
      const bit = (hashBytes[byteIndex] >> bitIndex) & 1;
      if (bit === 1) {
        graph.addEdge(i, j);
      }
      bitIndex++;
      if (bitIndex === 8) {
        bitIndex = 0;
        byteIndex = (byteIndex + 1) % hashBytes.length;
      }
    }
  }
  
  // Ensure minimum connectivity
  for (let i = 0; i < numNodes - 1; i++) {
    if (graph.getNeighbors(i).length === 0) {
      graph.addEdge(i, (i + 1) % numNodes);
    }
  }
  
  return graph;
}

/**
 * ZKP Prover for client-side authentication
 */
class ZKPProver {
  constructor(secretGraph, secretSeed) {
    this.secretGraph = secretGraph;
    this.secretSeed = secretSeed;
    this.currentPermutation = null;
    this.currentPermutedGraph = null;
  }

  /**
   * Create a commitment (permuted graph)
   */
  async createCommitment() {
    this.currentPermutation = generateRandomPermutation(this.secretGraph.numNodes);
    this.currentPermutedGraph = this.secretGraph.applyPermutation(this.currentPermutation);
    
    return {
      permutedGraph: this.currentPermutedGraph.toJSON(),
      hash: await this.currentPermutedGraph.getHash()
    };
  }

  /**
   * Respond to a challenge about a specific node
   */
  respondToChallenge(challengeNode) {
    // Return the permutation and original graph so verifier can check
    return {
      permutation: this.currentPermutation,
      originalGraph: this.secretGraph.toJSON()
    };
  }

  /**
   * Get the original graph for verification
   */
  getOriginalGraph() {
    return this.secretGraph.toJSON();
  }
}

/**
 * Create a prover from user credentials
 */
async function createProver(secretSeed) {
  const secretGraph = await generateSecretGraph(secretSeed);
  return new ZKPProver(secretGraph, secretSeed);
}

/**
 * Get graph commitment hash for registration
 */
async function getGraphCommitment(secretSeed) {
  const graph = await generateSecretGraph(secretSeed);
  return await graph.getHash();
}

export {
  Graph,
  generateRandomPermutation,
  generateSecretGraph,
  ZKPProver,
  createProver,
  getGraphCommitment
};
