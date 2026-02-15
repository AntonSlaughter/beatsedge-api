require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const PLAYER_ID_MAP = require("./playerMap.json");

const app = express();
const PORT = process.env.PORT || 8080;

/* =================================================
   CACHE SYSTEM (5 MINUTES)
================================================= */

let cachedSlate = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchPrizePicks() {
  const now = Date.now();

  if (cachedSlate && now - lastFetchTime < CACHE_DURATION) {
    console.log("🟢 Using cached slate");
    return cachedSlate;
  }

  console.log("🔄 Fetching PrizePicks API...");

  try {
    const response = await axios.get(
      "https://api.prizepicks.com/projections?league_id=7",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Origin": "https://app.prizepicks.com",
          "Referer": "https://app.prizepicks.com/"
        },
        timeout: 10000
      }
    );

    cachedSlate = response.data;
    lastFetchTime = now;

    console.log("✅ PrizePicks API fetched successfully");

    return cachedSlate;
  } catch (err) {
    console.error("❌ PrizePicks fetch failed:", err.message);

    if (cachedSlate) {
      console.log("⚠️ Returning last cached slate");
      return cachedSlate;
    }

    throw new Error("No projection data available");
  }
}

/* =================================================
   UTILITIES
================================================= */

function normalizeName(name) {
  return name
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/'/g, "")
    .trim();
}

/* =================================================
   EDGE ENGINE
================================================= */

function buildEdges(projections, included) {
  const players = {};
  const games = {};

  if (!Array.isArray(projections) || !Array.isArray(included)) {
    return { players: [], games: [] };
  }

  const includedMap = {};
  included.forEach(item => {
    includedMap[`${item.type}-${item.id}`] = item;
  });

  projections.forEach(proj => {
    const attr = proj.attributes;
    const relationships = proj.relationships;

    if (!attr || !relationships?.new_player?.data) return;

    const playerRel = relationships.new_player.data;
    const playerObj =
      includedMap[`${playerRel.type}-${playerRel.id}`];

    if (!playerObj) return;

    const playerName = normalizeName(playerObj.attributes.name);
    const teamCode =
      playerObj.attributes.team?.toLowerCase() || null;

    if (!teamCode) return;

    /* ---------------- GAME ---------------- */

    const gameRel = relationships.game?.data;
    let opponent = null;
    let startTime = null;

    if (gameRel) {
      const gameObj =
        includedMap[`${gameRel.type}-${gameRel.id}`];

      if (gameObj) {
        const home =
          gameObj.attributes.home_team?.toLowerCase();
        const away =
          gameObj.attributes.away_team?.toLowerCase();

        startTime = gameObj.attributes.start_time;

        opponent = teamCode === home ? away : home;

        games[gameObj.id] = {
          gameId: gameObj.id,
          homeTeam: home,
          awayTeam: away,
          startTimeISO: startTime,
          status: "scheduled"
        };
      }
    }

    if (!opponent) return;

    /* ---------------- PROP ---------------- */

    const line = attr.line_score;
    const stat = attr.stat_type;

    if (!line || !stat) return;

    /* ---------------- EDGE MODEL (TEMP UNTIL YOU PLUG REAL MATH) ---------------- */

    const probability = 0.55 + Math.random() * 0.15;
    const edge = (probability - 0.5) * 100;

    if (!players[playerName]) {
      players[playerName] = {
        player: playerName,
        playerId: PLAYER_ID_MAP[playerName] || null,
        team: teamCode,
        opponent,
        startTime,
        props: []
      };
    }

    players[playerName].props.push({
      stat,
      line,
      probability: +(probability * 100).toFixed(1),
      edge: +edge.toFixed(2)
    });
  });

  const sortedPlayers = Object.values(players)
    .filter(p => p.props.length > 0)
    .sort((a, b) => b.props[0].edge - a.props[0].edge);

  return {
    players: sortedPlayers,
    games: Object.values(games)
  };
}

/* =================================================
   ROUTE
================================================= */

app.get("/api/edges/today", async (req, res) => {
  try {
    const slate = await fetchPrizePicks();

    const result = buildEdges(
      slate.data,
      slate.included
    );

    res.json({
      meta: {
        generatedAt: new Date().toISOString(),
        modelVersion: "3.1.0",
        totalPlayers: result.players.length
      },
      games: result.games,
      players: result.players
    });
  } catch (err) {
    console.error("❌ Route error:", err.message);

    res.status(500).json({
      error: "Projection data unavailable",
      players: [],
      games: []
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
  console.log(`🚀 BeatsEdge Live Engine running on ${PORT}`);
});
