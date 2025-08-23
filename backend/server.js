const app = require('./app');
const http = require('http');
const { Server } = require('socket.io');
const ticketCleanupService = require('./services/ticketCleanupService');

// Get port from environment and store in Express.
const port = process.env.PORT || 5050;
app.set('port', port);

// Create HTTP server.
const server = http.createServer(app);

// Handle server errors
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  // Handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`Port ${port} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`Port ${port} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: '*',
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: false,
  serveClient: false,
  path: '/socket.io/'
});

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log('New WebSocket connection');

  // Join managers room for real-time ticket notifications
  socket.on('joinManagersRoom', (managerId) => {
    socket.join('managers');
    console.log(`Manager ${managerId} joined managers room for real-time notifications`);
  });

  // Join room for ticket updates
  socket.on('joinTicketRoom', (ticketId) => {
    socket.join(`ticket_${ticketId}`);
    console.log(`User joined ticket room: ticket_${ticketId}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Make io accessible in app
app.set('io', io);

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('WebSocket server is running');
  
  // Start the ticket cleanup service
  ticketCleanupService.start();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  ticketCleanupService.stop();
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
