// edgeEngine.js

function oddsToProbability(odds) {
  if (odds < 0) {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  } else {
    return 100 / (odds + 100);
  }
}
function oddsToProbability(odds) {
  if (typeof odds !== 'number' || isNaN(odds)) return null;

  if (odds < 0) {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  } else {
    return 100 / (odds + 100);
  }
}
function getEdgeRecommendation(result, odds = -110) {
  const { hitRate } = result;

  const marketProb = oddsToProbability(odds);

  if (
    typeof hitRate !== 'number' ||
    isNaN(hitRate) ||
    marketProb === null
  ) {
    return {
      pick: 'NO BET',
      strength: 'NONE',
      edge: 0
    };
  }

  const edge = (hitRate - marketProb) * 100;

  let pick = 'NO BET';
  let strength = 'LOW';

  if (edge >= 5) {
    pick = 'OVER';
    strength = 'HIGH';
  } else if (edge >= 2) {
    pick = 'OVER';
    strength = 'MEDIUM';
  } else if (edge <= -5) {
    pick = 'UNDER';
    strength = 'HIGH';
  } else if (edge <= -2) {
    pick = 'UNDER';
    strength = 'MEDIUM';
  }

  return {
    pick,
    strength,
    edge: Number(edge.toFixed(1))
  };
}
module.exports = { getEdgeRecommendation };
