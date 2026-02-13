const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.join(__dirname, '../rawPrizePicksResponse.json');
const OUTPUT_FILE = path.join(__dirname, '../prizepicksProps.json');

/**
 * INTERNAL: builds prizepicksProps.json from raw snapshot
 */
function buildPrizePicksProps() {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error('❌ Missing rawPrizePicksResponse.json');
    return [];
  }

  const raw = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));

  const projections = raw.data || [];
  const included = raw.included || [];

  const playersById = {};
  included
    .filter(i => i.type === 'new_player')
    .forEach(p => {
      playersById[p.id] = p.attributes.display_name;
    });

  const results = [];

  projections.forEach(p => {
    if (p.type !== 'projection') return;

    const playerId = p.relationships?.new_player?.data?.id;
    const player = playersById[playerId];
    if (!player) return;

    results.push({
      player,
      propType: `player_${p.attributes.stat_type}`,
      line: p.attributes.line_score,
      opponent: p.attributes.opponent || 'UNK'
    });
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`✅ Saved ${results.length} props`);

  return results;
}

/**
 * PUBLIC: used by server.js
 */
function fetchPrizePicksProps() {
  if (!fs.existsSync(OUTPUT_FILE)) return [];
  return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
}

/**
 * Allow CLI execution:
 * node scripts/fetchPrizePicksLocal.js
 */
if (require.main === module) {
  buildPrizePicksProps();
}

module.exports = {
  fetchPrizePicksProps,
  buildPrizePicksProps
};
