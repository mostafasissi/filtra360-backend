const BloodService = require("../services/blood.service");
const catchAsyncHandler = require("../utils/catchAsyncHandler");

/**
 * Blood Work Controller
 * Handles all blood work-related HTTP requests
 */
class BloodController {
  

  /**
   * Get blood work data (GET)
   * Retrieves stored blood work data for the authenticated user
   */
  static getBloodData = catchAsyncHandler(async (req, res) => {
    // Validate authentication
    const userId = req.user?._id || req.user?.id;
    if (!req.user || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    console.log("Getting blood work data for user:", userId);
    const result = await BloodService.getBloodData(userId);
    
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  });

  /**
   * Update blood work data (PUT)
   * Updates existing blood work data for the authenticated user
   */
  static updateBloodData = catchAsyncHandler(async (req, res) => {
    // Validate authentication
    const userId = req.user?._id || req.user?.id;
    if (!req.user || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    console.log("Updating blood work data for user:", userId);
    const result = await BloodService.updateBloodData(userId, req.body);
    
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  });


  /**
   * Analyze existing blood work data (GET)
   * Performs AI analysis on the user's stored blood work data
   */
  static analyzeBloodWork = catchAsyncHandler(async (req, res) => {
    // Validate authentication
    const userId = req.user?._id || req.user?.id;
    if (!req.user || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    console.log("Analyzing stored blood work data for user:", userId);
    
    // Get the user's stored blood work data
    const bloodData = await BloodService.getBloodData(userId);
    
    if (!bloodData.success || !bloodData.data.hasData) {
      return res.status(404).json({
        success: false,
        message: "No blood work data found for analysis. Please upload blood work data first."
      });
    }

    // Return the existing analysis or the data for frontend processing
    const result = {
      success: true,
      message: "Blood work analysis retrieved successfully",
      data: {
        analysis: bloodData.data.analysis,
        metadata: bloodData.data.metadata,
        lastUpdated: bloodData.data.lastUpdated
      }
    };
    
    return res.status(200).json(result);
  });

  /**
   * Get blood work statistics (GET)
   * Retrieves statistics about the user's blood work data
   */
  static getBloodWorkStatistics = catchAsyncHandler(async (req, res) => {
    // Validate authentication
    const userId = req.user?._id || req.user?.id;
    if (!req.user || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    console.log("Getting blood work statistics for user:", userId);
    const result = await BloodService.getBloodWorkStatistics(userId);
    
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  });

  /**
   * Direct blood work analysis from Base64 file (POST)
   * Analyzes blood work directly from Base64 encoded PDF/image
   * If user is authenticated, the analysis will be automatically saved
   */
  static analyzeBloodWorkFromFile = catchAsyncHandler(async (req, res) => {
    const { base64Data } = req.body;

    // Validate input
    if (!base64Data) {
      return res.status(400).json({
        success: false,
        message: "Base64 file data is required in the request body"
      });
    }

    // Get userId if user is authenticated (optional)
    const userId = req.user?._id || req.user?.id || null;
    
    if (userId) {
      console.log(`Analyzing blood work from uploaded file for user: ${userId} (will be saved)`);
    } else {
      console.log("Analyzing blood work from uploaded file (no user authentication - won't be saved)");
    }
    
    const result = await BloodService.analyzeBloodWork(base64Data, userId);
    
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  });
}

module.exports = BloodController;