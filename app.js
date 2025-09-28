const createError = require("http-errors");
const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xssClean = require("xss-clean");
const hpp = require("hpp");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const globalErrorHandler = require("./src/api/v1/middlewares/globalErrorHandler");
const {
  uploadToS3,
  uploadaudiovideeToS3,
  uploadFileToS3,
} = require("./src/api/v1/services/aws.service");

if (process.env.NODE_ENV === "PRODUCTION") {
  require("dotenv").config({ path: "./.env.production" });
} else {
  require("dotenv").config();
}

const usersRoutes = require("./src/api/v1/routes/user");
const cronRoutes = require("./src/api/v1/routes/cron");
const app = express();
//const admin = require("firebase-admin");

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(helmet());

if (process.env.NODE_ENV === "DEVELOPMENT") {
  app.use(logger("dev"));
}

app.use(mongoSanitize());
app.use(xssClean());
app.use(hpp());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log incoming request
  console.log(`\n🚀 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log(`📋 Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
  console.log(`🔍 Query:`, JSON.stringify(req.query, null, 2));
  console.log(`👤 User Agent:`, req.headers['user-agent'] || 'Unknown');
  console.log(`🌐 Origin:`, req.headers['origin'] || 'No Origin');
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`✅ [${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    console.log(`📤 Response:`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    console.log(`📊 Response Headers:`, JSON.stringify(res.getHeaders(), null, 2));
    console.log('─'.repeat(80));
    
    originalSend.call(this, data);
  };
  
  next();
});

// Super simple CORS - allow everything
app.use(cors({
  origin: '*',
  credentials: false,
  methods: '*',
  allowedHeaders: '*',
  exposedHeaders: '*'
}));

// Simple fallback for any CORS issues
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.use(compression());
app.use(cookieParser());

// Routes
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/cron", cronRoutes);

app.post("/upload-image", async (req, res) => {
  try {
    const { imageBase64, contentType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: "Missing imageBase64 in request body"
      });
    }

    if (!contentType) {
      return res.status(400).json({
        success: false,
        message: "Missing contentType in request body"
      });
    }

    // Validate base64 format
    if (!imageBase64.startsWith('data:') && !imageBase64.match(/^[A-Za-z0-9+/=]+$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid base64 format"
      });
    }

    // Call the uploadImage method of the ImageUploader class
    const result = await uploadToS3(imageBase64, contentType);

    if (result.success) {
      return res.status(200).json(result); // Successful upload
    } else {
      return res.status(500).json(result); // Error during upload
    }
  } catch (error) {
    console.error("Image upload error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload image"
    });
  }
});

// Media upload handler
const s3MediaUploadB = async (file, mediaType) => {
  try {
    // Clean the base64 string
    const base64Data = file.replace(/^data:.+;base64,/, "");

    if (!base64Data) {
      throw new Error("Invalid or empty base64 data");
    }

    const buffer = Buffer.from(base64Data, "base64");

    let contentType;
    let folder;

    if (mediaType === "audio") {
      contentType = "audio/mpeg";
      folder = "audio";
    } else if (mediaType === "video") {
      contentType = "video/mp4";
      folder = "video";
    } else {
      throw new Error("Invalid media type");
    }

    return await uploadaudiovideeToS3(buffer, contentType, folder);
  } catch (error) {
    console.error("Media upload failed:", error);
    throw new Error("Media upload failed");
  }
};

// API endpoint to handle media upload
app.post("/upload-media", async (req, res) => {
  try {
    const { file, mediaType } = req.body;

    // Validate file and mediaType
    if (!file || !mediaType) {
      return res
        .status(400)
        .json({ message: "File and media type are required" });
    }

    // Validate base64 format
    if (!file.startsWith("data:")) {
      return res.status(400).json({ message: "Invalid base64 format" });
    }

    const result = await s3MediaUploadB(file, mediaType);

    res.status(200).json({
      message: "Media uploaded successfully",
      fileUrl: result,
    });
  } catch (error) {
    console.error("Media upload failed:", error);
    res.status(500).json({ message: error.message });
  }
});

app.post("/upload-file", async (req, res) => {
  const { fileBase64, contentType } = req.body;
  if (!fileBase64) {
    return res.status(400).json({ success: false, message: "Missing file or contentType" });
  }
  const result = await uploadFileToS3(fileBase64, contentType);
  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(500).json(result);
  }
});

// Catch-all route for undefined routes
app.use("*", function (req, res, next) {
  next(createError(404));
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
