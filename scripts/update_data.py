import requests
import json
import os
from datetime import date

URL = "https://bsky-search.jazco.io/stats"
SAVE_PATH = "docs/data/stats.json"

def load_existing():
    if not os.path.exists(SAVE_PATH):
        return []
    with open(SAVE_PATH, "r") as f:
        data = json.load(f)
        if isinstance(data, dict) and "daily_data" in data:
            return data["daily_data"]
        return data

def fetch_today_entry():
    response = requests.get(URL)
    if response.status_code != 200:
        print("Failed to fetch data")
        return None
    raw = response.json()
    today_str = str(date.today())
    if "total_users" not in raw:
        print("No total_users in response")
        return None
    return {"date": today_str, "total_users": raw["total_users"]}

def save_combined(data):
    with open(SAVE_PATH, "w") as f:
        json.dump(data, f, indent=2)

def main():
    existing = load_existing()
    today_entry = fetch_today_entry()
    if not today_entry:
        return
    if any(e["date"] == today_entry["date"] for e in existing):
        print("Today's data already exists")
        return
    existing.append(today_entry)
    existing.sort(key=lambda x: x["date"])
    save_combined(existing)

if __name__ == "__main__":
    main()