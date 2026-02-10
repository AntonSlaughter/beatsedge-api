import sys
import json
from datetime import datetime
from nba_api.stats.endpoints import playergamelog
from nba_api.stats.static import players

# -------------------------
# Validate args
# -------------------------
if len(sys.argv) < 3:
    print(json.dumps([]))
    sys.exit(0)

player_name = sys.argv[1]
game_count = int(sys.argv[2])

# -------------------------
# Auto NBA season resolver
# -------------------------
now = datetime.now()
year = now.year

# NBA season switches in October
if now.month >= 10:
    season = f"{year}-{str(year + 1)[-2:]}"
else:
    season = f"{year - 1}-{str(year)[-2:]}"

# -------------------------
# Resolve NBA player ID
# -------------------------
def resolve_player_id(name):
    all_players = players.get_players()
    target = name.lower().replace('.', '').replace("'", "")

    # Exact match first
    for p in all_players:
        if p["full_name"].lower() == name.lower():
            return p["id"]

    # Fuzzy fallback
    for p in all_players:
        candidate = p["full_name"].lower().replace('.', '').replace("'", "")
        if target in candidate or candidate in target:
            return p["id"]

    return None

player_id = resolve_player_id(player_name)

if not player_id:
    print(json.dumps([]))
    sys.exit(0)

# -------------------------
# Fetch game logs
# -------------------------
try:
    gamelog = playergamelog.PlayerGameLog(
        player_id=player_id,
        season=season
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
    matchup = row.get("MATCHUP", "")

    games.append({
        "date": row.get("GAME_DATE"),
        "matchup": matchup,
        "isHome": "vs." in matchup,
        "points": int(row.get("PTS", 0)),
        "rebounds": int(row.get("REB", 0)),
        "assists": int(row.get("AST", 0)),
        "minutes": int(row.get("MIN", 0))
    })

# -------------------------
# Output JSON for Node
# -------------------------
print(json.dumps(games))
