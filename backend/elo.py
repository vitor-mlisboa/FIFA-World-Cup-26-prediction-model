import json

FIFA_POINTS = {
    "France": 1877, "Spain": 1876, "Argentina": 1875, "England": 1826,
    "Portugal": 1764, "Brazil": 1761, "Netherlands": 1758, "Morocco": 1756,
    "Belgium": 1735, "Germany": 1730, "Croatia": 1710, "Italy": 1700,
    "Colombia": 1680, "United States": 1660, "Mexico": 1640, "Uruguay": 1620,
    "Switzerland": 1600, "Japan": 1590, "Senegal": 1570, "Iran": 1550,
    "Denmark": 1540, "South Korea": 1530, "Ecuador": 1510, "Austria": 1500,
    "Turkey": 1490, "Australia": 1470, "Canada": 1460, "Ukraine": 1450,
    "Norway": 1440, "Panama": 1420, "Algeria": 1390, "Egypt": 1380,
    "Scotland": 1370, "Paraguay": 1350, "Tunisia": 1330, "Ivory Coast": 1320,
    "Czech Republic": 1300, "Uzbekistan": 1270, "Qatar": 1250,
    "Saudi Arabia": 1220, "South Africa": 1210, "Jordan": 1200,
    "Cape Verde": 1190, "Ghana": 1180, "Bosnia and Herzegovina": 1160,
    "DR Congo": 1140, "Iraq": 1120, "Curacao": 1150,
    "Haiti": 1130, "New Zealand": 1110,
}

with open("data/elo_ratings.json", "w") as f:
    json.dump(FIFA_POINTS, f, indent=2)

ratings = dict(sorted(FIFA_POINTS.items(), key=lambda x: x[1], reverse=True))
print(f"Ratings definidos para {len(ratings)} seleções")
print("\nTop 15:")
for i, (team, rating) in enumerate(list(ratings.items())[:15], 1):
    print(f"{i:2}. {team:<25} {rating}")