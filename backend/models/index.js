const { sequelize } = require("../config/db");
const Admin = require("./Admin");
const Organizer = require("./Organizer");
const Volunteer = require("./Volunteer");
const Event = require("./Event");
const Task = require("./Task");
const VolunteerTaskRegistration = require("./VolunteerTaskRegistration");

Organizer.hasMany(Event, {
  foreignKey: "organizerId",
  as: "events",
  onDelete: "CASCADE",
});
Event.belongsTo(Organizer, {
  foreignKey: "organizerId",
  as: "organizer",
});

Event.hasMany(Task, {
  foreignKey: "eventId",
  as: "tasks",
  onDelete: "CASCADE",
});
Task.belongsTo(Event, {
  foreignKey: "eventId",
  as: "event",
});

Volunteer.hasMany(VolunteerTaskRegistration, {
  foreignKey: "volunteerId",
  as: "registrations",
  onDelete: "CASCADE",
});
VolunteerTaskRegistration.belongsTo(Volunteer, {
  foreignKey: "volunteerId",
  as: "volunteer",
});

Task.hasMany(VolunteerTaskRegistration, {
  foreignKey: "taskId",
  as: "registrations",
  onDelete: "CASCADE",
});
VolunteerTaskRegistration.belongsTo(Task, {
  foreignKey: "taskId",
  as: "task",
});

module.exports = {
  sequelize,
  Admin,
  Organizer,
  Volunteer,
  Event,
  Task,
  VolunteerTaskRegistration,
};
