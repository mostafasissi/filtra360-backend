const UserService = require("../services/user.service");
const catchAsyncHandler = require("../utils/catchAsyncHandler");

class UserController {
  static createUser = catchAsyncHandler(async (req, res) => {
    const result = await UserService.createUser(req.body);
    return res.status(201).json(result);
  });


  static updateUserAndProfile = catchAsyncHandler(async (req, res) => {
    console.log("userId", req.user);
    const { id } = req.user; // Get user id from token
    console.log("userId", id);
    const result = await UserService.updateUserAndProfile(id, req.body);
    return res.status(200).json(result);
  });

  static verifyUserName = catchAsyncHandler(async (req, res) => {
    const result = await UserService.verifyUserName(req.body);
    return res.status(200).json(result);
  });

  static verifyOtp = catchAsyncHandler(async (req, res) => {
    const result = await UserService.verifyOtp(req.body);
    return res.status(200).json(result);
  });


  static resendOtp = catchAsyncHandler(async (req, res) => {
    const result = await UserService.resendOtp(req.body);
    return res.status(200).json(result);
  });

  static loginUser = catchAsyncHandler(async (req, res) => {
    const result = await UserService.loginUser(req.body);
    return res.status(200).json(result);
  });

  // Social Login
  static socialLoginUser = catchAsyncHandler(async (req, res) => {
    const result = await UserService.socialLogin(req.body);
    return res.status(200).json(result);
  });

  static getAllUsers = catchAsyncHandler(async (req, res) => {
    const users = await UserService.getAllUsers(req.query);
    return res.status(200).json(users);
  });


  static getUserByUserName = catchAsyncHandler(async (req, res) => {
    const users = await UserService.getUserByUserName(req.body);
    return res.status(200).json(users);
  });


  static getUserPageByUserName = catchAsyncHandler(async (req, res) => {
    const users = await UserService.getUserPageByUserName(req.body);
    return res.status(200).json(users);
  });



  static getAllUsersByRole = catchAsyncHandler(async (req, res) => {
    const result = await UserService.getAllUsersByRole(req.body);
    return res.status(200).json(result);
  });

  static updateUser = catchAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await UserService.updateUser(id, req.body);
    return res.status(200).json(result);
  });

  static getUser = catchAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await UserService.getUser(id);
    return res.status(200).json(result);
  });

  static getUserByToken = catchAsyncHandler(async (req, res) => {
    console.log("req.user", req.user);
    const { id } = req.user;
    const result = await UserService.getUser(id);
    return res.status(200).json(result);
  });
  static deleteUser = catchAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await UserService.deleteUser(id);
    return res.status(200).json(result);
  });

  static forgotPassword = catchAsyncHandler(async (req, res) => {
    const result = await UserService.forgotPassword(req.body);
    return res.status(200).json(result);
  });

  static updatePassword = catchAsyncHandler(async (req, res) => {
    const result = await UserService.updatePassword(req.body);
    return res.status(200).json(result);
  });

  static updateProfile = catchAsyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await UserService.updateProfile(id, req.body);
    return res.status(200).json(result);
  });

  static getAllAgents = catchAsyncHandler(async (req, res) => {
    const result = await UserService.getAllAgents(req.query);
    return res.status(200).json(result);
  });

  static processImage = catchAsyncHandler(async (req, res) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    console.log("Processing image for user:", req.user.id);
    const { useEnhancedPrompts = false, ...requestData } = req.body;
    const result = await UserService.processImage({ ...requestData, userId: req.user.id, useEnhancedPrompts });
    return res.status(200).json(result);
  });

  // New method for enhanced image processing
  static processImageEnhanced = catchAsyncHandler(async (req, res) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    console.log("Processing image with enhanced prompts for user:", req.user.id);
    
    // Ensure the promptType is set to enhanced version if not already
    let { promptType, ...otherData } = req.body;
    
    // Map original prompt types to enhanced versions if needed
    if (promptType === 'DNA_ANALYSIS') {
      promptType = 'DNA_ANALYSIS_ENHANCED';
    } else if (promptType === 'BLOOD_REPORT') {
      promptType = 'BLOOD_REPORT_ENHANCED';
    }
    
    const result = await UserService.processImage({ 
      ...otherData, 
      promptType, 
      userId: req.user.id, 
      useEnhancedPrompts: true 
    });
    return res.status(200).json(result);
  });

  static saveAnalysisData = catchAsyncHandler(async (req, res) => {
    const { id } = req.user; // Get user id from token
    const result = await UserService.saveAnalysisData(id, req.body);
    return res.status(result.success ? 200 : 400).json(result);
  });

  static getDashboardInsight = catchAsyncHandler(async (req, res) => {
    const { id } = req.user;
    const { useEnhancedPrompts = false } = req.query; // Get from query parameter
    const result = await UserService.getDashboardInsight(id, useEnhancedPrompts === 'true');
    return res.status(200).json(result);
  });

  // New method for enhanced dashboard insights
  static getDashboardInsightEnhanced = catchAsyncHandler(async (req, res) => {
    const { id } = req.user;
    const result = await UserService.getDashboardInsight(id, true); // Always use enhanced prompts
    return res.status(200).json(result);
  });

  static generatePersonalizedPlan = catchAsyncHandler(async (req, res) => {
    const { id } = req.user;
    console.log("id", id);
    const result = await UserService.generatePersonalizedPlan(id);
    return res.status(200).json({ success: true, data: result });
  });

}

module.exports = UserController;
