/**
 * Zero-Knowledge Proof using Graph Isomorphism
 * 
 * Protocol:
 * 1. Prover has secret graph G and a permutation π
 * 2. Prover creates isomorphic graph H = π(G)
 * 3. Prover sends commitment (hash of H)
 * 4. Verifier sends random challenge (0 or 1)
 * 5. If challenge = 0: Prover reveals H and proves it's isomorphic to G
 *    If challenge = 1: Prover reveals π
 * 6. Verifier checks the response
 * 
 * Multiple rounds needed for security (probability of cheating = 1/2^rounds)
 */

import crypto from 'crypto';

/**
 * Graph class representing an adjacency matrix
 */
class Graph {
  constructor(numNodes) {
    this.numNodes = numNodes;
    this.adjacencyMatrix = Array(numNodes).fill(null)
      .map(() => Array(numNodes).fill(0));
  }

  addEdge(i, j) {
    this.adjacencyMatrix[i][j] = 1;
    this.adjacencyMatrix[j][i] = 1; // Undirected graph
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

  /**
   * Apply a permutation to create an isomorphic graph
   */
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

  /**
   * Get hash of the graph (for commitment)
   */
  getHash() {
    const data = JSON.stringify(this.adjacencyMatrix);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check if this graph is isomorphic to another via a given permutation
   */
  isIsomorphicVia(other, permutation) {
    for (let i = 0; i < this.numNodes; i++) {
      for (let j = 0; j < this.numNodes; j++) {
        if (this.adjacencyMatrix[i][j] !== other.adjacencyMatrix[permutation[i]][permutation[j]]) {
          return false;
        }
      }
    }
    return true;
  }
}

/**
 * Generate a random permutation of [0, 1, ..., n-1]
 */
function generateRandomPermutation(n) {
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm;
}

/**
 * Compose two permutations: result[i] = perm2[perm1[i]]
 */
function composePermutations(perm1, perm2) {
  return perm1.map(i => perm2[i]);
}

/**
 * Get inverse permutation
 */
function inversePermutation(perm) {
  const inv = new Array(perm.length);
  for (let i = 0; i < perm.length; i++) {
    inv[perm[i]] = i;
  }
  return inv;
}

/**
 * Generate a secret graph from a seed (deterministic)
 */
function generateSecretGraph(seed, numNodes = 8) {
  // Use seed to deterministically generate graph
  const hash = crypto.createHash('sha256').update(seed).digest();
  const graph = new Graph(numNodes);
  
  let byteIndex = 0;
  let bitIndex = 0;
  
  // Generate edges based on hash bits
  for (let i = 0; i < numNodes; i++) {
    for (let j = i + 1; j < numNodes; j++) {
      const bit = (hash[byteIndex] >> bitIndex) & 1;
      if (bit === 1) {
        graph.addEdge(i, j);
      }
      bitIndex++;
      if (bitIndex === 8) {
        bitIndex = 0;
        byteIndex = (byteIndex + 1) % hash.length;
      }
    }
  }
  
  // Ensure graph has minimum connectivity
  for (let i = 0; i < numNodes - 1; i++) {
    if (graph.getNeighbors(i).length === 0) {
      graph.addEdge(i, (i + 1) % numNodes);
    }
  }
  
  return graph;
}

/**
 * ZKP Verifier (Server-side)
 */
class ZKPVerifier {
  constructor(commitment) {
    this.commitment = commitment; // Hash of prover's registered graph
    this.sessions = new Map();
  }

  /**
   * Start a new verification session
   */
  startSession(sessionId) {
    this.sessions.set(sessionId, {
      round: 0,
      challenges: [],
      responses: [],
      commitments: [],
      verified: false
    });
    return sessionId;
  }

  /**
   * Store prover's commitment for this round
   */
  receiveCommitment(sessionId, permutedGraphHash, permutedGraph) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Invalid session');
    
    session.commitments.push({
      hash: permutedGraphHash,
      graph: permutedGraph
    });
    
    // Generate random challenge (0 or 1)
    const challenge = crypto.randomInt(0, 2);
    session.challenges.push(challenge);
    
    return challenge;
  }

  /**
   * Verify prover's response to challenge
   */
  verifyResponse(sessionId, response, originalGraph) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Invalid session');
    
    const currentRound = session.round;
    const challenge = session.challenges[currentRound];
    const commitment = session.commitments[currentRound];
    
    let valid = false;
    
    if (challenge === 0) {
      // Prover should reveal the permutation from original to permuted
      const permutation = response.permutation;
      const originalGraphObj = Graph.fromJSON(originalGraph);
      const permutedGraphObj = Graph.fromJSON(commitment.graph);
      
      // Verify that applying permutation to original gives permuted graph
      const computedPermuted = originalGraphObj.applyPermutation(permutation);
      valid = computedPermuted.getHash() === commitment.hash;
    } else {
      // Prover should reveal that permuted graph matches commitment
      const permutation = response.permutation;
      const originalGraphObj = Graph.fromJSON(originalGraph);
      const computedPermuted = originalGraphObj.applyPermutation(permutation);
      
      // Verify the permuted graph matches the commitment
      valid = computedPermuted.getHash() === commitment.hash;
    }
    
    session.responses.push({ valid, challenge, response });
    session.round++;
    
    return valid;
  }

