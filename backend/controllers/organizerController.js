const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Organizer, Event, Task } = require("../models");

const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || "supersecret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "3h",
  });
};

exports.createOrganizer = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const organizer = await Organizer.create({ username, email, password: hashedPassword });
    res.status(201).json({ message: "Organizer created", organizer: { id: organizer.id, username: organizer.username, email: organizer.email } });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Organizer username or email already exists" });
    }

    res.status(400).json({ message: "Failed to create organizer", error: error.message });
  }
};

exports.loginOrganizer = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const organizer = await Organizer.findOne({ where: { email } });
    if (!organizer) {
      return res.status(401).json({ message: "Invalid organizer credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, organizer.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid organizer credentials" });
    }

    const token = signToken({ id: organizer.id, role: "organizer", email: organizer.email });
    res.status(200).json({ message: "Organizer login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Organizer login failed", error: error.message });
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

exports.createEvent = async (req, res) => {
  try {
    const { name, description, place, eventDate, startTime, endTime } = req.body;
    const event = await Event.create({
      organizerId: req.user.id,
      name,
      description,
      place,
      eventDate,
      startTime,
      endTime,
    });

    res.status(201).json({ message: "Event created", event });
  } catch (error) {
    res.status(400).json({ message: "Failed to create event", error: error.message });
  }
};

exports.getOrganizerEvents = async (req, res) => {
  try {
    const events = await Event.findAll({
      where: { organizerId: req.user.id },
      include: [{ association: "tasks" }],
    });

    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch organizer events", error: error.message });
  }
};

exports.createTaskForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, description, requiredVolunteers } = req.body;
    const event = await Event.findOne({ where: { id: eventId, organizerId: req.user.id } });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const task = await Task.create({ eventId, title, description, requiredVolunteers });
    res.status(201).json({ message: "Task created", task });
  } catch (error) {
    res.status(400).json({ message: "Failed to create task", error: error.message });
  }
};

exports.getEventTasks = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ where: { id: eventId, organizerId: req.user.id } });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const tasks = await Task.findAll({ where: { eventId } });
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch event tasks", error: error.message });
  }
};
