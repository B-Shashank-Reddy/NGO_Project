const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Volunteer, Event, Task, VolunteerTaskRegistration } = require("../models");

const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || "supersecret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "3h",
  });
};

exports.createVolunteer = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const volunteer = await Volunteer.create({ username, email, password: hashedPassword });
    res.status(201).json({ message: "Volunteer created", volunteer: { id: volunteer.id, username: volunteer.username, email: volunteer.email } });
  } catch (error) {
    res.status(400).json({ message: "Failed to create volunteer", error: error.message });
  }
};

exports.loginVolunteer = async (req, res) => {
  try {
    const { email, password } = req.body;
    const volunteer = await Volunteer.findOne({ where: { email } });
    if (!volunteer) {
      return res.status(401).json({ message: "Invalid volunteer credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, volunteer.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid volunteer credentials" });
    }

    const token = signToken({ id: volunteer.id, role: "volunteer", email: volunteer.email });
    res.status(200).json({ message: "Volunteer login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Volunteer login failed", error: error.message });
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

exports.getEventDetails = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findByPk(eventId, {
      include: [{ association: "tasks" }],
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch event details", error: error.message });
  }
};

exports.registerVolunteerForTask = async (req, res) => {
  try {
    const { volunteerId, taskId } = req.body;
    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.filledVolunteers >= task.requiredVolunteers) {
      return res.status(400).json({ message: "This task is already full" });
    }

    const existingRegistration = await VolunteerTaskRegistration.findOne({
      where: { volunteerId, taskId },
    });

    if (existingRegistration) {
      return res.status(400).json({ message: "Volunteer is already registered for this task" });
    }

    const registration = await VolunteerTaskRegistration.create({ volunteerId, taskId, status: "registered" });
    task.filledVolunteers += 1;
    await task.save();

    res.status(201).json({ message: "Volunteer registered for task", registration });
  } catch (error) {
    res.status(400).json({ message: "Registration failed", error: error.message });
  }
};

exports.getVolunteerRegistrations = async (req, res) => {
  try {
    const { volunteerId } = req.params;
    const registrations = await VolunteerTaskRegistration.findAll({
      where: { volunteerId },
      include: [{ association: "task" }],
    });

    res.status(200).json(registrations);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch volunteer registrations", error: error.message });
  }
};
