const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME || "ngo_platform",
  process.env.DB_USER || "postgres",
  process.env.DB_PASSWORD || "postgres",
  {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    dialect: "postgres",
    logging: false,
    dialectOptions:
      process.env.DB_SSL === "true"
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
  }
);

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL connected successfully.");

    await sequelize.sync({ alter: true });
    console.log("Database tables synced successfully.");
  } catch (error) {
    console.log("Database is not ready yet. Please create PostgreSQL and update the .env values.");
    console.log(error.message);
  }
};

module.exports = { sequelize, connectDatabase };
