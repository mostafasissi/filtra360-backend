const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pdfParse = require("pdf-parse");
const { OpenAI } = require("openai");
const User = require("../model/Users");
const AppError = require("../utils/AppError");
const HttpStatusCodes = require("../enums/httpStatusCode");
const { createJwtToken } = require("../middlewares/auth.middleware");
const { s3SharpImageUpload } = require("../services/aws.service");
const { sendEmail, sendForgotPasswordEmail } = require("../utils/email");
const {
  sendOTPEmail,
  sendWelcomeEmail,
  generateOTP,
} = require("../utils/smtpEmail");
const UserProfile = require("../model/UserProfile");
const { jsonrepair } = require("jsonrepair");
const {
  PROMPT_TEMPLATES,
  ENHANCED_PROMPT_TEMPLATES,
  TARGET_DNA_MARKERS,
} = require("../utils/constants");
const DNAService = require("./dna.service");

// const sendEmail = require("../utils/sendEmail"); // Utility for sending emails

// Initialize OpenAI with error handling
let openai;
try {
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "Warning: OPENAI_API_KEY is not set. ChatGPT features will be disabled."
    );
  } else {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log("OpenAI initialized successfully");
  }
} catch (error) {
  console.error("Error initializing OpenAI:", error.message);
}

// Add PDF text extraction function
const extractPdfText = async (base64Data) => {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info,
    };
  } catch (error) {
    throw new Error(`Failed to extract PDF text: ${error.message}`);
  }
};

// Add ChatGPT processing function with improved prompt handling
const processWithChatGPT = async (
  text,
  promptType,
  customPrompt = null,
  useEnhancedPrompts = false
) => {
  try {
    if (!openai) {
      throw new Error(
        "OpenAI is not initialized. Please set OPENAI_API_KEY in your environment variables."
      );
    }

    // Auto-detect enhanced prompts if promptType contains "ENHANCED"
    if (promptType && promptType.includes("ENHANCED")) {
      useEnhancedPrompts = true;
    }

    // Get the appropriate prompt template
    var prompt;
    if (promptType === "CUSTOM" && customPrompt) {
      prompt = customPrompt;
    } else {
      // Choose between original and enhanced prompts
      const promptTemplates = useEnhancedPrompts
        ? ENHANCED_PROMPT_TEMPLATES
        : PROMPT_TEMPLATES;
      prompt = promptTemplates[promptType];
      if (!prompt) {
        throw new Error(`Invalid prompt type: ${promptType}`);
      }
    }

    console.log("Using prompt type:", promptType);
    console.log("Using enhanced prompts:", useEnhancedPrompts);
    console.log("Prompt template:", prompt);

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content:
            promptType === "DASHBOARD_SUMMARY" ||
            promptType === "DASHBOARD_SUMMARY_ENHANCED"
              ? prompt
              : "You are a specialized medical data extraction assistant. Extract and structure medical data from text into JSON format. Be precise and thorough in your analysis. Always return a valid JSON object.",
        },
        {
          role: "user",
          content:
            promptType === "DASHBOARD_SUMMARY" ||
            promptType === "DASHBOARD_SUMMARY_ENHANCED"
              ? text
              : `${prompt}\n\nText to analyze: ${text}`,
        },
      ],
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
    });

    // Get the response content
    const responseContent = completion.choices[0].message.content;
    console.log(
      "=============================================================================="
    );
    console.log("Raw ChatGPT response:", responseContent);

    // Parse the JSON response
    let parsedAnalysis;
    try {
      // First, try to parse the response directly
      parsedAnalysis = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Initial JSON parse error:", parseError);
      // Try to repair the JSON using jsonrepair
      try {
        const repaired = jsonrepair(responseContent);
        parsedAnalysis = JSON.parse(repaired);
        console.log("Successfully repaired JSON with jsonrepair.");
      } catch (repairError) {
        console.error("jsonrepair failed:", repairError);
        throw new Error(
          `Failed to parse/repair ChatGPT response: ${repairError.message}`
        );
      }
    }

    // Validate the parsed data structure for non-dashboard prompts
    if (
      promptType === "DNA_ANALYSIS" ||
      promptType === "DNA_ANALYSIS_ENHANCED" ||
      promptType === "DNA_ANALYSIS_COMPREHENSIVE"
    ) {
      if (promptType === "DNA_ANALYSIS_COMPREHENSIVE") {
        // For comprehensive analysis, expect the new Fitra360 structure
        if (!parsedAnalysis.meta || !parsedAnalysis.sections) {
          throw new Error(
            "Invalid DNA comprehensive analysis structure: missing meta or sections"
          );
        }
        // Validate required meta fields
        if (
          typeof parsedAnalysis.meta.totalSnpsParsed !== "number" ||
          typeof parsedAnalysis.meta.recognizedSnpsCount !== "number" ||
          typeof parsedAnalysis.meta.inputSnpCount !== "number"
        ) {
          throw new Error(
            "Invalid DNA comprehensive analysis structure: missing required meta fields (totalSnpsParsed, recognizedSnpsCount, inputSnpCount)"
          );
        }
        // Validate that inputSnpCount equals recognizedSnpsCount
        if (
          parsedAnalysis.meta.inputSnpCount !==
          parsedAnalysis.meta.recognizedSnpsCount
        ) {
          throw new Error(
            "Invalid DNA comprehensive analysis structure: inputSnpCount must equal recognizedSnpsCount"
          );
        }
      } else {
        // For standard and enhanced analysis, expect dna_analysis structure
        if (
          !parsedAnalysis.dna_analysis ||
          !Array.isArray(parsedAnalysis.dna_analysis.markers)
        ) {
          throw new Error(
            "Invalid DNA analysis structure: missing dna_analysis or markers array"
          );
        }
      }
    } else if (
      promptType === "BLOOD_REPORT" ||
      promptType === "BLOOD_REPORT_ENHANCED"
    ) {
      if (!parsedAnalysis.blood_report) {
        throw new Error("Invalid blood report structure: missing blood_report");
      }

      // Check if results exist and are either an array (enhanced) or object (original)
      if (!parsedAnalysis.blood_report.results) {
        throw new Error("Invalid blood report structure: missing results");
      }

      // Log the structure for debugging
      console.log(
        "Blood report results type:",
        typeof parsedAnalysis.blood_report.results
      );
      console.log(
        "Blood report results is array:",
        Array.isArray(parsedAnalysis.blood_report.results)
      );
      if (!Array.isArray(parsedAnalysis.blood_report.results)) {
        console.log(
          "Blood report results keys:",
          Object.keys(parsedAnalysis.blood_report.results)
        );
      }
    }

    // Add metadata to the response
    const analysisWithMetadata = {
      ...parsedAnalysis,
      metadata: {
        ...parsedAnalysis.metadata,
        analysis_date: new Date().toISOString(),
        prompt_type: promptType,
        enhanced_prompts_used: useEnhancedPrompts,
      },
    };

    console.log(
      "Successfully parsed analysis:",
      JSON.stringify(analysisWithMetadata, null, 2)
    );

    return {
      analysis: analysisWithMetadata,
      promptType,
      promptUsed: prompt,
      enhancedPromptsUsed: useEnhancedPrompts,
    };
  } catch (error) {
    console.error("ChatGPT processing error:", error);
    return {
      error: `Error processing with ChatGPT: ${error.message}`,
      promptType,
      promptUsed: prompt || "No prompt used due to error",
      enhancedPromptsUsed: useEnhancedPrompts,
    };
  }
};

