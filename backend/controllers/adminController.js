const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Admin, Organizer, Volunteer, Event, Task, VolunteerTaskRegistration } = require("../models");

const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || "supersecret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "3h",
  });
};

exports.getDashboardStats = async (req, res) => {
  try {
    const [organizerCount, volunteerCount, eventCount, taskCount] = await Promise.all([
      Organizer.count(),
      Volunteer.count(),
      Event.count(),
      Task.count(),
    ]);

    res.status(200).json({
      organizerCount,
      volunteerCount,
      eventCount,
      taskCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Dashboard stats failed", error: error.message });
  }
};

exports.getAllOrganizers = async (req, res) => {
  try {
    const organizers = await Organizer.findAll({ attributes: { exclude: ["password"] } });
    res.status(200).json(organizers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch organizers", error: error.message });
  }
};

exports.getAllVolunteers = async (req, res) => {
  try {
    const volunteers = await Volunteer.findAll({ attributes: { exclude: ["password"] } });
    res.status(200).json(volunteers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch volunteers", error: error.message });
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    const events = await Event.findAll({
      include: [{ association: "tasks" }],
    });
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch events", error: error.message });
  }
};

exports.getAllRegistrations = async (req, res) => {
  try {
    const registrations = await VolunteerTaskRegistration.findAll({
      include: [
        { association: "volunteer", attributes: { exclude: ["password"] } },
        { association: "task" },
      ],
    });
    res.status(200).json(registrations);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch registrations", error: error.message });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({ name, email, password: hashedPassword });
    res.status(201).json({ message: "Admin created", admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (error) {
    res.status(400).json({ message: "Failed to create admin", error: error.message });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.scope(null).findOne({ where: { email } });
    if (!admin) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const token = signToken({ id: admin.id, role: "admin", email: admin.email });
    res.status(200).json({ message: "Admin login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Admin login failed", error: error.message });
  }
};
