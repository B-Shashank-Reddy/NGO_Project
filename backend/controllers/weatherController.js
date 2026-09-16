const { Event } = require("../models");
const { getEventWeather } = require("../services/weatherService");

exports.getEventWeather = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.eventId);

    if (!event || !event.isActive) {
      return res.status(404).json({ message: "Active event not found" });
    }

    const weather = await getEventWeather({
      eventId: event.id,
      latitude: event.latitude,
      longitude: event.longitude,
      eventDate: event.eventDate,
    });

    res.status(200).json({
      ...weather,
      locationLabel: event.locationLabel || event.place,
    });
  } catch (error) {
    if (error.code === "MISSING_COORDINATES" || error.code === "FORECAST_UNAVAILABLE") {
      return res.status(422).json({ message: error.message });
    }

    res.status(502).json({ message: "Weather provider is temporarily unavailable" });
  }
};