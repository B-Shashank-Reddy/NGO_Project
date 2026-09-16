const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  getCurrentAccount,
  updateCurrentAccount,
  deleteCurrentAccount,
} = require("../controllers/accountController");

router.use(verifyToken);
router.get("/me", getCurrentAccount);
router.patch("/profile", updateCurrentAccount);
router.delete("/me", deleteCurrentAccount);

module.exports = router;