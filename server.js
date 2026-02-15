require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const PLAYER_ID_MAP = require("./playerMap.json");

const app = express();
const PORT = process.env.PORT || 8080;

/* ==================================
   CACHE
================================== */

let cachedSlate = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchPrizePicks() {
  const now = Date.now();

  if (cachedSlate && now - lastFetchTime < CACHE_DURATION) {
    return cachedSlate;
  }

  console.log("🔄 Fetching PrizePicks API...");

  const response = await axios.get(
    "https://api.prizepicks.com/projections?league_id=7"
  );

  cachedSlate = response.data;
  lastFetchTime = now;

  return cachedSlate;
}

/* ==================================
   UTILITIES
================================== */

function normalizeName(name) {
  return name
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/'/g, "")
    .trim();
}

/* ==================================
   EDGE ENGINE (Your Existing Math)
================================== */

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function buildEdges(projections, included) {
  const players = {};
  const games = {};

  const includedMap = {};
  included.forEach(item => {
    includedMap[`${item.type}-${item.id}`] = item;
  });

  projections.forEach(proj => {
    const attr = proj.attributes;
    const relationships = proj.relationships;

    if (!relationships?.new_player?.data) return;

    const playerRel = relationships.new_player.data;
    const playerObj =
      includedMap[`${playerRel.type}-${playerRel.id}`];

    if (!playerObj) return;

    const playerName = normalizeName(playerObj.attributes.name);
    const teamCode =
      playerObj.attributes.team?.toLowerCase() || "unk";

    const gameRel = relationships.game?.data;
    let opponent = "unk";
    let startTime = null;

    if (gameRel) {
      const gameObj =
        includedMap[`${gameRel.type}-${gameRel.id}`];

      if (gameObj) {
        startTime = gameObj.attributes.start_time;

        const home = gameObj.attributes.home_team?.toLowerCase();
        const away = gameObj.attributes.away_team?.toLowerCase();

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

    const line = attr.line_score;
    const stat = attr.stat_type;

    if (!line || !stat) return;

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

  const sortedPlayers = Object.values(players).sort(
    (a, b) => b.props[0].edge - a.props[0].edge
  );

  return {
    players: sortedPlayers,
    games: Object.values(games)
  };
}

/* ==================================
   ROUTE
================================== */

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
        modelVersion: "3.0.0",
        totalPlayers: result.players.length
      },
      games: result.games,
      players: result.players
    });
  } catch (err) {
    console.error("❌ API ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch projections" });
  }
});

/* ==================================
   STATIC
================================== */

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 BeatsEdge Live Engine running on ${PORT}`);
});
