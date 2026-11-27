"""
test_weather_api.py - Small connection test for the Open-Meteo Forecast API.
Retrieves daily rainfall forecasts (precipitation_sum) for Hyderabad
without modifying any dataset or model files.
"""

import requests

# 1. Open-Meteo forecast endpoint URL
API_URL = "https://api.open-meteo.com/v1/forecast"

# 2. Query parameters: Hyderabad coordinates + daily rainfall
params = {
    "latitude": 17.385,
    "longitude": 78.4867,
    "daily": "precipitation_sum",
    "timezone": "auto",  # Align dates to the site's local timezone
}

print("=" * 60)
print("   AI Bridge X – Open-Meteo API Connection Test")
print("=" * 60)
print(f"Connecting to: {API_URL}")
print(f"Coordinates  : lat={params['latitude']}, lon={params['longitude']}")

try:
    # 3. Send GET request with a 10-second timeout
    response = requests.get(API_URL, params=params, timeout=10)
    print(f"HTTP Status  : {response.status_code}")

    # 4. Raise an error automatically if status is 4xx or 5xx (invalid request/server error)
    response.raise_for_status()

    # 5. Convert JSON reply into a Python dictionary
    data = response.json()

    # 6. Inspect top-level JSON structure
    print(f"JSON Keys    : {list(data.keys())}")

    if "daily" not in data:
        raise ValueError("Unexpected API response: 'daily' section missing.")

    daily = data["daily"]
    dates = daily.get("time", [])
    rainfall_list = daily.get("precipitation_sum", [])
    unit = data.get("daily_units", {}).get("precipitation_sum", "mm")

    print(f"Timezone     : {data.get('timezone')}")
    print(f"Days Returned: {len(dates)}")
    print("\nDaily Rainfall Forecast:")
    print("-" * 35)
    for day, rain_mm in zip(dates, rainfall_list):
        print(f"  {day} : {rain_mm} {unit}")
    print("-" * 35)

except requests.exceptions.Timeout:
    print("Connection Error: Open-Meteo took too long to respond (timeout).")
except requests.exceptions.ConnectionError:
    print("Connection Error: Could not reach Open-Meteo. Check your internet connection.")
except requests.exceptions.HTTPError as http_err:
    print(f"Invalid API Response (HTTP Error): {http_err}")
except ValueError as val_err:
    print(f"Invalid Data Error: {val_err}")
