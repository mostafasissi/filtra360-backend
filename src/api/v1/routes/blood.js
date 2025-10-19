const express = require("express");
const BloodController = require("../controller/BloodController");
const {
  isAuthenticated,
} = require("../middlewares/auth.middleware");

const router = express.Router();

/**
 * Blood Work Routes
 * All routes require authentication
 */

// CRUD Operations for Blood Work Data
router.get("/", isAuthenticated, BloodController.getBloodData);         // GET /blood
router.put("/", isAuthenticated, BloodController.updateBloodData);      // PUT /blood

// Analysis and Statistics Routes
router.get("/analyze", isAuthenticated, BloodController.analyzeBloodWork);        // GET /blood/analyze
router.post("/analyze-file", isAuthenticated, BloodController.analyzeBloodWorkFromFile);           // POST /blood/analyze-file (no auth required for direct analysis)
router.get("/statistics", isAuthenticated, BloodController.getBloodWorkStatistics); // GET /blood/statistics

module.exports = router;