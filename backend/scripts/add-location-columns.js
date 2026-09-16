const { sequelize } = require("../models");

const tables = ["admins", "organizers", "volunteers", "events"];
const indexes = [
  ["events", "events_organizer_id_idx", '"organizerId"'],
  ["events", "events_active_date_idx", '"isActive", "eventDate"'],
  ["tasks", "tasks_event_id_idx", '"eventId"'],
  ["volunteer_task_registrations", "registrations_task_id_idx", '"taskId"'],
  ["volunteer_task_registrations", "registrations_status_idx", '"status"'],
];

(async () => {
  try {
    for (const table of tables) {
      await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "locationLabel" VARCHAR(255)`);
      await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION`);
      await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`);
    }

    for (const [table, indexName, columns] of indexes) {
      await sequelize.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${table}" (${columns})`);
    }

    console.log("Location columns and query indexes are ready.");
  } catch (error) {
    console.error("Location migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();