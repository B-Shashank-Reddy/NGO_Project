const resolveLocation = async ({ locationLabel, latitude, longitude }) => {
  if (!locationLabel || typeof locationLabel !== "string" || !locationLabel.trim()) {
    throw new Error("Location is required");
  }

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (Number.isFinite(parsedLatitude) && parsedLatitude >= -90 && parsedLatitude <= 90
    && Number.isFinite(parsedLongitude) && parsedLongitude >= -180 && parsedLongitude <= 180) {
    return {
      locationLabel: locationLabel.trim(),
      latitude: parsedLatitude,
      longitude: parsedLongitude,
    };
  }

  if (process.env.GOOGLE_MAPS_API_KEY) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", locationLabel.trim());
    url.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY);
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status !== "OK" || !data.results?.[0]) {
      throw new Error("Unable to resolve the provided location");
    }

    const location = data.results[0].geometry.location;
    return {
      locationLabel: data.results[0].formatted_address,
      latitude: location.lat,
      longitude: location.lng,
    };
  }

  const suggestions = await searchLocations(locationLabel);
  if (!suggestions.length) {
    throw new Error("Unable to resolve the provided location");
  }

  return suggestions[0];
};

const searchLocations = async (query) => {
  if (!query || typeof query !== "string" || query.trim().length < 3) {
    return [];
  }

  const url = new URL(process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": process.env.LOCATION_USER_AGENT || "ngo-platform/1.0 (local development)",
      Accept: "application/json",
    },
  });
  const data = await response.json();

  if (!response.ok || !Array.isArray(data)) {
    throw new Error("Location search provider is unavailable");
  }

  return data.map((item) => ({
    locationLabel: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  }));
};

module.exports = { resolveLocation, searchLocations };