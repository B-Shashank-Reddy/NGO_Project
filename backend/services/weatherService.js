const weatherCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

const weatherConditions = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Light rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

const getDateKey = (eventDate) => new Date(eventDate).toISOString().slice(0, 10);

const getEventWeather = async ({ eventId, latitude, longitude, eventDate }) => {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    const error = new Error("Weather requires event coordinates");
    error.code = "MISSING_COORDINATES";
    throw error;
  }

  const date = getDateKey(eventDate);
  const cacheKey = `${eventId}:${date}`;
  const cached = weatherCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, cached: true };
  }

  const url = new URL(process.env.WEATHER_API_URL || "https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", parsedLatitude);
  url.searchParams.set("longitude", parsedLongitude);
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max");
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);

  const response = await fetch(url);
  const providerData = await response.json();

  if (!response.ok || !providerData.daily?.time?.length) {
    const error = new Error("Weather forecast is unavailable for this event date");
    error.code = "FORECAST_UNAVAILABLE";
    throw error;
  }

  const weatherCode = providerData.daily.weather_code[0];
  const data = {
    eventId: Number(eventId),
    forecastDate: providerData.daily.time[0],
    temperature: {
      min: providerData.daily.temperature_2m_min[0],
      max: providerData.daily.temperature_2m_max[0],
      unit: providerData.daily_units?.temperature_2m_max || "°C",
    },
    rainProbability: providerData.daily.precipitation_probability_max[0],
    windSpeed: providerData.daily.wind_speed_10m_max[0],
    windUnit: providerData.daily_units?.wind_speed_10m_max || "km/h",
    weatherCode,
    condition: weatherConditions[weatherCode] || "Unknown conditions",
    source: "open-meteo",
    fetchedAt: new Date().toISOString(),
    cached: false,
  };

  weatherCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
};

const clearWeatherCache = () => weatherCache.clear();

module.exports = { getEventWeather, clearWeatherCache };