require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const BALL_KEY = process.env.BALLDONTLIE_API_KEY;
const BALL_BASE = "https://api.balldontlie.io/v1";

let PLAYER_ID_MAP = {};
try {
  PLAYER_ID_MAP = require("./playerMap.json");
} catch (e) {
  console.log("⚠️ playerMap.json not found — headshots disabled");
}

const app = express();
const PORT = process.env.PORT || 8080;

/* =================================================
   CACHE SYSTEMS
================================================= */

let cachedSlate = { data: [], included: [] };
let lastFetchTime = 0;
const SLATE_CACHE_DURATION = 5 * 60 * 1000;

let playerStatsCache = {};
const PLAYER_CACHE_DURATION = 6 * 60 * 60 * 1000;

/* =================================================
   PRIZEPICKS FETCH
================================================= */

async function fetchPrizePicks() {
  const now = Date.now();

  if (now - lastFetchTime < SLATE_CACHE_DURATION) {
    return cachedSlate;
  }

  try {
    const response = await axios.get(
      "https://api.prizepicks.com/projections?league_id=7",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
          "Origin": "https://app.prizepicks.com",
          "Referer": "https://app.prizepicks.com/"
        },
        timeout: 10000
      }
    );

    if (response.data?.data) {
      cachedSlate = response.data;
      lastFetchTime = now;
    }

    return cachedSlate;

  } catch (err) {
    console.log("⚠️ PrizePicks blocked — using cache");
    return cachedSlate;
  }
}

/* =================================================
   BALLDONTLIE FETCH (CACHED)
================================================= */

async function fetchLast10Games(playerId) {
  if (!BALL_KEY) return null;

  const now = Date.now();

  if (
    playerStatsCache[playerId] &&
    now - playerStatsCache[playerId].timestamp < PLAYER_CACHE_DURATION
  ) {
    return playerStatsCache[playerId].data;
  }

  try {
    const response = await axios.get(
      `${BALL_BASE}/stats`,
      {
        params: {
          "player_ids[]": playerId,
          per_page: 10
        },
        headers: {
          Authorization: BALL_KEY
        }
      }
    );

    const games = response.data?.data || [];

    playerStatsCache[playerId] = {
      timestamp: now,
      data: games
    };

    return games;

  } catch (err) {
    console.log("BallDontLie error:", err.message);
    return null;
  }
}

/* =================================================
   HELPERS
================================================= */

function normalizeName(name) {
  if (!name) return null;
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/'/g, "")
    .trim();
}

function getStatKey(stat) {
  const s = stat.toLowerCase();
  if (s.includes("point")) return "pts";
  if (s.includes("rebound")) return "reb";
  if (s.includes("assist")) return "ast";
  return null;
}

/* =================================================
   EDGE ENGINE (ASYNC SAFE)
================================================= */

async function buildEdges(projections = [], included = []) {
  if (!Array.isArray(projections) || !Array.isArray(included)) {
    return { players: [], games: [] };
  }

  const players = {};
  const includedMap = {};

  included.forEach(item => {
    if (item?.type && item?.id) {
      includedMap[`${item.type}-${item.id}`] = item;
    }
  });

  for (const proj of projections) {
    try {
      const attr = proj?.attributes;
      const relationships = proj?.relationships;

      if (!attr || !relationships?.new_player?.data) continue;

      const playerRel = relationships.new_player.data;
      const playerObj =
        includedMap[`${playerRel.type}-${playerRel.id}`];

      if (!playerObj) continue;

      const playerName = normalizeName(playerObj?.attributes?.name);
      const teamCode =
        playerObj?.attributes?.team?.toLowerCase();

      if (!playerName || !teamCode) continue;

      const line = attr?.line_score;
      const stat = attr?.stat_type;

      if (!line || !stat) continue;

      let probability = 0.5;

      const playerId = PLAYER_ID_MAP[playerName];

      if (playerId) {
        const games = await fetchLast10Games(playerId);

        if (games && games.length > 0) {
          const statKey = getStatKey(stat);

          if (statKey) {
            let overs = 0;

            games.forEach(g => {
              if (g[statKey] > line) overs++;
            });

            const hitRate = overs / games.length;

            // smoothing factor
            probability = (hitRate * 0.85) + 0.075;
          }
        }
      }

      const edge = (probability - 0.5) * 100;

      if (!players[playerName]) {
        players[playerName] = {
          player: playerName,
          playerId: playerId || null,
          team: teamCode,
          opponent: null,
          startTime: null,
          props: []
        };
      }

      players[playerName].props.push({
        stat,
        line,
        probability: +(probability * 100).toFixed(1),
        edge: +edge.toFixed(2)
      });

    } catch (e) {
      console.log("⚠️ Skipped projection");
    }
  }

  return {
    players: Object.values(players),
    games: []
  };
}

/* =================================================
   ROUTE
================================================= */

app.get("/api/edges/today", async (req, res) => {
  try {
    const slate = await fetchPrizePicks();

    const result = await buildEdges(
      slate?.data || [],
      slate?.included || []
    );

    if (!result.players.length) {
      return res.json({
        meta: {
          generatedAt: new Date().toISOString(),
          modelVersion: "6.0.0-mock",
          totalPlayers: 3
        },
        games: [],
        players: [
          {
            player: "Luka Doncic",
            playerId: 3945274,
            team: "dal",
            opponent: "lal",
            startTime: new Date().toISOString(),
            props: [
              { stat: "Points", line: 30.5, probability: 63.2, edge: 13.2 }
            ]
          }
        ]
      });
    }

    res.json({
      meta: {
        generatedAt: new Date().toISOString(),
        modelVersion: "6.0.0",
        totalPlayers: result.players.length
      },
      games: [],
      players: result.players
    });

  } catch (err) {
    console.log("Route error:", err.message);

    res.json({
      meta: {
        generatedAt: new Date().toISOString(),
        modelVersion: "6.0.0",
        totalPlayers: 0
      },
      games: [],
      players: []
    });
  }
});

/* =================================================
   STATIC
================================================= */

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 BeatsEdge running on ${PORT}`);
});
