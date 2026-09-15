const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sequelize, Volunteer, Event, Task, VolunteerTaskRegistration } = require("../models");

const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || "supersecret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "3h",
  });
};

exports.createVolunteer = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const volunteer = await Volunteer.create({ username, email, password: hashedPassword });
    res.status(201).json({ message: "Volunteer created", volunteer: { id: volunteer.id, username: volunteer.username, email: volunteer.email } });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Volunteer username or email already exists" });
    }

    res.status(400).json({ message: "Failed to create volunteer", error: error.message });
  }
};

exports.loginVolunteer = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

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
  const transaction = await sequelize.transaction();

  try {
    const { taskId } = req.body;
    const volunteerId = req.user.id;
    const task = await Task.findByPk(taskId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!task) {
      await transaction.rollback();
      return res.status(404).json({ message: "Task not found" });
    }

    const existingRegistration = await VolunteerTaskRegistration.findOne({
      where: { volunteerId, taskId },
      transaction,
    });

    if (existingRegistration) {
      await transaction.rollback();
      return res.status(400).json({ message: "Volunteer is already registered for this task" });
    }

    if (task.filledVolunteers >= task.requiredVolunteers) {
      await transaction.rollback();
      return res.status(400).json({ message: "This task is already full" });
    }

    const registration = await VolunteerTaskRegistration.create(
      { volunteerId, taskId, status: "registered" },
      { transaction }
    );
    task.filledVolunteers += 1;
    await task.save({ transaction });
    await transaction.commit();

    res.status(201).json({ message: "Volunteer registered for task", registration });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: "Registration failed", error: error.message });
  }
};

exports.unregisterVolunteerFromTask = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { taskId } = req.params;
    const volunteerId = req.user.id;
    const task = await Task.findByPk(taskId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!task) {
      await transaction.rollback();
      return res.status(404).json({ message: "Task not found" });
    }

    const registration = await VolunteerTaskRegistration.findOne({
      where: { volunteerId, taskId },
      transaction,
    });

    if (!registration) {
      await transaction.rollback();
      return res.status(404).json({ message: "Volunteer is not registered for this task" });
    }

    if (registration.status !== "registered") {
      await transaction.rollback();
      return res.status(400).json({ message: "This registration cannot be cancelled" });
    }

    await registration.destroy({ transaction });
    task.filledVolunteers = Math.max(0, task.filledVolunteers - 1);
    await task.save({ transaction });
    await transaction.commit();

    res.status(200).json({ message: "Volunteer unregistered from task", taskId: Number(taskId) });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: "Unregistration failed", error: error.message });
  }
};

exports.getVolunteerRegistrations = async (req, res) => {
  try {
    const registrations = await VolunteerTaskRegistration.findAll({
      where: { volunteerId: req.user.id },
      include: [{ association: "task" }],
    });

    res.status(200).json(registrations);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch volunteer registrations", error: error.message });
  }
};
