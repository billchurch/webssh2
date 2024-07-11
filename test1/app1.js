var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server, {
  path: "/ssh/socket.io",
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

var PORT = 3000;

io.on("connection", function (socket) {
  console.log("A client connected");

  socket.on("authenticate", function (credentials) {
    console.log("Received credentials:", credentials);

    // Here you would typically validate the credentials
    // For this example, we'll just echo back a success message
    var authResult = {
      success: true,
      message: "Authentication successful",
    };

    socket.emit("auth_result", authResult);
  });

  socket.on("disconnect", function () {
    console.log("A client disconnected");
  });
});

server.listen(PORT, function () {
  console.log("Server running on port " + PORT);
});
