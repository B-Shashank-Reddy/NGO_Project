const test = require("node:test");
const assert = require("node:assert/strict");
const { getEventWeather, clearWeatherCache } = require("../services/weatherService");

test("weather service normalizes provider data and reuses the cache", async () => {
  const originalFetch = global.fetch;
  let fetchCount = 0;

  global.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({
        daily: {
          time: ["2026-10-01"],
          weather_code: [2],
          temperature_2m_min: [21],
          temperature_2m_max: [29],
          precipitation_probability_max: [20],
          wind_speed_10m_max: [12],
        },
        daily_units: {
          temperature_2m_max: "°C",
          wind_speed_10m_max: "km/h",
        },
      }),
    };
  };

  try {
    clearWeatherCache();
    const first = await getEventWeather({
      eventId: 101,
      latitude: 18.52,
      longitude: 73.85,
      eventDate: "2026-10-01",
    });
    const second = await getEventWeather({
      eventId: 101,
      latitude: 18.52,
      longitude: 73.85,
      eventDate: "2026-10-01",
    });

    assert.equal(first.condition, "Partly cloudy");
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(fetchCount, 1);
  } finally {
    global.fetch = originalFetch;
    clearWeatherCache();
  }
});

test("weather service rejects events without coordinates", async () => {
  await assert.rejects(
    () => getEventWeather({ eventId: 102, eventDate: "2026-10-01" }),
    { code: "MISSING_COORDINATES" },
  );
});
