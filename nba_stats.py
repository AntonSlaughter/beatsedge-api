import sys
import json
from nba_api.stats.endpoints import playergamelog
from nba_api.stats.static import players

# -------------------------
# Read command-line args
# -------------------------
player_name = sys.argv[1]
game_count = int(sys.argv[2])

# -------------------------
# Resolve NBA player ID
# -------------------------
def get_player_id(name):
    all_players = players.get_players()
    name_lower = name.lower().replace('.', '').replace("'", "")

    # Exact match
    for p in all_players:
        if p['full_name'].lower() == name.lower():
            return p['id']

    # Fuzzy fallback (handles accents, Jr, III, etc.)
    for p in all_players:
        candidate = p['full_name'].lower().replace('.', '').replace("'", "")
        if name_lower in candidate or candidate in name_lower:
            return p['id']

    return None

player_id = get_player_id(player_name)

if not player_id:
    # IMPORTANT: Return valid JSON so Node does not crash
    print(json.dumps([]))
    sys.exit(0)

# -------------------------
# Fetch game logs
# -------------------------
try:
    gamelog = playergamelog.PlayerGameLog(
        player_id=player_id,
        season='2024-25'
    )

    df = gamelog.get_data_frames()[0].head(game_count)
except Exception:
    print(json.dumps([]))
    sys.exit(0)

# -------------------------
# Normalize output
# -------------------------
games = []

for _, row in df.iterrows():
    matchup = row["MATCHUP"]

    games.append({
        "date": row["GAME_DATE"],
        "matchup": matchup,
        "isHome": "vs." in matchup,
        "points": int(row["PTS"]),
        "rebounds": int(row["REB"]),
        "assists": int(row["AST"]),
        "minutes": int(row["MIN"])
    })

# -------------------------
# Output JSON for Node
# -------------------------
print(json.dumps(games))
