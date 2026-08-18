const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const VolunteerTaskRegistration = sequelize.define(
  "VolunteerTaskRegistration",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    volunteerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "volunteers",
        key: "id",
      },
    },
    taskId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tasks",
        key: "id",
      },
    },
    status: {
      type: DataTypes.ENUM("registered", "assigned", "completed"),
      defaultValue: "registered",
    },
  },
  {
    tableName: "volunteer_task_registrations",
    timestamps: true,
  }
);

module.exports = VolunteerTaskRegistration;
