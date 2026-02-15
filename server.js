require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const PLAYER_ID_MAP = require("./playerMap.json");

const app = express();
const PORT = process.env.PORT || 3000;
const PROPS_FILE = path.join(__dirname, "prizepicksProps.json");

/* ================================
   UTILITIES
================================ */

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function randomRank() {
  return Math.floor(Math.random() * 30) + 1;
}

function gradeFromRank(rank) {
  if (rank >= 24) return "A";
  if (rank >= 18) return "B";
  if (rank >= 12) return "C";
  if (rank >= 6) return "D";
  return "F";
}

function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/'/g, "")
    .trim();
}

function parseGameString(gameString) {
  if (!gameString || !gameString.includes("@")) {
    return {
      team: "UNK",
      opponent: "UNK",
      homeAway: "unknown"
    };
  }

  const [away, home] = gameString.split("@").map(t => t.trim());

  return {
    team: away,
    opponent: home,
    homeAway: "away"
  };
}

/* ================================
   MATH
================================ */

function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-x * x));
  return sign * y;
}

function normalCDF(x, mean, std) {
  return 0.5 * (1 + erf((x - mean) / (std * Math.sqrt(2))));
}

/* ================================
   LOAD PROPS
================================ */

function loadProps() {
  try {
    if (!fs.existsSync(PROPS_FILE)) return [];
    const raw = fs.readFileSync(PROPS_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ================================
   EDGE ENGINE
================================ */

function buildPortfolio(props) {
  const positions = [];
  const seen = new Set();

  for (let prop of props) {
    if (!prop.player || !prop.propType || !prop.line) continue;
    if (prop.player.includes("+")) continue;

    const playerName = normalizeName(prop.player);
    const key = `${playerName}-${prop.propType}-${prop.line}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const usage = random(18, 30);
    const minutes = random(26, 38);
    const last5 = random(45, 75);
    const defenseRank = randomRank();
    const pace = random(0.92, 1.08);
    const injuryBoost = random(0.95, 1.10);
    const blowoutRisk = random(0, 15);

    const projectedMean =
      prop.line *
      (usage / 22) *
      (minutes / 32) *
      pace *
      injuryBoost *
      (1 + (30 - defenseRank) / 120);

    const stdDev = prop.line * 0.25;

    const probability =
      1 - normalCDF(prop.line, projectedMean, stdDev);

    if (probability <= 0.54) continue;

    const edge = probability - 0.5;
    const expectedReturn = edge * 100;
    const kelly = probability * 2 - 1;

    const parsedGame = parseGameString(prop.game);

    positions.push({
      player: playerName,
      stat: prop.propType.replace("player_", ""),
      line: prop.line,
      team: parsedGame.team,
      opponent: parsedGame.opponent,
      homeAway: parsedGame.homeAway,
      game: prop.game || null,
      startTime: prop.startTime || null,

      probability: +(probability * 100).toFixed(1),
      edge: +(edge * 100).toFixed(2),
      expectedReturn: +expectedReturn.toFixed(2),

      usage: +usage.toFixed(1),
      minutes: +minutes.toFixed(1),
      last5HitRate: +last5.toFixed(1),
      defenseRank,
      matchupGrade: gradeFromRank(defenseRank),

      paceFactor: +pace.toFixed(2),
      injuryImpact: +injuryBoost.toFixed(2),
      blowoutRisk: +blowoutRisk.toFixed(1),

      kellyFraction: +kelly.toFixed(3),
      confidenceTier:
        probability > 0.65
          ? "High"
          : probability > 0.58
          ? "Medium"
          : "Low",

      projectedStarter: minutes >= 32
    });
  }

  return positions;
}

/* ================================
   ROUTES
================================ */

app.get("/api/edges/today", (req, res) => {
  const props = loadProps();
  const positions = buildPortfolio(props);
  const now = new Date();

  const players = {};
  const games = {};
  const missingIds = new Set();

  positions.forEach(p => {
    const mappedId = PLAYER_ID_MAP[p.player] || null;
    if (!mappedId) missingIds.add(p.player);

    const gameId = `${p.team}-vs-${p.opponent}`;

    if (!games[gameId]) {
      games[gameId] = {
        gameId,
        homeTeam: p.homeAway === "home" ? p.team : p.opponent,
        awayTeam: p.homeAway === "away" ? p.team : p.opponent,
        startTimeISO: p.startTime || now.toISOString(),
        status: "scheduled"
      };
    }

    if (!players[p.player]) {
      players[p.player] = {
        playerId: mappedId,
        playerName: p.player,
        team: p.team,
        opponent: p.opponent,
        homeAway: p.homeAway,
        gameId,
        position: null,
        injuryStatus: "Healthy",
        starting: p.projectedStarter,
        minutesProjection: p.minutes,
        usageProjection: p.usage,
        props: []
      };
    }

    players[p.player].props.push({
      propId: `${p.player}-${p.stat}-${p.line}`,
      market: p.stat,
      line: p.line,
      probabilityOver: p.probability / 100,
      edge: p.edge,
      confidenceTier: p.confidenceTier,
      expectedReturn: p.expectedReturn,
      matchupGrade: p.matchupGrade,
      defenseRank: p.defenseRank,
      usage: p.usage,
      minutes: p.minutes,
      last5HitRate: p.last5HitRate,
      projectedStarter: p.projectedStarter,
      paceFactor: p.paceFactor,
      injuryImpact: p.injuryImpact,
      blowoutRisk: p.blowoutRisk,
      kellyFraction: p.kellyFraction
    });
  });

  Object.values(players).forEach(player => {
    player.props.sort((a, b) => b.edge - a.edge);
  });

  const sortedPlayers = Object.values(players).sort(
    (a, b) => b.props[0].edge - a.props[0].edge
  );

  if (missingIds.size > 0) {
    console.warn("⚠️ Missing ESPN IDs:");
    missingIds.forEach(name => console.warn(" -", name));
  }

  res.json({
    meta: {
      generatedAt: now.toISOString(),
      modelVersion: "2.0.0",
      slateDate: now.toISOString().split("T")[0],
      totalPlayers: sortedPlayers.length
    },
    games: Object.values(games),
    players: sortedPlayers
  });
});

/* ================================
   STATIC
================================ */

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 BeatsEdge Engine running on ${PORT}`);
});
