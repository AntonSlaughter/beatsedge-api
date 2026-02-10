// mockStats.js

const playerGameLogs = {
  "Paolo Banchero": {
    team: "ORL",
    games: [
      { points: 28, rebounds: 8, assists: 6 },
      { points: 24, rebounds: 7, assists: 5 },
      { points: 19, rebounds: 6, assists: 4 },
      { points: 31, rebounds: 9, assists: 7 },
      { points: 26, rebounds: 8, assists: 6 }
    ]
  },

  "Luka Doncic": {
    team: "DAL",
    games: [
      { points: 35, rebounds: 9, assists: 10 },
      { points: 42, rebounds: 11, assists: 8 },
      { points: 29, rebounds: 8, assists: 9 },
      { points: 38, rebounds: 10, assists: 11 },
      { points: 33, rebounds: 7, assists: 8 }
    ]
  }
};

module.exports = {
  playerGameLogs
};
