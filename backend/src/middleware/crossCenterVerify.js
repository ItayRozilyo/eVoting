/**
 * Cross-Center Verification
 * Prevents voters from voting at multiple centers
 */

// Center configuration
const CENTERS = [
  { id: 1, url: 'http://localhost:3001' },
  { id: 2, url: 'http://localhost:3002' },
  { id: 3, url: 'http://localhost:3003' }
];

/**
 * Check if a voter has voted at any other center
 * @param {string} publicKey - Voter's public key
 * @param {number} currentCenterId - Current center's ID
 * @returns {Promise<{voted: boolean, center?: number}>}
 */
async function checkVotedAtOtherCenters(publicKey, currentCenterId) {
  const otherCenters = CENTERS.filter(c => c.id !== currentCenterId);
  
  for (const center of otherCenters) {
    try {
      const response = await fetch(`${center.url}/api/vote/check-voted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.voted) {
          return { voted: true, center: center.id };
        }
      }
    } catch (error) {
      console.log(`Could not reach center ${center.id}:`, error.message);
      // Continue checking other centers
    }
  }
  
  return { voted: false };
}

/**
 * Get voting results from other centers
 * @param {number} currentCenterId - Current center's ID
 * @returns {Promise<Array>}
 */
async function getOtherCenterResults(currentCenterId) {
  const otherCenters = CENTERS.filter(c => c.id !== currentCenterId);
  const results = [];
  
  for (const center of otherCenters) {
    try {
      const response = await fetch(`${center.url}/api/tally/counts`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        results.push({
          centerId: center.id,
          Democrat: data.results?.Democrat || 0,
          Republican: data.results?.Republican || 0,
          total: data.totalVotes || 0
        });
      }
    } catch (error) {
      console.log(`Could not reach center ${center.id}:`, error.message);
    }
  }
  
  return results;
}

/**
 * Create cross-center verification middleware
 */
function createCrossCenterMiddleware(currentCenterId) {
  return {
    checkVotedElsewhere: (publicKey) => checkVotedAtOtherCenters(publicKey, currentCenterId),
    getCenterResults: () => getOtherCenterResults(currentCenterId)
  };
}

export {
  checkVotedAtOtherCenters,
  getOtherCenterResults,
  createCrossCenterMiddleware,
  CENTERS
};
