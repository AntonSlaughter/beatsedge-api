/**************************************************
 * BeatsEdge Server - Live Engine Build
 **************************************************/

require("dotenv").config();

const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const Stripe = require("stripe");
const axios = require("axios");

const app = express();

/* =================================================
   ENV
================================================= */

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const BALLDONTLIE_KEY = process.env.BALLDONTLIE_API_KEY || null;

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || null;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || null;

/* =================================================
   STRIPE INIT
================================================= */

let stripe = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

/* =================================================
   DATABASE
================================================= */

const db = new sqlite3.Database("./beatsedge.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      subscription TEXT DEFAULT 'free',
      stripe_customer_id TEXT
    )
  `);
});

/* =================================================
   MIDDLEWARE
================================================= */

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =================================================
   EV CALCULATION
================================================= */

function calculateEV(prob, americanOdds) {
  let implied;

  if (americanOdds < 0) {
    implied = Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  } else {
    implied = 100 / (americanOdds + 100);
  }

  const decimal =
    americanOdds < 0
      ? 100 / Math.abs(americanOdds)
      : americanOdds / 100;

  const ev = prob * decimal - (1 - prob);

  return {
    impliedProbability: +(implied * 100).toFixed(1),
    expectedValue: +ev.toFixed(3)
  };
}

/* =================================================
   LIVE EDGES ROUTE
================================================= */

app.get("/api/edges/premium", async (req, res) => {
  try {

    if (!BALLDONTLIE_KEY) {
      return res.status(500).json({ error: "BALLDONTLIE_API_KEY missing" });
    }

    const today = new Date().toISOString().split("T")[0];

    // 1️⃣ Get today's games
    const gamesRes = await axios.get(
      `https://api.balldontlie.io/v1/games?dates[]=${today}`,
      {
        headers: { Authorization: BALLDONTLIE_KEY }
      }
    );

    const games = gamesRes.data.data;
    if (!games.length) {
      return res.json({ bestThree: [], players: [] });
    }

    let players = [];

    // Limit games for speed
    for (let game of games.slice(0, 2)) {

      const statsRes = await axios.get(
        `https://api.balldontlie.io/v1/stats?game_ids[]=${game.id}&per_page=50`,
        {
          headers: { Authorization: BALLDONTLIE_KEY }
        }
      );

      const stats = statsRes.data.data;

      for (let stat of stats.slice(0, 8)) {

        const playerId = stat.player.id;
        const fullName =
          stat.player.first_name + " " + stat.player.last_name;

        const historyRes = await axios.get(
          `https://api.balldontlie.io/v1/stats?player_ids[]=${playerId}&per_page=10`,
          {
            headers: { Authorization: BALLDONTLIE_KEY }
          }
        );

        const history = historyRes.data.data;
        if (!history.length) continue;

        const pointsList = history.map(g => g.pts || 0);

        const avg =
          pointsList.reduce((a, b) => a + b, 0) /
          pointsList.length;

        const line = +(avg - 1.5).toFixed(1);

        const hits =
          pointsList.filter(p => p > line).length;

        const probability = hits / pointsList.length;

        const vegasOdds = -110;

        const evData = calculateEV(probability, vegasOdds);

        players.push({
          player: fullName,
          stat: "Points",
          line,
          direction: "OVER",
          probability: Math.round(probability * 100),
          vegasOdds,
          impliedProbability: evData.impliedProbability,
          expectedValue: evData.expectedValue
        });
      }
    }

    players.sort((a, b) => b.expectedValue - a.expectedValue);

    const bestThree = players.slice(0, 3);

    res.json({
      bestThree,
      players
    });

  } catch (err) {
    console.error("Live engine error:", err.message);
    res.status(500).json({ error: "Live data fetch failed" });
  }
});

/* =================================================
   HEALTH
================================================= */

app.get("/api/health", (req, res) => {
  res.json({ status: "BeatsEdge API live" });
});

/* =================================================
   START SERVER
================================================= */

app.listen(PORT, () => {
  console.log(`🚀 BeatsEdge running on port ${PORT}`);
});
