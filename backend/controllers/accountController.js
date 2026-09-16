const bcrypt = require("bcryptjs");
const { sequelize, Admin, Organizer, Volunteer } = require("../models");

const modelByRole = {
  admin: Admin,
  organizer: Organizer,
  volunteer: Volunteer,
};

const getCurrentModel = (req) => modelByRole[req.user.role];

const publicAttributes = {
  exclude: ["password"],
};

exports.getCurrentAccount = async (req, res) => {
  try {
    const Model = getCurrentModel(req);
    const account = await Model.findByPk(req.user.id, { attributes: publicAttributes });

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.status(200).json({ account, role: req.user.role });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch account", error: error.message });
  }
};

exports.updateCurrentAccount = async (req, res) => {
  try {
    const Model = getCurrentModel(req);
    const account = await Model.findByPk(req.user.id);

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const allowedFields = req.user.role === "admin" ? ["name"] : ["username"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== "string" || !req.body[field].trim()) {
          return res.status(400).json({ message: `${field} must be a non-empty string` });
        }
        updates[field] = req.body[field].trim();
      }
    }

    if (req.body.password !== undefined) {
      if (typeof req.body.password !== "string" || req.body.password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      updates.password = await bcrypt.hash(req.body.password, 10);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No supported account fields provided" });
    }

    await account.update(updates);
    const safeAccount = await Model.findByPk(account.id, { attributes: publicAttributes });
    res.status(200).json({ message: "Account updated", account: safeAccount });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "That username is already in use" });
    }

    res.status(400).json({ message: "Failed to update account", error: error.message });
  }
};

exports.deleteCurrentAccount = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const Model = getCurrentModel(req);
    const account = await Model.findByPk(req.user.id, { transaction });

    if (!account) {
      await transaction.rollback();
      return res.status(404).json({ message: "Account not found" });
    }

    await account.destroy({ transaction });
    await transaction.commit();

    res.status(200).json({ message: "Account deleted" });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ message: "Failed to delete account", error: error.message });
  }
};