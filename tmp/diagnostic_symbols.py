import requests
import json

try:
    response = requests.get("http://127.0.0.1:5555/symbols", timeout=5)
    if response.status_code == 200:
        symbols = response.json()
        print(f"TOTAL_SYMBOLS: {len(symbols)}")
        nasdaq_like = [s for s in symbols if "100" in s or "NAS" in s or "USTEC" in s or "US" in s]
        print(f"NASDAQ_CANDIDATES: {nasdaq_like}")
        with open("C:/Windows/Temp/diagnostic_full_symbols.json", "w") as f:
            json.dump(symbols, f, indent=2)
    else:
        print(f"ERROR: Bridge returned status {response.status_code}")
except Exception as e:
    print(f"CRITICAL_ERROR: {str(e)}")
