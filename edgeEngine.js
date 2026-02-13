// =======================================
// edgeEngine.js — FINAL / UP-TO-PAR
// Real probability-based edge grading
// =======================================

// -----------------------
// CONFIG / CONSTANTS
// -----------------------

const STAT_ALIASES = {
  'player_Points': 'POINTS',
  'player_Rebounds': 'REBOUNDS',
  'player_Assists': 'ASSISTS',
  'player_Pts+Rebs': 'PR',
  'player_Pts+Asts': 'PA',
  'player_Rebs+Asts': 'RA',
  'player_Pts+Rebs+Asts': 'PRA'
};

// Opponent defensive adjustment (starter map)
const DEFENSE_ADJ = {
  BOS: { POINTS: -6, REBOUNDS: -4, ASSISTS: -3, PR: -5, PA: -5, RA: -4, PRA: -6 },
  WAS: { POINTS: +7, REBOUNDS: +6, ASSISTS: +5, PR: +6, PA: +6, RA: +5, PRA: +7 },
  CHA: { POINTS: +4, REBOUNDS: +3, ASSISTS: +2, PR: +3, PA: +3, RA: +2, PRA: +4 }
};

// -----------------------
// HELPERS
// -----------------------

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function gradeFromProbability(prob) {
  if (prob >= 65) return 'A';
  if (prob >= 60) return 'B';
  if (prob >= 55) return 'C';
  return 'D';
}

// -----------------------
// MAIN EDGE BUILDER
// -----------------------

function buildEdges(props = [], players = {}) {
  const edges = [];

  console.log('🔨 Building edges from props:', props.length);

  for (const prop of props) {
    const stat = STAT_ALIASES[prop.propType];
    if (!stat) continue;

console.log('PROP DEBUG:', prop.propType);

    const playerData = players[prop.player];
    if (!playerData || !playerData[stat]) continue;

    const baseProb = playerData[stat].L10;
    if (typeof baseProb !== 'number') continue;

    let probability = baseProb;
    const reasons = ['L10 hit rate'];

    // -----------------------
    // DEFENSE ADJUSTMENT
    // -----------------------
    const defenseAdj = DEFENSE_ADJ[prop.opponent]?.[stat] ?? 0;
    if (defenseAdj !== 0) {
      probability += defenseAdj;
      reasons.push(`Opponent defense ${defenseAdj > 0 ? 'weak' : 'strong'}`);
    }

    // -----------------------
    // HOME / AWAY
    // -----------------------
    if (prop.isHome === true) {
      probability += 3;
      reasons.push('Home boost');
    } else if (prop.isHome === false) {
      probability -= 3;
      reasons.push('Away downgrade');
    }

    // -----------------------
    // FINALIZE
    // -----------------------
    probability = clamp(Math.round(probability), 5, 95);
    const grade = gradeFromProbability(probability);

    edges.push({
      player: prop.player,
      stat,
      line: prop.line,
      probability,
      grade,
      reasons
    });
  }

  console.log('✅ Edges built:', edges.length);
  return edges;
}

module.exports = { buildEdges };
