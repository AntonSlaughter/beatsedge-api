/**************************************************
 * BeatsEdge - Sportradar Only Build (Clean)
 **************************************************/

require("dotenv").config();

const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();

/* ================================================
   ENVIRONMENT
================================================ */

const PORT = process.env.PORT || 3000;
const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;

if (!SPORTRADAR_API_KEY) {
  console.warn("⚠️ SPORTRADAR_API_KEY is missing in Railway variables");
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ================================================
   BASE URL (TRIAL VERSION ONLY)
================================================ */

const SR_BASE = "https://api.sportradar.com/nba/trial/v8/en";

/* ================================================
   HEALTH CHECK
================================================ */

app.get("/api/health", (req, res) => {
  res.json({ status: "BeatsEdge API live" });
});

/* ================================================
   NBA SCHEDULE
   /api/nba/schedule/2026/02/19
================================================ */

app.get("/api/nba/schedule/:year/:month/:day", async (req, res) => {
  try {
    const { year, month, day } = req.params;

    const response = await axios.get(
      `${SR_BASE}/games/${year}/${month}/${day}/schedule.json`,
      {
        params: { api_key: SPORTRADAR_API_KEY }
      }
    );

    res.json(response.data);

  } catch (err) {
    console.error("Schedule error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Schedule fetch failed",
      details: err.response?.data || err.message
    });
  }
});

/* ================================================
   TEAM ROSTER (GET PLAYER UUIDS)
   /api/nba/team/{teamId}/roster
================================================ */

app.get("/api/nba/team/:teamId/roster", async (req, res) => {
  try {
    const { teamId } = req.params;

    const response = await axios.get(
      `${SR_BASE}/teams/${teamId}/profile.json`,
      {
        params: { api_key: SPORTRADAR_API_KEY }
      }
    );

    res.json(response.data.players);

  } catch (err) {
    console.error("Roster error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Roster fetch failed",
      details: err.response?.data || err.message
    });
  }
});

/* ================================================
   PLAYER PROFILE (UUID REQUIRED)
   /api/nba/player/{playerId}
================================================ */

app.get("/api/nba/player/:playerId", async (req, res) => {
  try {
    const { playerId } = req.params;

    const response = await axios.get(
      `${SR_BASE}/players/${playerId}/profile.json`,
      {
        params: { api_key: SPORTRADAR_API_KEY }
      }
    );

    res.json(response.data);

  } catch (err) {
    console.error("Player profile error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Player fetch failed",
      details: err.response?.data || err.message
    });
  }
});

/* ================================================
   PLAYER GAME LOGS (SEASON STATS)
   /api/nba/player/{playerId}/gamelogs/2025/REG
================================================ */

app.get("/api/nba/player/:playerId/gamelogs/:season/:type", async (req, res) => {
  try {
    const { playerId, season, type } = req.params;

    const response = await axios.get(
      `${SR_BASE}/players/${playerId}/profile.json`,
      {
        params: { api_key: SPORTRADAR_API_KEY }
      }
    );

    // Trial API does not include separate gamelog endpoint,
    // game logs are inside player profile under seasons

    const seasons = response.data.seasons || [];

    const seasonData = seasons.find(
      s => s.year == season && s.type.toLowerCase() === type.toLowerCase()
    );

    if (!seasonData) {
      return res.status(404).json({
        error: "Season data not found"
      });
    }

    res.json(seasonData);

  } catch (err) {
    console.error("Gamelog error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Game log fetch failed",
      details: err.response?.data || err.message
    });
  }
});

/* ================================================
   START SERVER
================================================ */

app.listen(PORT, () => {
  console.log(`🚀 BeatsEdge running on port ${PORT}`);
});