class UserService {
  static async createUser(data) {
    const { email, password, fullName } = data;

    let user = await User.findOne({ email });
    let isNewUser = false;
    let otp;

    if (user) {
      if (user.status !== "Active") {
        // Update password and resend OTP for inactive user
        user.password = await bcrypt.hash(password, 10);
        otp = crypto.randomInt(100000, 999999).toString();
        user.otp = otp;
        user.otpCreatedAt = Date.now();
        await user.save();
      } else {
        return {
          message: "Email already in use.",
          success: false,
        };
      }
    } else {
      // Create new user
      otp = crypto.randomInt(100000, 999999).toString();
      user = new User({
        email,
        password: await bcrypt.hash(password, 10),
        fullName,
        role: "Client",
        status: "Inactive",
        otp,
        otpCreatedAt: Date.now(),
      });
      await user.save();
      isNewUser = true;
    }

    // Create or find UserProfile for this user
    let userProfile = await UserProfile.findOne({ userId: user._id });
    if (!userProfile) {
      try {
        userProfile = await UserProfile.create({ userId: user._id });
      } catch (profileErr) {
        if (isNewUser) await User.findByIdAndDelete(user._id);
        return {
          message: "Failed to create user profile.",
          success: false,
          error: profileErr.message,
        };
      }
    }

    // Send OTP email to the user
    try {
      await sendOTPEmail(user.email, otp, "verification");
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      // Don't fail the user creation if email fails, but log the error
    }

    const token = createJwtToken({ id: user._id, role: user.role });
    const userData = user.toObject();
    return {
      message:
        user.status !== "Active"
          ? "OTP re-sent. Please verify your email."
          : "Client created successfully.",
      success: true,
      data: {
        ...userData,
        token,
        profile: userProfile,
      },
    };
  }

  static async updateUserAndProfile(userId, updateData) {
    // Split fields for User and UserProfile
    const userFields = {};
    const profileFields = {};

    // List of fields belonging to User
    const userFieldList = ["fullName", "email", "password"];
    // All other fields go to UserProfile

    for (const key in updateData) {
      if (userFieldList.includes(key)) {
        userFields[key] = updateData[key];
      } else {
        profileFields[key] = updateData[key];
      }
    }

    // Update User
    let updatedUser = null;
    if (Object.keys(userFields).length > 0) {
      if (userFields.password) {
        userFields.password = await bcrypt.hash(userFields.password, 10);
      }
      updatedUser = await User.findByIdAndUpdate(userId, userFields, {
        new: true,
        runValidators: true,
      });
      if (!updatedUser)
        throw new AppError("User not found.", HttpStatusCodes.NOT_FOUND);
    }

    // Update UserProfile
    let updatedProfile = null;
    if (Object.keys(profileFields).length > 0) {
      console.log(
        `[UpdateUserAndProfile] Updating profile for userId: ${userId}`
      );
      console.log(
        `[UpdateUserAndProfile] Profile fields to update:`,
        Object.keys(profileFields)
      );

      // Add isUpdated flag to profileFields to mark profile as updated
      profileFields.isUpdated = true;
      console.log(
        `[UpdateUserAndProfile] Setting isUpdated = true for profile update`
      );

      updatedProfile = await UserProfile.findOneAndUpdate(
        { userId },
        profileFields,
        { new: true, runValidators: true }
      );
      if (!updatedProfile)
        throw new AppError(
          "User profile not found.",
          HttpStatusCodes.NOT_FOUND
        );

      console.log(
        `[UpdateUserAndProfile] Profile updated successfully, isUpdated: ${updatedProfile.isUpdated}`
      );
    }

    return {
      message: "User and profile updated successfully.",
      user: updatedUser,
      profile: updatedProfile,
      success: true,
    };
  }

  static async verifyUserName(data) {
    const { userName } = data;

    const existingUser = await User.findOne({ userName });
    if (existingUser) {
      throw new AppError(
        "UserName already in use.",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    return { message: "UserName Available", success: true };
  }

  static async verifyOtp(data) {
    const { email, otp } = data;

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found.", HttpStatusCodes.BAD_REQUEST);
    }

    if (user.otp !== otp) {
      throw new AppError("Invalid OTP.", HttpStatusCodes.BAD_REQUEST);
    }

    const otpExpiryTime = 10 * 60 * 1000;
    if (Date.now() - user.otpCreatedAt > otpExpiryTime) {
      throw new AppError("OTP has expired.", HttpStatusCodes.BAD_REQUEST);
    }

    user.status = "Active";
    await user.save();

    return { message: "OTP verified successfully.", success: true };
  }

  static async resendOtp(data) {
    const { email } = data;

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found.", HttpStatusCodes.BAD_REQUEST);
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    //const otp = 123456;

    user.otp = otp;
    user.otpCreatedAt = Date.now();
    await user.save();
    // await sendEmail({ email, otp });
    sendOTPEmail(user.email, otp);

    return {
      message: "OTP has been resent successfully. Please check your email.",
      success: true,
    };
  }

  static async loginUser(data) {
    const { email, password, role } = data;
    if (!email || !password) {
      return {
        message: "Email, password, and role are required.",
        success: false,
      };
    }
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return {
        message: "Invalid email or password.",
        success: false,
      };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return {
        message: "Invalid email or password.",
        success: false,
      };
    }
    // if (user.role !== role) {
    //   throw new AppError(
    //     "Role mismatch. Access denied.",
    //     HttpStatusCodes.UNAUTHORIZED
    //   );
    // }
    if (user.status !== "Active") {
      return {
        message: "Account is inactive. Please verify your email.",
        success: false,
        status: user.status,
      };
    }

    // Fetch user profile
    const userProfile = await UserProfile.findOne({ userId: user._id });

    const token = createJwtToken({ id: user._id, role: user.role });
    const userData = user.toObject();
    return {
      message: "Login successful.",
      success: true,
      data: {
        ...userData,
        token,
        profile: userProfile || null, // Include profile data in response
      },
    };
  }

  static async socialLogin(data) {
    const {
      email,
      provider,
      providerId,
      userName,
      profilePhoto,
      firstName,
      lastName,
    } = data;

    if (!email || !provider || !providerId) {
      throw new AppError(
        "Email, provider, and providerId are required.",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    let user = await User.findOne({ email });

    // If user doesn't exist, create a new one
    if (!user) {
      user = await User.create({
        email,
        userName,
        loginType: provider,
        socialAccounts: {
          [`${provider.toLowerCase()}Id`]: providerId,
        },
        role: "Client", // Default role for new users
        status: "Active", // Default status for social login
        profilePhoto,
        firstName,
        lastName,
      });
    } else {
      // If user exists but hasn't logged in via this provider before, update their social account info
      if (!user.socialAccounts[`${provider.toLowerCase()}Id`]) {
        user.socialAccounts[`${provider.toLowerCase()}Id`] = providerId;
        user.loginType = provider;
        await user.save();
      }

      // Check if the account is active
      if (user.status !== "Active") {
        throw new AppError(
          "Account is inactive. Please contact support.",
          HttpStatusCodes.UNAUTHORIZED
        );
      }
    }

    // Generate JWT token
    const token = createJwtToken({ id: user._id, role: user.role });
    const userData = user.toObject();
    return {
      message: "Social login successful.",
      success: true,
      data: {
        ...userData,
        token,
      },
    };
  }

  static async getAllUsers(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalUsers = await User.countDocuments({ status: "Active" });
    const totalPages = Math.ceil(totalUsers / limit);

    const users = await User.find({ status: "Active" })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    if (!users || users.length === 0) {
      return {
        message: "No users found.",
        success: false,
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          limit,
        },
      };
    }

    return {
      message: "Users fetched successfully.",
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalUsers,
        limit,
      },
    };
  }

