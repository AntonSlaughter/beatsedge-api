// hitRateEngine.js
// Builds Last-10 hit rate vs PrizePicks line using API-Basketball

import fetch from 'node-fetch';

const API_KEY = process.env.API_BASKETBALL_KEY;
const BASE_URL = 'https://v1.basketball.api-sports.io';

const STAT_MAP = {
  POINTS: 'points',
  REBOUNDS: 'rebounds',
  ASSISTS: 'assists'
};

export async function getL10HitRate(playerId, stat, line) {
  const apiStat = STAT_MAP[stat];
  if (!apiStat) return null;

  const res = await fetch(
    `${BASE_URL}/players/statistics?season=2023&player=${playerId}&league=12`,
    {
      headers: { 'x-apisports-key': API_KEY }
    }
  );

  const data = await res.json();
  const games = data.response?.slice(0, 10) || [];

  if (!games.length) return null;

  let hits = 0;
  const sample = [];

  for (const g of games) {
    const val = g[apiStat];
    if (typeof val === 'number') {
      sample.push(val);
      if (val > line) hits++;
    }
  }

  return {
    L10: Math.round((hits / sample.length) * 100),
    sample
  };
}
