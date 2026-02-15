require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

/* =================================================
   ENV
================================================= */

const BALL_KEY = process.env.BALLDONTLIE_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const BALL_BASE = "https://api.balldontlie.io/v1";

/* =================================================
   PLAYER MAP
================================================= */

let PLAYER_ID_MAP = {};
try {
  PLAYER_ID_MAP = require("./playerMap.json");
} catch {
  console.log("⚠️ playerMap.json not found");
}

/* =================================================
   CACHE SYSTEMS
================================================= */

let cachedSlate = { data: [], included: [] };
let lastFetchTime = 0;
const SLATE_CACHE_DURATION = 5 * 60 * 1000;

let playerStatsCache = {};
const PLAYER_CACHE_DURATION = 6 * 60 * 60 * 1000;

/* =================================================
   MODEL PERFORMANCE TRACKING
================================================= */

let modelPerformance = {
  total: 0,
  wins: 0,
  losses: 0
};

/* =================================================
   DISCORD ALERT SYSTEM
================================================= */

const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const alertCache = {};

async function sendDiscordAlert(player, prop) {
  if (!DISCORD_WEBHOOK) return;

  const key = `${player.player}-${prop.stat}-${prop.line}-${prop.direction}`;
  const now = Date.now();

  if (alertCache[key] && now - alertCache[key] < ALERT_COOLDOWN_MS) {
    return;
  }

  alertCache[key] = now;
  modelPerformance.total++;

  try {
    await axios.post(DISCORD_WEBHOOK, {
      embeds: [
        {
          title: "🔥 A+ EDGE DETECTED",
          color: 0x1db954,
          fields: [
            { name: "Player", value: player.player, inline: true },
            { name: "Team", value: player.team || "N/A", inline: true },
            { name: "Stat", value: prop.stat, inline: true },
            { name: "Line", value: String(prop.line), inline: true },
            { name: "Pick", value: prop.direction, inline: true },
            { name: "Probability", value: `${prop.probability}%`, inline: true },
            { name: "Edge", value: `${prop.edge}%`, inline: true }
          ],
          footer: { text: "BeatsEdge Engine v7.0" },
          timestamp: new Date()
        }
      ]
    });

    console.log("✅ Discord alert sent:", player.player);

  } catch (err) {
    console.log("❌ Discord error:", err.message);
  }
}

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
          Accept: "application/json",
          Origin: "https://app.prizepicks.com",
          Referer: "https://app.prizepicks.com/"
        },
        timeout: 10000
      }
    );

    if (response.data?.data) {
      cachedSlate = response.data;
      lastFetchTime = now;
    }

    return cachedSlate;

  } catch {
    console.log("⚠️ PrizePicks blocked — using cache");
    return cachedSlate;
  }
}

/* =================================================
   BALLDONTLIE FETCH
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
    const response = await axios.get(`${BALL_BASE}/stats`, {
      params: {
        "player_ids[]": playerId,
        per_page: 10
      },
      headers: { Authorization: BALL_KEY }
    });

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
   EDGE ENGINE
================================================= */

async function buildEdges(projections = [], included = []) {

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
      const rel = proj?.relationships?.new_player?.data;
      if (!attr || !rel) continue;

      const playerObj = includedMap[`${rel.type}-${rel.id}`];
      if (!playerObj) continue;

      const playerName = normalizeName(playerObj?.attributes?.name);
      const teamCode = playerObj?.attributes?.team?.toLowerCase();
      const line = attr?.line_score;
      const stat = attr?.stat_type;

      if (!playerName || !teamCode || !line || !stat) continue;

      let probability = 0.5;
      const playerId = PLAYER_ID_MAP[playerName];

      if (playerId) {
        const games = await fetchLast10Games(playerId);
        const statKey = getStatKey(stat);

        if (games?.length && statKey) {
          let overs = 0;
          games.forEach(g => {
            if (g[statKey] > line) overs++;
          });

          const hitRate = overs / games.length;
          probability = (hitRate * 0.85) + 0.075;
        }
      }

      /* ===== OVER / UNDER DETECTION ===== */

      let overProb = probability;
      let underProb = 1 - overProb;

      let overEdge = (overProb - 0.5) * 100;
      let underEdge = (underProb - 0.5) * 100;

      let finalDirection = "OVER";
      let finalProb = overProb;
      let finalEdge = overEdge;

      if (Math.abs(underEdge) > Math.abs(overEdge)) {
        finalDirection = "UNDER";
        finalProb = underProb;
        finalEdge = underEdge;
      }

      if (!players[playerName]) {
        players[playerName] = {
          player: playerName,
          playerId: playerId || null,
          team: teamCode,
          props: []
        };
      }

      const propObj = {
        stat,
        line,
        direction: finalDirection,
        probability: +(finalProb * 100).toFixed(1),
        edge: +finalEdge.toFixed(2)
      };

      players[playerName].props.push(propObj);

      if (propObj.edge >= 15) {
        await sendDiscordAlert(players[playerName], propObj);
      }

    } catch {
      console.log("⚠️ Skipped projection");
    }
  }

  return Object.values(players);
}

/* =================================================
   ROUTES
================================================= */

app.get("/api/edges/today", async (req, res) => {
  try {

    const slate = await fetchPrizePicks();
    const players = await buildEdges(
      slate?.data || [],
      slate?.included || []
    );

    let allProps = [];

    players.forEach(p => {
      p.props.forEach(prop => {
        allProps.push({ player: p.player, team: p.team, ...prop });
      });
    });

    allProps.sort((a,b) => Math.abs(b.edge) - Math.abs(a.edge));
    const bestThree = allProps.slice(0,3);

    res.json({
      meta: {
        generatedAt: new Date().toISOString(),
        modelVersion: "7.0.0",
        totalPlayers: players.length
      },
      bestThree,
      games: [],
      players
    });

  } catch (err) {
    console.log("Route error:", err.message);
    res.status(500).json({ error: "Projection data unavailable" });
  }
});

/* ===== Record Result ===== */

app.post("/api/result", (req, res) => {

  const { outcome } = req.body;

  if (outcome === "win") modelPerformance.wins++;
  if (outcome === "loss") modelPerformance.losses++;

  res.json({
    message: "Result recorded",
    performance: {
      ...modelPerformance,
      winRate:
        modelPerformance.total > 0
          ? ((modelPerformance.wins / modelPerformance.total) * 100).toFixed(1) + "%"
          : "0%"
    }
  });
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
