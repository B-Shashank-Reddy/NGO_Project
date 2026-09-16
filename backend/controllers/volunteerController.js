const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sequelize, Volunteer, Event, Task, VolunteerTaskRegistration } = require("../models");
const { resolveLocation } = require("../services/locationService");

const SORT_MODES = new Set(["nearest", "soonest", "newest", "available"]);

const calculateDistanceKm = (latitudeOne, longitudeOne, latitudeTwo, longitudeTwo) => {
  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeTwo - latitudeOne);
  const longitudeDelta = toRadians(longitudeTwo - longitudeOne);
  const latitudeOneRadians = toRadians(latitudeOne);
  const latitudeTwoRadians = toRadians(latitudeTwo);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeOneRadians) * Math.cos(latitudeTwoRadians) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || "supersecret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "3h",
  });
};

exports.createVolunteer = async (req, res) => {
  try {
    const { username, email, password, locationLabel, latitude, longitude } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const location = await resolveLocation({ locationLabel, latitude, longitude });

    const hashedPassword = await bcrypt.hash(password, 10);

    const volunteer = await Volunteer.create({ username, email, password: hashedPassword, ...location });
    res.status(201).json({ message: "Volunteer created", volunteer: { id: volunteer.id, username: volunteer.username, email: volunteer.email } });
  } catch (error) {
    if (/location|latitude|longitude/i.test(error.message)) {
      return res.status(400).json({ message: error.message });
    }

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

    if (!volunteer.isActive) {
      return res.status(403).json({ message: "Volunteer account is inactive" });
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
    const sort = typeof req.query.sort === "string" ? req.query.sort : "soonest";
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 50)
      : 20;

    if (!SORT_MODES.has(sort)) {
      return res.status(400).json({ message: "sort must be one of nearest, soonest, newest, or available" });
    }

    const volunteer = await Volunteer.findByPk(req.user.id, {
      attributes: ["id", "latitude", "longitude"],
    });

    if (!volunteer) {
      return res.status(404).json({ message: "Volunteer account not found" });
    }

    if (sort === "nearest" && (!Number.isFinite(Number(volunteer.latitude)) || !Number.isFinite(Number(volunteer.longitude)))) {
      return res.status(400).json({ message: "Set your location before sorting events by nearest" });
    }

    const events = await Event.findAll({
      where: { isActive: true },
      include: [{ association: "tasks" }],
    });

    const enrichedEvents = events.map((event) => {
      const eventData = event.toJSON();
      const availableSlots = eventData.tasks.reduce(
        (total, task) => total + Math.max(0, task.requiredVolunteers - task.filledVolunteers),
        0,
      );
      const hasCoordinates = Number.isFinite(Number(eventData.latitude))
        && Number.isFinite(Number(eventData.longitude));

      return {
        ...eventData,
        availableSlots,
        distanceKm: hasCoordinates
          ? Number(calculateDistanceKm(
            Number(volunteer.latitude),
            Number(volunteer.longitude),
            Number(eventData.latitude),
            Number(eventData.longitude),
          ).toFixed(2))
          : null,
      };
    });

    enrichedEvents.sort((eventOne, eventTwo) => {
      if (sort === "nearest") {
        return (eventOne.distanceKm ?? Number.POSITIVE_INFINITY) - (eventTwo.distanceKm ?? Number.POSITIVE_INFINITY);
      }
      if (sort === "newest") {
        return new Date(eventTwo.createdAt) - new Date(eventOne.createdAt);
      }
      if (sort === "available") {
        return eventTwo.availableSlots - eventOne.availableSlots;
      }
      return new Date(eventOne.eventDate) - new Date(eventTwo.eventDate);
    });

    const total = enrichedEvents.length;
    const start = (page - 1) * limit;
    const eventsForPage = enrichedEvents.slice(start, start + limit);

    res.status(200).json({
      sort,
      page,
      limit,
      total,
      hasNext: start + limit < total,
      events: eventsForPage,
    });
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