  /**
   * Check if enough rounds have passed with all valid responses
   */
  isVerified(sessionId, requiredRounds = 20) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    if (session.round < requiredRounds) return false;
    
    // All responses must be valid
    return session.responses.every(r => r.valid);
  }

  /**
   * Clean up session
   */
  endSession(sessionId) {
    const result = this.isVerified(sessionId);
    this.sessions.delete(sessionId);
    return result;
  }
}

/**
 * Simplified ZKP verification for the voting system
 * Uses a challenge-response mechanism based on graph edges
 */
class SimpleZKPVerifier {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Start verification session
   */
  startSession(sessionId, registeredGraphHash) {
    this.sessions.set(sessionId, {
      registeredHash: registeredGraphHash,
      rounds: [],
      currentRound: 0,
      maxRounds: 5
    });
    return { sessionId, maxRounds: 5 };
  }

  /**
   * Generate challenge for current round
   */
  generateChallenge(sessionId, permutedGraph) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Invalid session');
    
    const graph = Graph.fromJSON(permutedGraph);
    
    // Random challenge: pick a random node, ask for its neighbors
    const challengeNode = crypto.randomInt(0, graph.numNodes);
    
    session.rounds.push({
      permutedGraph: permutedGraph,
      permutedHash: graph.getHash(),
      challengeNode: challengeNode,
      verified: false
    });
    
    return { challengeNode, round: session.currentRound };
  }

  /**
   * Verify response: prover shows the mapping for challenged node
   */
  verifyResponse(sessionId, originalGraph, permutation, challengeNode) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Invalid session');
    
    const round = session.rounds[session.currentRound];
    if (!round) throw new Error('Invalid round');
    
    const origGraph = Graph.fromJSON(originalGraph);
    const permGraph = Graph.fromJSON(round.permutedGraph);
    
    // Verify that the permutation correctly maps neighbors
    const originalNode = permutation.indexOf(challengeNode);
    const originalNeighbors = origGraph.getNeighbors(originalNode);
    const permutedNeighbors = permGraph.getNeighbors(challengeNode);
    
    // Map original neighbors through permutation
    const mappedNeighbors = originalNeighbors.map(n => permutation[n]).sort();
    const sortedPermutedNeighbors = [...permutedNeighbors].sort();
    
    const valid = JSON.stringify(mappedNeighbors) === JSON.stringify(sortedPermutedNeighbors);
    
    round.verified = valid;
    session.currentRound++;
    
    return { valid, round: session.currentRound - 1, remaining: session.maxRounds - session.currentRound };
  }

  /**
   * Check if verification is complete and successful
   */
  isComplete(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { complete: false, success: false };
    
    const complete = session.currentRound >= session.maxRounds;
    const success = complete && session.rounds.every(r => r.verified);
    
    return { complete, success, rounds: session.currentRound };
  }

  /**
   * Clean up session
   */
  endSession(sessionId) {
    const result = this.isComplete(sessionId);
    this.sessions.delete(sessionId);
    return result;
  }
}

export {
  Graph,
  generateRandomPermutation,
  composePermutations,
  inversePermutation,
  generateSecretGraph,
  ZKPVerifier,
  SimpleZKPVerifier
};
