const { searchLocations } = require("../services/locationService");

exports.search = async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (query.length < 3) {
      return res.status(400).json({ message: "Search query must contain at least 3 characters" });
    }

    const locations = await searchLocations(query);
    res.status(200).json({ locations });
  } catch (error) {
    res.status(502).json({ message: error.message || "Location search failed" });
  }
};