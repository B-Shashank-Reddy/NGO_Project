const { sequelize } = require("../models");

const tables = ["admins", "organizers", "volunteers", "events"];

(async () => {
  try {
    for (const table of tables) {
      await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "locationLabel" VARCHAR(255)`);
      await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION`);
      await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`);
    }

    console.log("Location columns are ready.");
  } catch (error) {
    console.error("Location migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();