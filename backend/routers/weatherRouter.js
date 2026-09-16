const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getEventWeather } = require("../controllers/weatherController");

router.get("/:eventId/weather", verifyToken, getEventWeather);

module.exports = router;