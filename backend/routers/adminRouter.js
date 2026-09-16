const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/authMiddleware");
const {
  getDashboardStats,
  getAllOrganizers,
  getAllVolunteers,
  getAllEvents,
  getAllRegistrations,
  updateOrganizerStatus,
  updateVolunteerStatus,
  createAdmin,
  loginAdmin,
} = require("../controllers/adminController");

router.post("/create-admin", createAdmin);
router.post("/login", loginAdmin);
router.get("/dashboard", verifyToken, requireRole("admin"), getDashboardStats);
router.get("/organizers", verifyToken, requireRole("admin"), getAllOrganizers);
router.get("/volunteers", verifyToken, requireRole("admin"), getAllVolunteers);
router.get("/events", verifyToken, requireRole("admin"), getAllEvents);
router.get("/registrations", verifyToken, requireRole("admin"), getAllRegistrations);
router.patch("/organizers/:id/status", verifyToken, requireRole("admin"), updateOrganizerStatus);
router.patch("/volunteers/:id/status", verifyToken, requireRole("admin"), updateVolunteerStatus);

module.exports = router;