  static async getAllAgents(query) {
    const page = parseInt(query?.page) || 1;
    const limit = parseInt(query?.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count of active agents
    const totalAgents = await User.countDocuments({
      role: "Client",
      status: "Active",
    });

    const totalPages = Math.ceil(totalAgents / limit);

    // Get agents with their wallets using aggregation
    const agents = await User.aggregate([
      {
        $match: {
          role: "Client",
          status: "Active",
        },
      },
      {
        $lookup: {
          from: "wallets",
          localField: "_id",
          foreignField: "userId",
          as: "wallet",
        },
      },
      {
        $project: {
          password: 0,
          __v: 0,
          "wallet.__v": 0,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);

    if (!agents || agents.length === 0) {
      return {
        message: "No agents found",
        success: false,
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          limit,
        },
      };
    }

    return {
      message: "Agents fetched successfully",
      success: true,
      data: agents.map((agent) => ({
        ...agent,
        wallet: agent.wallet[0] || null, // Flatten wallet array to single object
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalAgents,
        limit,
      },
    };
  }

  static async getAllUsersByRole(role) {
    if (!role) {
      throw new AppError("Role is required.", HttpStatusCodes.BAD_REQUEST);
    }
    console.log("Role:", role);

    const users = await User.find({ role: role.role });
    console.log("Users found:", users);
    return {
      message: ` All user with ${role.role}`,
      success: true,
      data: users,
    };
    //return users.length ? users : [];
  }

  static async getUserByUserName(userName) {
    if (!userName) {
      throw new AppError("userName is required.", HttpStatusCodes.BAD_REQUEST);
    }
    console.log("userName", userName);
    const users = await User.find({ userName: userName.userName });
    console.log("Users found:", users);
    return {
      message: `User`,
      success: true,
      data: users,
    };
    //return users.length ? users : [];
  }

  static async getUserPageByUserName(userName) {
    if (!userName) {
      throw new AppError("userName is required.", HttpStatusCodes.BAD_REQUEST);
    }
    console.log("userName", userName);
    const users = await User.findOne({ userName: userName.userName });
    const page = await PageBuilder.findOne({ userId: users._id }).populate(
      "userId"
    );
    console.log("Users found:", users);
    return {
      message: `User page`,
      success: true,
      data: page,
    };
    //return users.length ? users : [];
  }

  static async updateUser(userId, updateData) {
    console.log(`[UpdateUser] Updating user profile for userId: ${userId}`);
    console.log(`[UpdateUser] Update data fields:`, Object.keys(updateData));

    // Add isUpdated flag to mark profile as updated
    updateData.isUpdated = true;
    console.log(`[UpdateUser] Setting isUpdated = true for profile update`);

    // Find the UserProfile by userId and update it
    const updatedProfile = await UserProfile.findOneAndUpdate(
      { userId }, // Find by userId field in UserProfile
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedProfile) {
      throw new AppError("User profile not found.", HttpStatusCodes.NOT_FOUND);
    }

    console.log(
      `[UpdateUser] Profile updated successfully, isUpdated: ${updatedProfile.isUpdated}`
    );

    return {
      message: "User profile updated successfully.",
      profile: updatedProfile,
      success: true,
    };
  }

  static async getUser(userId) {
    const user = await User.findOne({ _id: userId });

    if (!user) throw new AppError("User not found.", HttpStatusCodes.NOT_FOUND);

    return {
      message: "User updated successfully.",
      user: { ...user.toObject() },
      success: true,
    };
  }

  static async deleteUser(userId) {
    const deletedUser = await User.findOne({
      _id: userId,
      status: "Active",
    });

    if (!deletedUser) {
      throw new AppError("Active user not found", HttpStatusCodes.NOT_FOUND);
    }

    // Soft delete by updating status to inactive
    deletedUser.status = "Inactive";
    await deletedUser.save();

    return {
      message: "user deactivated successfully",
      success: true,
    };
  }

  static async forgotPassword(data) {
    const { email } = data;

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found.", HttpStatusCodes.NOT_FOUND);
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    //const otp = 123456;
    user.otp = otp;
    user.otpCreatedAt = Date.now();
    await user.save();
    // await sendForgotPasswordEmail({ email, otp });
    sendOTPEmail(user.email, otp);

    return {
      message:
        "OTP has been sent to your email. Please verify to reset your password.",
      success: true,
      data: user,
    };
  }

  static async updatePassword(data) {
    const { email, userId, otp, newPassword } = data;

    const user = await User.findOne({ _id: userId, email });
    if (!user) {
      throw new AppError("User not found.", HttpStatusCodes.BAD_REQUEST);
    }

    if (user.otp !== otp) {
      throw new AppError("Invalid OTP.", HttpStatusCodes.BAD_REQUEST);
    }

    const otpExpiryTime = 10 * 60 * 1000;
    if (Date.now() - user.otpCreatedAt > otpExpiryTime) {
      throw new AppError("OTP has expired.", HttpStatusCodes.BAD_REQUEST);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    user.otp = null;
    user.otpCreatedAt = null;
    await user.save();

    return { message: "Password updated successfully.", success: true };
  }

  static async updateProfile(userId, data) {
    try {
      const { userName, password, profilePhoto, email } = data;

      const userToUpdate = await User.findById(userId);
      if (!userToUpdate) {
        throw new AppError("User not found.", HttpStatusCodes.NOT_FOUND);
      }

      let updates = {};

      // Check email uniqueness if email is being updated
      if (email && email !== userToUpdate.email) {
        const emailExists = await User.findOne({
          email,
          _id: { $ne: userId },
        });
        if (emailExists) {
          throw new AppError(
            "Email already exists. Please use another email.",
            HttpStatusCodes.BAD_REQUEST
          );
        }
        updates.email = email;
      }

      // Handle profile photo
      if (profilePhoto) {
        try {
          const profilePhotoUrl = profilePhoto.startsWith("data:")
            ? await s3SharpImageUpload(profilePhoto)
            : profilePhoto;
          updates.profilePhoto = profilePhotoUrl;
        } catch (error) {
          throw new AppError(
            "Failed to upload profile photo.",
            HttpStatusCodes.BAD_REQUEST
          );
        }
      }

      // Handle password update
      if (password) {
        updates.password = await bcrypt.hash(password, 10);
      }

      // Handle username update
      if (userName) {
        const existingUser = await User.findOne({
          userName,
          _id: { $ne: userId },
        });
        if (existingUser) {
          throw new AppError(
            "Username already taken.",
            HttpStatusCodes.BAD_REQUEST
          );
        }
        updates.userName = userName;
      }

      if (Object.keys(updates).length > 0) {
        Object.assign(userToUpdate, updates);
        await userToUpdate.save();
      }

      return {
        message: "Profile updated successfully.",
        success: true,
        data: {
          userName: userToUpdate.userName,
          profilePhoto: userToUpdate.profilePhoto,
          email: userToUpdate.email,
        },
      };
    } catch (error) {
      throw new AppError(
        error.message || "Failed to update profile.",
        error.statusCode || HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  static processImage = async (data) => {
    try {
      const {
        fileBase64,
        promptType,
        customPrompt,
        text,
        userId,
        useEnhancedPrompts = false,
      } = data;

      if (!fileBase64 && !text) {
        throw new Error("Either file data or text is required");
      }

      // Extract content type from base64 string if file is provided
      let contentType,
        base64Data,
        extractedText = "",
        fileInfo = {};

      if (fileBase64) {
        const contentTypeMatch = fileBase64.match(/^data:(.*?);base64,/);
        if (!contentTypeMatch) {
          throw new Error("Invalid file format");
        }

        contentType = contentTypeMatch[1];
        base64Data = fileBase64.split(",")[1];

        // Handle different file types
        if (contentType.startsWith("image/")) {
          const buffer = Buffer.from(base64Data, "base64");
          fileInfo = {
            size: buffer.length,
            type: contentType,
            dimensions: null,
          };
          extractedText = "Image file - No text content to analyze";
        } else if (contentType === "application/pdf") {
          const pdfData = await extractPdfText(base64Data);
          extractedText = pdfData.text;
          fileInfo = {
            numPages: pdfData.numPages,
            pdfInfo: pdfData.info,
          };
        } else if (
          contentType === "text/plain" ||
          contentType === "text/csv" ||
          contentType === "text/html"
        ) {
          const buffer = Buffer.from(base64Data, "base64");
          extractedText = buffer.toString("utf-8");
          fileInfo = {
            size: buffer.length,
            type: contentType,
          };
        } else {
          throw new Error(
            "Unsupported file type. Only images, PDFs, and text files are allowed"
          );
        }
      } else {
        // If text is provided directly
        extractedText = text;
        contentType = "text/plain";
        fileInfo = {
          size: text.length,
          type: "text/plain",
        };
      }

      // Extract DNA markers if this is a DNA analysis
      let extractedMarkers = [];
      const isDNAAnalysis =
        promptType === "DNA_ANALYSIS" ||
        promptType === "DNA_ANALYSIS_ENHANCED" ||
        promptType === "DNA_ANALYSIS_COMPREHENSIVE";

      if (isDNAAnalysis && extractedText) {
        console.log("🧬 Extracting DNA markers from uploaded file...");
        extractedMarkers = DNAService.extractDNAMarkers(extractedText);
        console.log(
          `🎯 DNA extraction complete! Found ${extractedMarkers.length} target markers`
        );
      }

      // Process with ChatGPT only if it's NOT a DNA analysis
      let chatGPTResponse = null;
      if (promptType && extractedText && !isDNAAnalysis) {
        console.log("Processing with ChatGPT...");
        chatGPTResponse = await processWithChatGPT(
          extractedText,
          promptType,
          customPrompt,
          useEnhancedPrompts
        );
        console.log(
          "ChatGPT response received:",
          JSON.stringify(chatGPTResponse, null, 2)
        );

        // If userId is provided, save the analysis data
        if (userId && chatGPTResponse && chatGPTResponse.analysis) {
          console.log("Saving analysis data for user:", userId);
          const saveResult = await UserService.saveAnalysisData(userId, {
            promptType,
            analysis: chatGPTResponse.analysis,
          });
          console.log("Analysis data save result:", saveResult);
        }
      }

      // For DNA analysis, save extracted markers directly without ChatGPT
      if (isDNAAnalysis && userId && extractedMarkers.length > 0) {
        console.log("🧬 Saving DNA markers directly for user:", userId);
        const dnaAnalysisData = {
          markers: extractedMarkers.map((marker) => ({
            rs_number: marker.rsid,
            value: `${marker.allele1}/${marker.allele2}`,
            chromosome: marker.chromosome,
            position: marker.position,
            genotype: `${marker.allele1}${marker.allele2}`,
          })),
          metadata: {
            total_markers_found: extractedMarkers.length,
            analysis_date: new Date().toISOString(),
            last_updated: new Date(),
            report_type: "extracted_only",
          },
        };

        const saveResult = await DNAService.saveAnalysisData(userId, {
          promptType,
          analysis: { dna_analysis: dnaAnalysisData },
        });
        console.log("DNA markers save result:", saveResult);
      }

      return {
        success: true,
        data: {
          fileType: contentType.startsWith("image/")
            ? "image"
            : contentType === "application/pdf"
            ? "pdf"
            : "text",
          contentType,
          fileInfo,
          extractedMarkers:
            extractedMarkers.length > 0 ? extractedMarkers : undefined,
          chatGPTAnalysis: chatGPTResponse,
          isDNAAnalysis: isDNAAnalysis,
        },
      };
    } catch (error) {
      console.error("Error in processImage:", error);
      return {
        success: false,
        message: error.message || "Failed to process file",
      };
    }
  };

  static async saveAnalysisData(userId, analysisData) {
    try {
      console.log(
        `[SaveAnalysisData] Starting saveAnalysisData for userId: ${userId}`
      );
      console.log(
        `[SaveAnalysisData] Analysis data received:`,
        JSON.stringify(analysisData, null, 2)
      );

      const { promptType, analysis } = analysisData;

      // Prepare update data based on prompt type
      const updateData = {};

      if (
        promptType === "DNA_ANALYSIS" ||
        promptType === "DNA_ANALYSIS_ENHANCED" ||
        promptType === "DNA_ANALYSIS_COMPREHENSIVE"
      ) {
        console.log("Processing DNA Analysis data");

        if (promptType === "DNA_ANALYSIS_COMPREHENSIVE") {
          // Handle comprehensive DNA analysis with Fitra360 structure
          if (analysis.meta && analysis.sections) {
            console.log(
              "Processing comprehensive DNA analysis with Fitra360 structure"
            );

            // Extract all SNPs from all sections into a unified markers array
            const allMarkers = [];
            Object.keys(analysis.sections).forEach((sectionKey) => {
              const section = analysis.sections[sectionKey];
              if (section.traits && Array.isArray(section.traits)) {
                section.traits.forEach((trait) => {
                  if (trait.snpsUsed && Array.isArray(trait.snpsUsed)) {
                    trait.snpsUsed.forEach((snp) => {
                      allMarkers.push({
                        rs_number: snp.rsid,
                        value: snp.genotype,
                        category: section.title,
                        interpretation: trait.result,
                        notes: trait.whyItMatters,
                        trait_name: trait.name,
                        status: trait.status,
                        evidence: trait.evidence,
                        impact: trait.impact,
                        action: trait.action,
                      });
                    });
                  }
                });
              }
            });

            updateData.dnaAnalysis = {
              markers: allMarkers,
              comprehensiveReport: analysis, // Store the full Fitra360 report
              metadata: {
                ...analysis.meta,
                total_markers_found: allMarkers.length,
                total_snps_parsed: analysis.meta.totalSnpsParsed || 0,
                recognized_snps_count: analysis.meta.recognizedSnpsCount || 0,
                input_snp_count: analysis.meta.inputSnpCount || 0,
                analysis_date:
                  analysis.meta.generatedAt || new Date().toISOString(),
                last_updated: new Date(),
                report_type: "comprehensive",
              },
            };
          } else {
            throw new Error(
              "Invalid comprehensive DNA analysis structure: missing meta or sections"
            );
          }
        } else if (analysis.dna_analysis) {
          // Handle standard and enhanced DNA analysis structure
          let markers = analysis.dna_analysis.markers;
          if (promptType === "DNA_ANALYSIS_ENHANCED") {
            // Enhanced format includes category and interpretation
            markers = markers.map((marker) => ({
              rs_number: marker.rs_number,
              value: marker.value,
              category: marker.category || "",
              interpretation: marker.interpretation || "",
              notes: marker.notes || marker.interpretation || "",
            }));
          }

          updateData.dnaAnalysis = {
            markers: markers,
            metadata: {
              ...analysis.dna_analysis.metadata,
              last_updated: new Date(),
              report_type:
                promptType === "DNA_ANALYSIS_ENHANCED"
                  ? "enhanced"
                  : "standard",
            },
          };
        } else {
          throw new Error(
            "Invalid DNA analysis structure: missing dna_analysis"
          );
        }

        console.log(
          "DNA Analysis update data prepared:",
          JSON.stringify(updateData, null, 2)
        );
      } else if (
        (promptType === "BLOOD_REPORT" ||
          promptType === "BLOOD_REPORT_ENHANCED") &&
        analysis.blood_report
      ) {
        console.log("Processing Blood Report data");
        console.log("Prompt type:", promptType);
        console.log(
          "Original blood report structure:",
          JSON.stringify(analysis.blood_report, null, 2)
        );
        console.log("Results type:", typeof analysis.blood_report.results);
        console.log(
          "Results is array:",
          Array.isArray(analysis.blood_report.results)
        );

        // Handle different blood report structures
        let results;
        if (Array.isArray(analysis.blood_report.results)) {
          // Enhanced format: flat array of results
          console.log(
            "Converting enhanced blood report format to categorized format"
          );
          console.log(
            "Original results array length:",
            analysis.blood_report.results.length
          );

          results = {
            cbc: [],
            chemistry: [],
            lipids: [],
            hormones: [],
            vitamins: [],
            other: [],
          };

          // Categorize the flat results
          analysis.blood_report.results.forEach((test, index) => {
            const testName = test.test_name?.toLowerCase() || "";
            console.log(
              `Categorizing test ${index + 1}: ${test.test_name} -> ${testName}`
            );

            // Categorize based on test name
            if (
              testName.includes("hemoglobin") ||
              testName.includes("rbc") ||
              testName.includes("wbc") ||
              testName.includes("platelet") ||
              testName.includes("hematocrit") ||
              testName.includes("mcv") ||
              testName.includes("mch") ||
              testName.includes("mchc") ||
              testName.includes("rdw") ||
              testName.includes("neutrophil") ||
              testName.includes("lymphocyte") ||
              testName.includes("eosinophil") ||
              testName.includes("monocyte") ||
              testName.includes("basophil") ||
              testName.includes("mpv")
            ) {
              results.cbc.push(test);
              console.log(`  -> Added to CBC`);
            } else if (
              testName.includes("cholesterol") ||
              testName.includes("hdl") ||
              testName.includes("ldl") ||
              testName.includes("triglyceride") ||
              testName.includes("vldl")
            ) {
              results.lipids.push(test);
              console.log(`  -> Added to Lipids`);
            } else if (
              testName.includes("tsh") ||
              testName.includes("t3") ||
              testName.includes("t4") ||
              testName.includes("psa") ||
              testName.includes("hormone")
            ) {
              results.hormones.push(test);
              console.log(`  -> Added to Hormones`);
            } else if (
              testName.includes("vitamin") ||
              testName.includes("b12") ||
              testName.includes("d")
            ) {
              results.vitamins.push(test);
              console.log(`  -> Added to Vitamins`);
            } else if (
              testName.includes("glucose") ||
              testName.includes("sugar") ||
              testName.includes("hba1c") ||
              testName.includes("bilirubin") ||
              testName.includes("protein") ||
              testName.includes("albumin") ||
              testName.includes("globulin") ||
              testName.includes("iron") ||
              testName.includes("tibc") ||
              testName.includes("transferrin") ||
              testName.includes("homocysteine") ||
              testName.includes("microalbumin")
            ) {
              results.chemistry.push(test);
              console.log(`  -> Added to Chemistry`);
            } else {
              results.other.push(test);
              console.log(`  -> Added to Other`);
            }
          });

          console.log("Categorization complete:");
          console.log("  CBC:", results.cbc.length, "tests");
          console.log("  Chemistry:", results.chemistry.length, "tests");
          console.log("  Lipids:", results.lipids.length, "tests");
          console.log("  Hormones:", results.hormones.length, "tests");
          console.log("  Vitamins:", results.vitamins.length, "tests");
          console.log("  Other:", results.other.length, "tests");
        } else {
          // Original format: already categorized
          results = analysis.blood_report.results;
          console.log("Using original categorized format");
        }

        console.log(
          "Final results structure:",
          JSON.stringify(results, null, 2)
        );
        console.log("Results type:", typeof results);
        console.log("Results is array:", Array.isArray(results));
        console.log("Results keys:", Object.keys(results));

        // SAFETY CHECK: If results is still an array (which shouldn't happen), force categorization
        if (Array.isArray(results)) {
          console.error(
            "ERROR: Results is still an array after categorization! Forcing categorization..."
          );

          // Force categorization of the array
          const forcedResults = {
            cbc: [],
            chemistry: [],
            lipids: [],
            hormones: [],
            vitamins: [],
            other: [],
          };

          results.forEach((test, index) => {
            const testName = test.test_name?.toLowerCase() || "";
            console.log(
              `Force categorizing test ${index + 1}: ${
                test.test_name
              } -> ${testName}`
            );

            if (
              testName.includes("hemoglobin") ||
              testName.includes("rbc") ||
              testName.includes("wbc") ||
              testName.includes("platelet") ||
              testName.includes("hematocrit") ||
              testName.includes("mcv") ||
              testName.includes("mch") ||
              testName.includes("mchc") ||
              testName.includes("rdw") ||
              testName.includes("neutrophil") ||
              testName.includes("lymphocyte") ||
              testName.includes("eosinophil") ||
              testName.includes("monocyte") ||
              testName.includes("basophil") ||
              testName.includes("mpv")
            ) {
              forcedResults.cbc.push(test);
            } else if (
              testName.includes("cholesterol") ||
              testName.includes("hdl") ||
              testName.includes("ldl") ||
              testName.includes("triglyceride") ||
              testName.includes("vldl")
            ) {
              forcedResults.lipids.push(test);
            } else if (
              testName.includes("tsh") ||
              testName.includes("t3") ||
              testName.includes("t4") ||
              testName.includes("psa") ||
              testName.includes("hormone")
            ) {
              forcedResults.hormones.push(test);
            } else if (
              testName.includes("vitamin") ||
              testName.includes("b12") ||
              testName.includes("d")
            ) {
              forcedResults.vitamins.push(test);
            } else if (
              testName.includes("glucose") ||
              testName.includes("sugar") ||
              testName.includes("hba1c") ||
              testName.includes("bilirubin") ||
              testName.includes("protein") ||
              testName.includes("albumin") ||
              testName.includes("globulin") ||
              testName.includes("iron") ||
              testName.includes("tibc") ||
              testName.includes("transferrin") ||
              testName.includes("homocysteine") ||
              testName.includes("microalbumin")
            ) {
              forcedResults.chemistry.push(test);
            } else {
              forcedResults.other.push(test);
            }
          });

          results = forcedResults;
          console.log(
            "Forced categorization complete. New results structure:",
            JSON.stringify(results, null, 2)
          );
        }

        // Validate the results structure before creating updateData
        if (Array.isArray(results)) {
          console.error(
            "ERROR: Results is still an array after forced categorization!"
          );
          throw new Error(
            "Failed to categorize blood report results - results is still an array after forced categorization"
          );
        }

        if (
          !results.cbc &&
          !results.chemistry &&
          !results.lipids &&
          !results.hormones &&
          !results.vitamins &&
          !results.other
        ) {
          console.error(
            "ERROR: Results object is missing expected categories!"
          );
          console.log("Available keys:", Object.keys(results));
          throw new Error(
            "Failed to categorize blood report results - missing expected categories"
          );
        }

        updateData.bloodReport = {
          patient_info: analysis.blood_report.patient_info,
          results: results,
          metadata: {
            ...analysis.blood_report.metadata,
            last_updated: new Date(),
          },
        };
        console.log(
          "Blood Report update data prepared:",
          JSON.stringify(updateData, null, 2)
        );
        console.log(
          "Final updateData.bloodReport.results type:",
          typeof updateData.bloodReport.results
        );
        console.log(
          "Final updateData.bloodReport.results is array:",
          Array.isArray(updateData.bloodReport.results)
        );
      } else {
        console.error("Invalid analysis data or prompt type:", {
          promptType,
          analysis,
        });
        throw new Error("Invalid analysis data or prompt type");
      }

      // First, check if user profile exists
      console.log("Checking for existing user profile...");
      let userProfile = await UserProfile.findOne({ userId });
      console.log("Existing profile found:", userProfile ? "Yes" : "No");

      if (!userProfile) {
        console.log("Creating new user profile...");
        // Create new user profile if it doesn't exist
        userProfile = new UserProfile({
          userId,
          ...updateData,
        });
        console.log(
          "New profile object created:",
          JSON.stringify(userProfile, null, 2)
        );
        await userProfile.save();
        console.log("New profile saved successfully");
      } else {
        console.log("Updating existing profile...");

        // For blood reports, handle the update more carefully
        if (updateData.bloodReport) {
          console.log("Handling blood report update...");
          console.log(
            "Update data structure:",
            JSON.stringify(updateData.bloodReport, null, 2)
          );

          // First, completely remove the existing blood report
          console.log("Removing existing blood report...");
          await UserProfile.updateOne(
            { userId },
            { $unset: { bloodReport: 1 } }
          );
          console.log("Existing blood report removed");

          // Then add the new blood report
          console.log("Adding new blood report...");
          console.log(
            "Setting bloodReport with structure:",
            JSON.stringify(updateData.bloodReport, null, 2)
          );

          userProfile = await UserProfile.findOneAndUpdate(
            { userId },
            { $set: { bloodReport: updateData.bloodReport } },
            { new: true, runValidators: true, upsert: false }
          );
          console.log("Blood report updated successfully");
        }

        // Handle DNA analysis update
        if (updateData.dnaAnalysis) {
          console.log("Updating DNA analysis...");
          userProfile = await UserProfile.findOneAndUpdate(
            { userId },
            { $set: { dnaAnalysis: updateData.dnaAnalysis } },
            { new: true, runValidators: true, upsert: false }
          );
          console.log("DNA analysis updated successfully");
        }
      }

      if (!userProfile) {
        console.error("Failed to create or update user profile");
        throw new Error("Failed to create or update user profile");
      }

      // Set isUpdated to true since we've modified the profile with new analysis data
      console.log(
        `[SaveAnalysisData] Setting isUpdated = true after saving ${promptType} data`
      );
      console.log(
        `[SaveAnalysisData] Previous isUpdated value: ${userProfile.isUpdated}`
      );

      userProfile.isUpdated = true;
      await userProfile.save();

      console.log(
        `[SaveAnalysisData] New isUpdated value: ${userProfile.isUpdated}`
      );
      console.log(
        `[SaveAnalysisData] ✅ ${promptType} data saved successfully and profile marked as updated`
      );

      console.log("Final profile state:", JSON.stringify(userProfile, null, 2));

      return {
        success: true,
        message: `${promptType} data saved successfully`,
        data: userProfile,
      };
    } catch (error) {
      console.error("Error in saveAnalysisData:", error);
      return {
        success: false,
        message: error.message || "Failed to save analysis data",
      };
    }
  }

  static async getDashboardInsight(userId, useEnhancedPrompts = false) {
    console.log(
      `[DashboardInsight] Starting dashboard insight generation for userId: ${userId}`
    );

    const profile = await UserProfile.findOne({ userId });
    if (!profile) throw new Error("User profile not found.");

    console.log(
      `[DashboardInsight] Profile found - isUpdated: ${profile.isUpdated}`
    );
    console.log(
      `[DashboardInsight] Dashboard insight exists: ${!!profile.dashboardInsight}`
    );
    console.log(
      `[DashboardInsight] Last analyzed at: ${
        profile.dashboardInsight?.lastAnalyzedAt || "Never"
      }`
    );

    // Prepare a summary object with only the fields you want ChatGPT to use
    const realAge = profile.dateOfBirth
      ? new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()
      : null;
    const wellnessScore = profile.wellnessScore || null;
    // Add more fields as needed
    const userProfileSummary = {
      realAge,
      wellnessScore,
      // Add more fields as needed from profile
      // e.g., sleep, nutrition, fitness, mind, recent logs, etc.
    };

    // If never analyzed or profile has been updated since last analysis, run ChatGPT
    const shouldCallAPI =
      !profile.dashboardInsight ||
      !profile.dashboardInsight.lastAnalyzedAt ||
      profile.isUpdated === true;

    console.log(`[DashboardInsight] Should call ChatGPT API: ${shouldCallAPI}`);
    console.log(
      `[DashboardInsight] Reasons: dashboardInsight exists=${!!profile.dashboardInsight}, lastAnalyzedAt=${!!profile
        .dashboardInsight?.lastAnalyzedAt}, isUpdated=${profile.isUpdated}`
    );

    if (shouldCallAPI) {
      console.log(
        `[DashboardInsight] 🔄 CALLING CHATGPT API - Profile has been updated or never analyzed`
      );

      // Choose the appropriate prompt template
      const promptTemplates = useEnhancedPrompts
        ? ENHANCED_PROMPT_TEMPLATES
        : PROMPT_TEMPLATES;
      const promptType = useEnhancedPrompts
        ? "DASHBOARD_SUMMARY_ENHANCED"
        : "DASHBOARD_SUMMARY";

      console.log(
        `[DashboardInsight] Using prompt type: ${promptType}, Enhanced: ${useEnhancedPrompts}`
      );

      // Prepare the prompt with injected user data
      const prompt = promptTemplates[promptType].replace(
        "{USER_PROFILE_JSON}",
        JSON.stringify(userProfileSummary, null, 2)
      );
      console.log(
        `[DashboardInsight] Calling ChatGPT with user profile data...`
      );

      const chatGptResult = await processWithChatGPT(
        "",
        promptType,
        prompt,
        useEnhancedPrompts
      );
      console.log(`[DashboardInsight] ChatGPT API call completed successfully`);

      // Overwrite with real values after getting the result
      const dashboard = chatGptResult.analysis || {};
      // Fallbacks for required fields
      dashboard.wellnessScore = dashboard.wellnessScore || {
        value: wellnessScore || 0,
        trend: "",
        insight: "",
      };
      dashboard.biologicalAge = dashboard.biologicalAge || {
        value: null,
        realAge: realAge || null,
        insight: "",
      };
      dashboard.healthInsights = dashboard.healthInsights || {
        sleep: { rating: "", duration: "", score: 0, insight: "" },
        nutrition: { status: "", keyNutrientsFlagged: [], tip: "" },
        fitness: { activityLevel: "", exerciseFrequency: "", tip: "" },
        mind: { status: "", moodScore: 0, insight: "" },
      };
      dashboard.scoreBreakdown = Array.isArray(dashboard.scoreBreakdown)
        ? dashboard.scoreBreakdown
        : [];
      dashboard.biologicalAgeFactors = Array.isArray(
        dashboard.biologicalAgeFactors
      )
        ? dashboard.biologicalAgeFactors
        : [];
      dashboard.personalizedPlan = Array.isArray(dashboard.personalizedPlan)
        ? dashboard.personalizedPlan
        : [];
      dashboard.smartUpdates = Array.isArray(dashboard.smartUpdates)
        ? dashboard.smartUpdates
        : [];
      // Overwrite with real values
      if (dashboard.biologicalAge) dashboard.biologicalAge.realAge = realAge;
      if (dashboard.wellnessScore)
        dashboard.wellnessScore.value = wellnessScore;
      // Add more overwrites as needed

      // Save the result and timestamp, and reset isUpdated flag
      console.log(`[DashboardInsight] Saving ChatGPT result to database...`);
      console.log(
        `[DashboardInsight] Previous isUpdated value: ${profile.isUpdated}`
      );

      // Use findOneAndUpdate to avoid triggering pre-save middleware
      console.log(
        `[DashboardInsight] Using findOneAndUpdate to save dashboard insight and reset isUpdated flag`
      );
      const updatedProfile = await UserProfile.findOneAndUpdate(
        { userId },
        {
          dashboardInsight: {
            result: { ...chatGptResult, analysis: dashboard },
            lastAnalyzedAt: new Date(),
          },
          isUpdated: false, // Reset the isUpdated flag after analysis
        },
        { new: true, runValidators: true }
      );

      console.log(
        `[DashboardInsight] New isUpdated value: ${updatedProfile.isUpdated}`
      );
      console.log(
        `[DashboardInsight] Last analyzed at: ${updatedProfile.dashboardInsight.lastAnalyzedAt}`
      );
      console.log(
        `[DashboardInsight] ✅ Dashboard insight saved successfully - API call completed`
      );

      return {
        fromCache: false,
        dashboard: { ...chatGptResult, analysis: dashboard },
      };
    } else {
      // Return cached result
      console.log(
        `[DashboardInsight] 📋 RETURNING CACHED RESULT - Profile not updated since last analysis`
      );
      console.log(
        `[DashboardInsight] Cached result from: ${profile.dashboardInsight.lastAnalyzedAt}`
      );
      return { fromCache: true, dashboard: profile.dashboardInsight.result };
    }
  }

  static async generatePersonalizedPlan(userId) {
    try {
      const profile = await UserProfile.findOne({ userId });
      if (!profile) throw new Error("User profile not found");

      // Get user data for context
      const user = await User.findById(userId);
      const userName = user?.fullName || "User";

      // Prepare supplements/medicines dynamically
      const supplements = (profile.supplementsAndMedications || []).map(
        (sup) => ({
          name: sup.name,
          dosage: sup.dosage || "",
          timing: sup.timing || "",
          reason: sup.purpose || "",
        })
      );

      // Prepare DNA, blood, and symptom data with better structure
      const dnaReport = profile.dnaAnalysis || {};
      const bloodReport = profile.bloodReport || {};

      // For symptoms, use dailyLogs or a summary if available
      let symptomSummary = {};
      if (Array.isArray(profile.dailyLogs) && profile.dailyLogs.length > 0) {
        // Example: summarize last 30 days
        const last30 = profile.dailyLogs.slice(-30);
        const symptoms = {};
        last30.forEach((log) => {
          (log.symptoms || []).forEach((sym) => {
            if (!symptoms[sym.name]) symptoms[sym.name] = [];
            symptoms[sym.name].push(sym.severity);
          });
        });
        symptomSummary = { logs: last30, summary: symptoms };
      }

      // Build comprehensive prompt matching exact UI structure
      const prompt = `You are a health assistant. Analyze the following user data and generate a comprehensive JSON object that matches the exact UI structure needed for the Fitra360 app screens.

IMPORTANT: Return ONLY the JSON object with this EXACT structure (NO DOUBLE NESTING):

{
  "success": true,
  "data": {
    "reports": {
      "dnaReport": {
        "uploadStatus": "",
        "fileUploaded": "",
        "snpsRead": "",
        "sections": [
          {
            "title": "Methylation & Detox",
            "icon": "methylation",
            "status": "",
            "statusColor": "",
            "genes": [],
            "summary": ""
          },
          {
            "title": "Vitamin Needs",
            "icon": "vitamins",
            "status": "",
            "statusColor": "",
            "nutrients": [],
            "summary": ""
          },
          {
            "title": "Inflammation & Immune",
            "icon": "inflammation",
            "status": "",
            "statusColor": "",
            "markers": [],
            "summary": "",
            "detailedExplanation": ""
          },
          {
            "title": "Fitness & Recovery",
            "icon": "fitness",
            "status": "",
            "statusColor": "",
            "genes": [],
            "summary": ""
          },
          {
            "title": "Brain & Mood",
            "icon": "brain",
            "status": "",
            "statusColor": "",
            "genes": [],
            "summary": ""
          },
          {
            "title": "Cancer Risk",
            "icon": "cancer",
            "status": "",
            "statusColor": "",
            "genes": [],
            "summary": ""
          }
        ],
        "aiSuggestion": {
          "title": "AI Suggestion",
          "icon": "ai",
          "description": "",
          "suggestion": ""
        }
      },
      "bloodWorkReport": {
        "lastUpload": "",
        "keyBiomarkers": [],
        "aiInterpretation": [],
        "suggestedNextSteps": []
      },
      "symptomTracker": {
        "summary": "",
        "period": "30 days",
        "symptoms": [
          {
            "name": "",
            "description": "",
            "status": "",
            "statusColor": "",
            "trendData": []
          }
        ]
      }
    },
    "personalizedPlan": {
      "userName": "${userName}",
      "subtitle": "Generated from your data and goals",
      "sections": [
        {
          "type": "Supplements",
          "icon": "supplements",
          "title": "Recommended Supplements",
          "subtitle": "Based on your DNA, labs and symptoms, these supplements are recommended to support your current health status.",
          "items": [],
          "generalTip": {
            "icon": "lightbulb",
            "text": ""
          }
        },
        {
          "type": "Nutrition",
          "icon": "nutrition",
          "title": "Your Nutrition Plan",
          "subtitle": "Personalized food guidance based on your biology and goals.",
          "items": []
        },
        {
          "type": "Movement",
          "icon": "movement",
          "title": "Your Movement Plan",
          "subtitle": "Based on your lifestyle, genetics, and goals.",
          "items": [],
          "whyRecommended": {
            "title": "Why was this recommended?",
            "explanation": ""
          }
    },
    {
      "type": "Breath work",
          "icon": "breathwork",
          "title": "Your Breathwork Plan",
          "subtitle": "Improve your well-being through focused breathing exercises",
          "items": [],
          "whyRecommended": {
            "title": "Why was this recommended?",
            "explanation": ""
          }
    },
    {
      "type": "Sleep",
          "icon": "sleep",
          "title": "Your Sleep Plan",
          "subtitle": "Optimized sleep recommendations for ${userName}.",
          "items": [],
          "whyRecommended": {
            "title": "Why was this recommended?",
            "explanation": ""
          }
        }
      ]
    }
  }
}

**CRITICAL ANALYSIS TASKS:**

1. **DNA ANALYSIS**: 
   - Extract genes from dnaReport.markers array
   - Categorize genes: MTHFR, COMT → Methylation; B vitamins → Vitamin Needs; IL6, TNF → Inflammation; etc.
   - Determine status based on genetic variants found
   - Fill genes/nutrients/markers arrays with actual gene names
   - Create meaningful summaries for each section (minimum 2-3 sentences explaining health implications)
   - **EXTRACT METADATA**: 
     - Set "uploadStatus" to "Uploaded" if dnaReport.metadata exists
     - Set "fileUploaded" to the analysis_date from dnaReport.metadata (format: "Apr 2025")
     - Set "snpsRead" to the total_markers_found from dnaReport.metadata (format: "1,115,429")
   - **GENERATE DETAILED AI SUGGESTIONS**:
     - Create comprehensive description explaining genetic findings and health implications
     - Provide specific, actionable suggestions based on genetic variants (minimum 3-4 recommendations)

2. **BLOOD WORK ANALYSIS**:
   - Extract test results from bloodReport.results
   - Identify key biomarkers (Glucose, Vitamin D, CRP, B12, etc.)
   - Determine status (Normal/Borderline/High/Low) based on reference ranges
   - Create detailed interpretations with specific health implications (minimum 2-3 sentences per biomarker)
   - Generate comprehensive suggested next steps (minimum 4-5 actionable steps)
   - **EXTRACT METADATA**:
     - Set "lastUpload" to the report_date from bloodReport.metadata (format: "Apr 5, 2025")
   - **GENERATE DETAILED INTERPRETATIONS**:
     - Explain what each biomarker means for health
     - Provide specific recommendations for improving values
     - Include lifestyle and supplement suggestions

3. **SYMPTOM ANALYSIS**:
   - Analyze symptomSummary.logs for trends
   - Calculate rating changes and determine if symptoms are improving/worsening
   - Count total symptoms and categorize by trend
   - Create detailed summary like "You've reported X symptoms over the last 30 days. Y improved, Z unchanged, W worsened."
   - **GENERATE DETAILED SYMPTOM DATA**:
     - For each symptom in symptomSummary.logs, create a symptom object with:
       - "name": symptom name (e.g., "Brain Fog", "Sleep", "Low Energy", "Anxiety", "Bloating")
       - "description": rating change (e.g., "Rated 4 → 2 last 30 days", "Rated 3 → 1 last 4 weeks")
       - "status": "Improving", "Unchanged", or "Worsening" based on rating trends
       - "statusColor": "green" for improving, "gray" for unchanged, "red" for worsening
       - "trendData": array of rating values over time for trend visualization
   - **PROVIDE IMPROVEMENT STRATEGIES**:
     - For each symptom, suggest specific strategies for improvement
     - Include lifestyle, supplement, and behavioral recommendations

4. **PERSONALIZED RECOMMENDATIONS**:
   - Generate comprehensive supplements list based on actual deficiencies (DNA + blood work) - minimum 4-5 supplements
   - Create detailed nutrition advice with specific foods, meal timing, and dietary strategies (minimum 6-8 recommendations)
   - Design comprehensive movement plan with specific exercises, frequency, intensity, and recovery protocols (minimum 5-6 recommendations)
   - Suggest detailed breathwork techniques with specific methods, timing, and benefits (minimum 3-4 techniques)
   - Create comprehensive sleep recommendations with specific protocols, timing, and environmental factors (minimum 5-6 recommendations)
   - **GENERATE DETAILED EXPLANATIONS**:
     - For each recommendation, provide comprehensive "Why was this recommended?" explanations
     - Include scientific rationale, personalization factors, and expected benefits
     - Minimum 3-4 sentences per explanation

**USER CONTEXT:**
- Name: ${userName}
- Age: ${
        profile.dateOfBirth
          ? new Date().getFullYear() -
            new Date(profile.dateOfBirth).getFullYear()
          : "Unknown"
      }
- Gender: ${profile.sexAtBirth || "Unknown"}
- Goals: ${profile.goals?.join(", ") || "General wellness"}
- Diet Type: ${profile.dietType || "Standard"}
- Exercise Level: ${profile.exerciseLevel || "Unknown"}
- Sleep Quality: ${profile.sleepQuality || "Unknown"}

**DATA TO ANALYZE:**

User profile data:
${JSON.stringify(profile.toObject())}

DNA report data:
${JSON.stringify(dnaReport)}

Blood report data:
${JSON.stringify(bloodReport)}

Symptom tracker logs:
${JSON.stringify(symptomSummary)}

**RULES:**
1. Use ONLY the real data provided above for analysis
2. Fill ALL fields with actual data analysis, not placeholders
3. Make recommendations PERSONALIZED to this specific user
4. Return ONLY the JSON object, no extra text
5. NO DOUBLE NESTING - only one success/data level
6. If data is missing, use empty arrays/strings but maintain structure
7. For supplements: include name, brand, form, dosage, frequency, timing, purpose
8. For nutrition: include specific foods to prioritize/limit, meal guidance, tips
9. For movement: include recommended activity, frequency, intensity, recovery
10. For breathwork: include technique, frequency, duration, benefits
11. For sleep: include sleep window, tips, disruptors to avoid
12. **CRITICAL**: Fill ALL empty fields with meaningful content based on user data
13. **CRITICAL**: Generate AI suggestions and interpretations for all sections
14. **CRITICAL**: Create detailed explanations for "Why was this recommended?"
15. **CRITICAL**: Provide specific, actionable recommendations for all plan sections
16. **CRITICAL**: DO NOT use any hardcoded data - generate everything from user's actual data
17. **CRITICAL**: DO NOT copy existing supplements from profile - suggest NEW supplements based on analysis
18. **CRITICAL**: Generate your own recommendations based on DNA, blood work, and symptoms analysis
19. **CRITICAL**: The JSON structure above is ONLY for reference - fill it with your own analysis and recommendations
20. **CRITICAL**: Provide DETAILED descriptions and explanations (minimum 2-3 sentences each)
21. **CRITICAL**: Include SPECIFIC recommendations with exact dosages, frequencies, and timing
22. **CRITICAL**: Generate COMPREHENSIVE explanations for all "Why was this recommended?" sections
23. **CRITICAL**: Create DETAILED AI interpretations for blood work with specific health implications
24. **CRITICAL**: Provide THOROUGH symptom analysis with specific improvement strategies
25. **CRITICAL**: Include MULTIPLE recommendations per section (at least 3-5 items each)`;

      if (!openai) throw new Error("OpenAI is not initialized");

      console.log("Sending request to OpenAI...");
      console.log("User context:", {
        userName,
        age: profile.dateOfBirth
          ? new Date().getFullYear() -
            new Date(profile.dateOfBirth).getFullYear()
          : "Unknown",
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content:
              "You are a health assistant that returns only valid JSON. Never include double nesting. Always analyze real data and provide personalized recommendations based on the user's actual profile, DNA, blood work, and symptoms.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 4000,
        response_format: { type: "json_object" },
      });

      console.log("OpenAI response received");
      const responseContent = completion.choices[0].message.content;
      console.log("Raw response content:", responseContent);

      let result;
      try {
        // First, try to parse the response directly
        result = JSON.parse(responseContent);
        console.log("Successfully parsed JSON response");
      } catch (parseError) {
        console.error("Initial JSON parse error:", parseError);
        console.error(
          "Response content that failed to parse:",
          responseContent
        );

        // Try to repair the JSON using jsonrepair
        try {
          const repaired = jsonrepair(responseContent);
          result = JSON.parse(repaired);
          console.log("Successfully repaired and parsed JSON with jsonrepair");
        } catch (repairError) {
          console.error("jsonrepair failed:", repairError);
          throw new Error(
            `Failed to parse/repair ChatGPT response: ${
              repairError.message
            }. Raw response: ${responseContent.substring(0, 200)}...`
          );
        }
      }

      // Validate the result structure and fix double nesting if present
      if (!result || typeof result !== "object") {
        throw new Error("Invalid response structure: result is not an object");
      }

      // Check for double nesting and fix it - improved detection
      if (
        result.success &&
        result.data &&
        result.data.success &&
        result.data.data
      ) {
        console.log("Detected double nesting, fixing...");
        result = result.data;
      } else if (result.data && result.data.success && result.data.data) {
        console.log("Detected nested data structure, fixing...");
        result = result.data;
      }

      // Additional validation for the final structure
      if (!result.success || !result.data) {
        console.error(
          "Invalid response structure after fixing:",
          JSON.stringify(result, null, 2)
        );
        throw new Error(
          "Invalid response structure: missing success or data fields after fixing"
        );
      }

      // Validate that we have the expected sections
      if (!result.data.reports || !result.data.personalizedPlan) {
        console.error(
          "Missing required sections in response:",
          Object.keys(result.data)
        );
        throw new Error(
          "Invalid response structure: missing reports or personalizedPlan sections"
        );
      }

      console.log(
        "Returning successful result with structure:",
        Object.keys(result.data)
      );
      return result;
    } catch (error) {
      console.error("Error in generatePersonalizedPlan:", error);
      throw new Error(`Failed to generate personalized plan: ${error.message}`);
    }
  }

  /**
   * Analyze user's DNA data using AI
   * @param {string} userId - User ID
   * @returns {Object} Analysis result
   */
  static async analyzeDna(userId) {
    try {
      console.log(`[UserService.analyzeDna] Starting DNA analysis for userId: ${userId}`);
      
      // Delegate to DNAService for the actual analysis
      const analysisResult = await DNAService.analyzeUserDna(userId);
      
      if (!analysisResult.success) {
        throw new Error(analysisResult.message || 'DNA analysis failed');
      }
      
      console.log(`[UserService.analyzeDna] DNA analysis completed successfully`);
      return analysisResult;
      
    } catch (error) {
      console.error('[UserService.analyzeDna] Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to analyze DNA',
        error: {
          type: error.name || 'AnalysisError',
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      };
    }
  }
}

module.exports = UserService;
