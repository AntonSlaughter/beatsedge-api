require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

let PLAYER_ID_MAP = {};
try {
  PLAYER_ID_MAP = require("./playerMap.json");
} catch (e) {
  console.log("⚠️ playerMap.json not found — continuing without headshots");
}

const app = express();
const PORT = process.env.PORT || 8080;

/* =================================================
   SAFE CACHE
================================================= */

let cachedSlate = { data: [], included: [] };
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

/* =================================================
   SAFE PRIZEPICKS FETCH
================================================= */

async function fetchPrizePicks() {
  const now = Date.now();

  if (now - lastFetchTime < CACHE_DURATION) {
    console.log("🟢 Using cached slate");
    return cachedSlate;
  }

  console.log("🔄 Fetching PrizePicks API...");

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

    if (!response.data || !response.data.data) {
      console.log("⚠️ API returned malformed data");
      return cachedSlate;
    }

    cachedSlate = response.data;
    lastFetchTime = now;

    console.log("✅ PrizePicks API fetched");
    return cachedSlate;

  } catch (err) {
    console.log("❌ PrizePicks blocked (403 likely)");

    // DO NOT THROW — return cached or empty
    return cachedSlate;
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

/* =================================================
   EDGE ENGINE (SAFE)
================================================= */

function buildEdges(projections = [], included = []) {
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

  projections.forEach(proj => {
    try {
      const attr = proj?.attributes;
      const relationships = proj?.relationships;

      if (!attr || !relationships?.new_player?.data) return;

      const playerRel = relationships.new_player.data;
      const playerObj =
        includedMap[`${playerRel.type}-${playerRel.id}`];

      if (!playerObj) return;

      const playerName = normalizeName(playerObj?.attributes?.name);
      const teamCode =
        playerObj?.attributes?.team?.toLowerCase();

      if (!playerName || !teamCode) return;

      const line = attr?.line_score;
      const stat = attr?.stat_type;

      if (!line || !stat) return;

      // temporary model
      const probability = 0.55 + Math.random() * 0.15;
      const edge = (probability - 0.5) * 100;

      if (!players[playerName]) {
        players[playerName] = {
          player: playerName,
          playerId: PLAYER_ID_MAP[playerName] || null,
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
      // Never crash entire build
      console.log("⚠️ Skipped bad projection");
    }
  });

  return {
    players: Object.values(players),
    games: []
  };
}

/* =================================================
   ROUTE — CAN NEVER 500
================================================= */

app.get("/api/edges/today", async (req, res) => {
  try {
    const slate = await fetchPrizePicks();

    const result = buildEdges(
      slate?.data || [],
      slate?.included || []
    );

    // If no players, inject test slate
    if (!result.players || result.players.length === 0) {

      console.log("⚠️ Injecting Mock Slate");

      return res.json({
        meta: {
          generatedAt: new Date().toISOString(),
          modelVersion: "5.1.0-mock",
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
          },
          {
            player: "Jayson Tatum",
            playerId: 4065648,
            team: "bos",
            opponent: "nyk",
            startTime: new Date().toISOString(),
            props: [
              { stat: "Rebounds", line: 8.5, probability: 58.7, edge: 8.7 }
            ]
          },
          {
            player: "Nikola Jokic",
            playerId: 3112335,
            team: "den",
            opponent: "pho",
            startTime: new Date().toISOString(),
            props: [
              { stat: "Assists", line: 9.5, probability: 61.4, edge: 11.4 }
            ]
          }
        ]
      });
    }

    res.json({
      meta: {
        generatedAt: new Date().toISOString(),
        modelVersion: "5.1.0",
        totalPlayers: result.players.length
      },
      games: [],
      players: result.players
    });

  } catch (err) {
    res.json({
      meta: {
        generatedAt: new Date().toISOString(),
        modelVersion: "5.1.0",
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
