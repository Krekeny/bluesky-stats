import requests
import json

URL = "https://bsky-search.jazco.io/stats"
SAVE_PATH = "docs/data/stats.json"

def fetch_and_save():
    response = requests.get(URL)
    if response.status_code == 200:
        with open(SAVE_PATH, "w") as f:
            f.write(response.text)
        print("Data saved successfully.")
    else:
        print(f"Failed to fetch data: {response.status_code}")

if __name__ == "__main__":
    fetch_and_save()