import sys
from nba_api.stats.endpoints import playergamelog

# -------------------------
# Read command-line args
# -------------------------
player_id = sys.argv[1]
game_count = int(sys.argv[2])

# -------------------------
# Fetch game logs
# -------------------------
gamelog = playergamelog.PlayerGameLog(
    player_id=player_id,
    season='2024-25'
)

df = gamelog.get_data_frames()[0].head(game_count)

games = []

for _, row in df.iterrows():
    game_date = row["GAME_DATE"]
    matchup = row["MATCHUP"]

    games.append({
        "date": game_date,
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
import json
print(json.dumps(games))
