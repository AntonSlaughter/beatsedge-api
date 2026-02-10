require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const ODDS_API_KEY = process.env.ODDS_API_KEY;
if (!ODDS_API_KEY) {
  throw new Error('❌ ODDS_API_KEY missing');
}

const PLAYER_MAP_PATH = path.join(__dirname, 'playerMap.json');
const NBA_CACHE_PATH = path.join(__dirname, 'nbaPlayerDirectory.json');
/* =========================
   HELPERS
========================= */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* =========================
   LOAD EXISTING MAP
========================= */
let playerMap = {};
if (fs.existsSync(PLAYER_MAP_PATH)) {
  playerMap = JSON.parse(fs.readFileSync(PLAYER_MAP_PATH, 'utf8'));
}

/* =========================
   FETCH TODAY PLAYER NAMES
========================= */
async function fetchTodayPlayerNames() {
  const today = new Date().toISOString().split('T')[0];
  const names = new Set();

  const eventsRes = await axios.get(
    'https://api.the-odds-api.com/v4/sports/basketball_nba/events',
    {
      params: {
        apiKey: ODDS_API_KEY,
        dateFrom: today,
        dateTo: today
      }
    }
  );

  for (const game of eventsRes.data) {
    try {
      const oddsRes = await axios.get(
        `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${game.id}/odds`,
        {
          params: {
            apiKey: ODDS_API_KEY,
            regions: 'us',
            markets:
              'player_points,player_rebounds,player_assists,player_threes'
          }
        }
      );

      oddsRes.data.bookmakers?.forEach(bm =>
        bm.markets?.forEach(mkt =>
          mkt.outcomes?.forEach(o => {
            if (o.description) {
              names.add(o.description.trim());
            }
          })
        )
      );
    } catch (err) {
      console.log(`⚠️ Odds fetch failed for event ${game.id}`);
      continue;
    }
  }

  return [...names];
}

/* =========================
   FETCH NBA PLAYER DIRECTORY (ONCE)
========================= */
async function fetchNBADirectory() {
  if (fs.existsSync(NBA_CACHE_PATH)) {
    console.log('📦 Using cached NBA player directory');
    return JSON.parse(fs.readFileSync(NBA_CACHE_PATH, 'utf8'));
  }

  console.log('🌐 Fetching NBA player directory (one-time)...');

  const url = 'https://stats.nba.com/stats/commonallplayers';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.nba.com/',
          'Origin': 'https://www.nba.com'
        },
        params: {
          IsOnlyCurrentSeason: 1,
          LeagueID: '00',
          Season: '2025-26'
        }
      });

      const rows = res.data.resultSets[0].rowSet;
      const directory = {};

      for (const row of rows) {
        const id = row[0];
        const fullName = row[2];
        directory[normalizeName(fullName)] = id;
      }

      fs.writeFileSync(
        NBA_CACHE_PATH,
        JSON.stringify(directory, null, 2)
      );

      console.log(`✅ Cached ${Object.keys(directory).length} NBA players`);
      return directory;

    } catch (err) {
      console.log(`⚠️ NBA directory fetch failed (attempt ${attempt})`);
      if (attempt === 3) {
        throw new Error('❌ NBA Stats blocked all attempts');
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}


/* =========================
   MAIN
========================= */
(async () => {
  console.log('🔍 Scanning props for players...');

  const names = await fetchTodayPlayerNames();
  console.log(`📦 Found ${names.length} unique player names`);

  console.log('📚 Fetching NBA player directory...');
  const nbaDirectory = await fetchNBADirectory();

  let added = 0;
  let checked = 0;

  for (const rawName of names) {
    checked++;
    console.log(`🔎 [${checked}/${names.length}] Resolving: ${rawName}`);

    if (playerMap[rawName]) {
      console.log('⏭️ Already exists');
      continue;
    }

    const normalized = normalizeName(rawName);
    const playerId = nbaDirectory[normalized];

    if (!playerId) {
      console.log('❌ No NBA match');
      continue;
    }

    playerMap[rawName] = playerId;
    added++;
    console.log(`✅ ${rawName} → ${playerId}`);
  }

  fs.writeFileSync(
    PLAYER_MAP_PATH,
    JSON.stringify(playerMap, null, 2)
  );

  console.log(`🎯 Player map updated: +${added} players`);
})();
