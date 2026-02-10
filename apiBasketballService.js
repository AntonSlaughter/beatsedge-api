const axios = require('axios');

const API_BASE = 'https://v1.basketball.api-sports.io';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'x-apisports-key': process.env.API_BASKETBALL_KEY
  }
});

/**
 * Get NBA games by date
 */
async function getNBAGames(date) {
  const response = await api.get('/games', {
    params: {
      league: 12, // NBA
      season: 2024,
      date
    }
  });

  return response.data.response;
}

/**
 * Get player season averages
 */
async function getPlayerStats(playerId) {
  const response = await api.get('/players/statistics', {
    params: {
      player: playerId,
      season: 2024,
      league: 12
    }
  });

  return response.data.response;
}

module.exports = {
  getNBAGames,
  getPlayerStats
};
