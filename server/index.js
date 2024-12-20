const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3001;

// Create HTTP server first
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Initialize Socket.IO with the server instance
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://your-frontend-url.com"],
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const emailToSocketMap = new Map();
const socketidToEmailMap = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on("room:join", (data) => {
    const { email, room } = data;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      socket.emit("room:error", {
        message: "Please enter a valid email address"
      });
      return;
    }

    if (emailToSocketMap.has(email)) {
      socket.emit("room:error", {
        message: "This email is already in use in another session"
      });
      return;
    }

    console.log(`User ${email} joining room ${room}`);
    emailToSocketMap.set(email, socket.id);
    socketidToEmailMap.set(socket.id, email);
    socket.join(room);
    io.to(room).emit("user:joined", { email, id: socket.id });
    io.to(socket.id).emit("room:join", data);
  });

  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incomming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log("peer:nego:needed", offer);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log("peer:nego:done", ans);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  socket.on("disconnect", () => {
    const email = socketidToEmailMap.get(socket.id);
    emailToSocketMap.delete(email);
    socketidToEmailMap.delete(socket.id);
    console.log(`User disconnected: ${email}`);
  });
});
