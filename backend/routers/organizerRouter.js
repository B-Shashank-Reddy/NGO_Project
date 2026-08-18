const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/authMiddleware");
const {
  createOrganizer,
  loginOrganizer,
  getAllOrganizers,
  createEvent,
  getOrganizerEvents,
  createTaskForEvent,
  getEventTasks,
} = require("../controllers/organizerController");

router.post("/create-organizer", createOrganizer);
router.post("/login", loginOrganizer);
router.get("/all", verifyToken, requireRole("admin"), getAllOrganizers);
router.post("/events/create", verifyToken, requireRole("organizer"), createEvent);
router.get("/events/:organizerId", verifyToken, requireRole("organizer"), getOrganizerEvents);
router.post("/events/:eventId/tasks", verifyToken, requireRole("organizer"), createTaskForEvent);
router.get("/events/:eventId/tasks", verifyToken, requireRole("organizer"), getEventTasks);

module.exports = router;