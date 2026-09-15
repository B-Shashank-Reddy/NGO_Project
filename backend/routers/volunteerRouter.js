const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/authMiddleware");
const {
  createVolunteer,
  loginVolunteer,
  getAllEvents,
  getEventDetails,
  registerVolunteerForTask,
  unregisterVolunteerFromTask,
  getVolunteerRegistrations,
} = require("../controllers/volunteerController");

router.post("/create-volunteer", createVolunteer);
router.post("/login", loginVolunteer);
router.get("/events", verifyToken, requireRole("volunteer"), getAllEvents);
router.get("/events/:eventId", verifyToken, requireRole("volunteer"), getEventDetails);
router.post("/events/register-task", verifyToken, requireRole("volunteer"), registerVolunteerForTask);
router.delete("/events/tasks/:taskId/registration", verifyToken, requireRole("volunteer"), unregisterVolunteerFromTask);
router.get("/registrations/:volunteerId", verifyToken, requireRole("volunteer"), getVolunteerRegistrations);

module.exports = router;