import sys
from nba_api.stats.static import players

name = sys.argv[1].lower()

matches = players.find_players_by_full_name(name)

if not matches:
    print("")
else:
    print(matches[0]["id"])
