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

    if (process.env.DB_SYNC === "true") {
      const syncOptions = process.env.DB_SYNC_ALTER === "true" ? { alter: true } : {};
      await sequelize.sync(syncOptions);
      console.log("Database tables synced successfully.");
    } else {
      console.log("Database schema sync skipped.");
    }
  } catch (error) {
    console.error("Database connection failed:", error.message);
    throw error;
  }
};

module.exports = { sequelize, connectDatabase };
