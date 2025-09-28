const mongoose = require("mongoose");
const http = require("http");
require("dotenv").config();
const app = require("./app"); 

const socketIo = require('socket.io');
const User = require("./src/api/v1/model/Users");
const seedDatabaseAndCreateSuperAdmin = require("./src/api/v1/utils/superAdminCreation");
const cronService = require("./src/api/v1/services/cron.service");

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.name, err.message);
  process.exit(1);
});

const dbURI = process.env.DEV_DATABASE;
console.log("db_URI ... ", dbURI);

mongoose
  .connect(dbURI)
  .then(async () => {
    // await seedDatabaseAndCreateSuperAdmin();
    // const users = await User.find({ role: "Admin" });
    // if (users.length == 0) {
      
    // }
    
    console.log("MongoDB connected successfully!");
    
    // Initialize cron jobs after database connection
    cronService.init();
  })
  .catch((err) => console.log("MongoDB connection error:", err));

const port = process.env.PORT || 3000;
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);




server.listen(port, () => {
  console.log(`App running on port ${port}`);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.name, err.message);
  process.exit(1);
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoom', (userId) => {
    socket.join(userId);
    console.log(`User joined room: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

