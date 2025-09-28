const express = require("express");
const CronController = require("../controller/CronController");
const { isAuthenticated, restrictTo } = require("../middlewares/auth.middleware");

const router = express.Router();

// All routes require authentication and admin role
router.use(isAuthenticated);
router.use(restrictTo("Admin"));

// Get cron service status
router.get("/status", CronController.getStatus);

// Manually trigger sync
router.post("/manual-sync", CronController.manualSync);

// Get next run time
router.get("/next-run", CronController.getNextRun);

module.exports = router; 