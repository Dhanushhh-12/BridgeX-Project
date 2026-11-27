"""
weather.py - Reusable Open-Meteo weather integration module for AI Bridge X.
Fetches daily rainfall forecasts by latitude and longitude and counts rainy
days that could impact outdoor bridge construction schedules.
"""

import requests

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def get_rainfall_forecast(
    latitude: float,
    longitude: float,
    days: int = 7,
) -> tuple[list[str], list[float]]:
    """
    Fetch daily rainfall totals (precipitation_sum in mm) from Open-Meteo.

    Args:
        latitude: Site latitude (-90 to 90).
        longitude: Site longitude (-180 to 180).
        days: Number of forecast days to request (1 to 16).

    Returns:
        A tuple of (dates, rainfall_amounts), where dates is a list of
        'YYYY-MM-DD' strings and rainfall_amounts is a list of floats in mm.
    """
    if not (-90 <= latitude <= 90):
        raise ValueError(f"Invalid latitude {latitude}: must be between -90 and 90.")
    if not (-180 <= longitude <= 180):
        raise ValueError(f"Invalid longitude {longitude}: must be between -180 and 180.")
    if not (1 <= days <= 16):
        raise ValueError(f"Invalid days={days}: Open-Meteo supports 1 to 16 forecast days.")

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "precipitation_sum",
        "forecast_days": days,
        "timezone": "auto",
    }

    try:
        response = requests.get(OPEN_METEO_FORECAST_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.Timeout as exc:
        raise RuntimeError(
            "Connection timed out while contacting Open-Meteo. Please try again."
        ) from exc
    except requests.exceptions.ConnectionError as exc:
        raise RuntimeError(
            "Could not connect to Open-Meteo. Check your internet connection."
        ) from exc
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        raise RuntimeError(
            f"Open-Meteo returned an HTTP error (status {status}): {exc}"
        ) from exc
    except ValueError as exc:
        raise RuntimeError("Open-Meteo returned invalid JSON data.") from exc

    # Verify expected keys exist in the JSON response
    if "daily" not in data or not isinstance(data["daily"], dict):
        raise RuntimeError("Unexpected API response: missing 'daily' weather section.")

    daily = data["daily"]
    dates = daily.get("time")
    raw_rainfall = daily.get("precipitation_sum")

    if not isinstance(dates, list) or not isinstance(raw_rainfall, list):
        raise RuntimeError(
            "Unexpected API response: missing 'time' or 'precipitation_sum' lists."
        )
    if len(dates) == 0 or len(dates) != len(raw_rainfall):
        raise RuntimeError(
            "Unexpected API response: date and rainfall counts are empty or mismatched."
        )

    # Convert values cleanly to floats (treat occasional API None values as 0.0 mm)
    rainfall_amounts = [0.0 if val is None else float(val) for val in raw_rainfall]
    return dates, rainfall_amounts


def count_rainy_days(rainfall_data: list[float], threshold_mm: float = 5) -> int:
    """
    Count how many days have rainfall greater than or equal to threshold_mm.

    Args:
        rainfall_data: List of daily rainfall measurements in millimeters (mm).
        threshold_mm: Minimum rainfall in mm to count as a rainy day (default: 5).

    Returns:
        Integer count of rainy days.
    """
    if threshold_mm < 0:
        raise ValueError("threshold_mm cannot be negative.")

    rainy_count = 0
    for amount in rainfall_data:
        if amount is not None and float(amount) >= threshold_mm:
            rainy_count += 1
    return rainy_count


if __name__ == "__main__":
    # Simple test using Hyderabad coordinates
    HYD_LAT = 17.385
    HYD_LON = 78.4867
    FORECAST_DAYS = 7
    RAIN_THRESHOLD_MM = 5

    print("=" * 60)
    print("   AI Bridge X – Open-Meteo Weather Forecast Test")
    print("=" * 60)
    print(f"Location : Hyderabad (lat={HYD_LAT}, lon={HYD_LON})")
    print(f"Window   : Next {FORECAST_DAYS} days | Rainy threshold >= {RAIN_THRESHOLD_MM} mm")

    try:
        forecast_dates, forecast_rain = get_rainfall_forecast(
            latitude=HYD_LAT,
            longitude=HYD_LON,
            days=FORECAST_DAYS,
        )
        rainy_days = count_rainy_days(forecast_rain, threshold_mm=RAIN_THRESHOLD_MM)

        print("\nDaily Rainfall Forecast:")
        print("-" * 35)
        for day, rain_mm in zip(forecast_dates, forecast_rain):
            tag = "  [RAINY DAY]" if rain_mm >= RAIN_THRESHOLD_MM else ""
            print(f"  {day} : {rain_mm:.1f} mm{tag}")
        print("-" * 35)
        print(f"Total Rainy Days (>= {RAIN_THRESHOLD_MM} mm): {rainy_days} out of {len(forecast_dates)}")
        print("=" * 60)
    except (ValueError, RuntimeError) as error:
        print(f"\nWeather Fetch Error: {error}")
