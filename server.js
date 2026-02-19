/**************************************************
 * BeatsEdge Server - Clean Production Build
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

const ODDS_API_KEY = process.env.ODDS_API_KEY || null;
const BALLDONTLIE_API_KEY = process.env.BALLDONTLIE_API_KEY || null;
const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY || null;

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || null;

/* =================================================
   STRIPE (SAFE INIT)
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

function calculateEV(probabilityDecimal, americanOdds) {
  let implied;

  if (americanOdds < 0) {
    implied = Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  } else {
    implied = 100 / (americanOdds + 100);
  }

  const decimalOdds =
    americanOdds < 0
      ? 100 / Math.abs(americanOdds)
      : americanOdds / 100;

  const ev =
    probabilityDecimal * decimalOdds -
    (1 - probabilityDecimal);

  return {
    impliedProbability: +(implied * 100).toFixed(1),
    expectedValue: +ev.toFixed(3)
  };
}

/* =================================================
   PREMIUM EDGE ENGINE
================================================= */

app.get("/api/edges/premium", async (req, res) => {
  try {
    if (!ODDS_API_KEY || !BALLDONTLIE_API_KEY) {
      return res.status(500).json({
        error: "Missing ODDS_API_KEY or BALLDONTLIE_API_KEY"
      });
    }

    const oddsRes = await axios.get(
      "https://api.the-odds-api.com/v4/sports/basketball_nba/odds",
      {
        params: {
          apiKey: ODDS_API_KEY,
          regions: "us",
          markets: "player_points",
          oddsFormat: "american"
        }
      }
    );

    const games = oddsRes.data;
    let edges = [];

    for (let game of games.slice(0, 3)) {
      for (let book of game.bookmakers || []) {
        for (let market of book.markets || []) {
          for (let outcome of market.outcomes || []) {

            const playerName = outcome.description;
            const line = outcome.point;
            const americanOdds = outcome.price;

            if (!playerName || !line || !americanOdds) continue;

            // Player search
            const searchRes = await axios.get(
              "https://api.balldontlie.io/v1/players",
              {
                params: { search: playerName },
                headers: {
                  Authorization: BALLDONTLIE_API_KEY
                }
              }
            );

            if (!searchRes.data.data.length) continue;

            const playerId = searchRes.data.data[0].id;

            // Last 10 games
            const historyRes = await axios.get(
              "https://api.balldontlie.io/v1/stats",
              {
                params: {
                  player_ids: [playerId],
                  per_page: 10
                },
                headers: {
                  Authorization: BALLDONTLIE_API_KEY
                }
              }
            );

            const history = historyRes.data.data;
            if (!history.length) continue;

            const points = history.map(g => g.pts || 0);

            const avg =
              points.reduce((a, b) => a + b, 0) /
              points.length;

            const hits =
              points.filter(p => p > line).length;

            const probability = hits / points.length;

            const evData = calculateEV(probability, americanOdds);

            edges.push({
              player: playerName,
              stat: "Points",
              line,
              direction: outcome.name,
              probability: Math.round(probability * 100),
              vegasOdds: americanOdds,
              impliedProbability: evData.impliedProbability,
              expectedValue: evData.expectedValue
            });
          }
        }
      }
    }

    edges.sort((a, b) => b.expectedValue - a.expectedValue);

    res.json({
      bestThree: edges.slice(0, 3),
      players: edges
    });

  } catch (err) {
    console.error("Odds engine error:", err.response?.data || err.message);
    res.status(500).json({ error: "Odds engine failed" });
  }
});

/* =================================================
   SPORTRADAR SCHEDULE
================================================= */

app.get("/api/nba/schedule/:year/:month/:day", async (req, res) => {
  try {
    if (!SPORTRADAR_API_KEY) {
      return res.status(500).json({
        error: "Missing SPORTRADAR_API_KEY"
      });
    }

    const { year, month, day } = req.params;

    const response = await axios.get(
      `https://api.sportradar.com/nba/trial/v8/en/games/${year}/${month}/${day}/schedule.json`,
      {
        params: {
          api_key: SPORTRADAR_API_KEY
        }
      }
    );

    res.json(response.data);

  } catch (err) {
    console.error("Sportradar error:", err.response?.data || err.message);
    res.status(500).json({ error: "Sportradar failed" });
  }
});

/* =================================================
   SPORTRADAR PLAYER PROFILE
================================================= */

app.get("/api/nba/player/:playerId", async (req, res) => {
  try {
    if (!SPORTRADAR_API_KEY) {
      return res.status(500).json({
        error: "Missing SPORTRADAR_API_KEY"
      });
    }

    const { playerId } = req.params;

    const response = await axios.get(
      `https://api.sportradar.com/nba/trial/v8/en/players/${playerId}/profile.json`,
      {
        params: {
          api_key: SPORTRADAR_API_KEY
        }
      }
    );

    res.json(response.data);

  } catch (err) {
    console.error("Player fetch error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Player fetch failed",
      details: err.response?.data || err.message
    });
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
