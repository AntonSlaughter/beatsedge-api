require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

console.log('🟡 PrizePicks fetcher loaded');

/* =====================================================
   LOAD PROPS FROM LOCAL FILE (Railway-safe)
===================================================== */
function loadPrizePicksFromFile() {
  try {
    console.log('🟡 Loading PrizePicks projections from file...');

    const filePath = path.join(__dirname, 'prizepicksProps.json');
    console.log('📁 File path:', filePath);

    if (!fs.existsSync(filePath)) {
      console.log('⚠️ prizepicksProps.json not found');
      return [];
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);

    console.log('🟢 Raw projections loaded:', json.length);

    // Normalize structure
    const normalized = json.map(p => ({
      player: p.player,
      stat: p.stat,
      line: Number(p.line)
    }));

    console.log('🟢 Normalized props:', normalized.length);

    return normalized;

  } catch (err) {
    console.error('❌ Failed to load projections:', err.message);
    return [];
  }
}

/* =====================================================
   SIMPLE EDGE ENGINE (Node-only, safe)
===================================================== */
function buildEdges(props) {
  console.log('🔨 Building edges from props:', props.length);

  if (!Array.isArray(props) || props.length === 0) {
    return [];
  }

  const edges = props.map(p => {
    return {
      player: p.player,
      stat: p.stat,
      line: p.line,
      probability: 50,
      edge: 0,
      grade: 'C'
    };
  });

  console.log('✅ Edges built:', edges.length);
  return edges;
}

/* =====================================================
   ROUTES
===================================================== */

app.get('/api/test', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/player-props', (req, res) => {
  const props = loadPrizePicksFromFile();
  res.json(props);
});

app.get('/api/edges/today', (req, res) => {
  console.log('🚨 /api/edges/today HIT');

  const props = loadPrizePicksFromFile();
  const edges = buildEdges(props);

  res.json(edges);
});

/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, () => {
  console.log('🚀 BeatsEdge running on port', PORT);
});
