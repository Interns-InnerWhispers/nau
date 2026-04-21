/**
 * WebSocket Server - Real-time data updates for NAU Dashboard
 * Tier 3: WebSocket real-time push notifications
 * 
 * Runs on port 3001 (separate from REST API on port 3000)
 * Handles WebSocket connections, authentication, and real-time data broadcasting
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ── Server Setup ──────────────────────────────────────────

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'] // Fallback to polling if WebSocket not available
});

// ── Global State ──────────────────────────────────────────

const connectedUsers = new Map(); // userId → Set of socket IDs
const channelSubscriptions = new Map(); // channel → Set of socket IDs

// ── Authentication Middleware ─────────────────────────────

io.use((socket, next) => {
  try {
    const token = socket.handshake.query.token;
    
    if (!token) {
      console.log('✗ Connection rejected: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key');
    
    // Store user info in socket for later use
    socket.userId = decoded.user_id || decoded.id;
    socket.userRole = decoded.role || 'viewer';
    socket.college = decoded.college || 'default';
    socket.userName = decoded.name || `User ${socket.userId}`;

    console.log(`✓ Auth passed: User ${socket.userId} (${socket.userRole})`);
    next();
  } catch (err) {
    console.error('✗ Authentication failed:', err.message);
    next(new Error('Authentication error'));
  }
});

// ── Connection Event ──────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`✓ Socket connected: ${socket.id} (User: ${socket.userId})`);

  // Track connected user
  if (!connectedUsers.has(socket.userId)) {
    connectedUsers.set(socket.userId, new Set());
  }
  connectedUsers.get(socket.userId).add(socket.id);

  // Send initial connection confirmation
  socket.emit('connected', {
    socketId: socket.id,
    userId: socket.userId,
    userRole: socket.userRole,
    timestamp: new Date(),
    message: 'WebSocket connection established'
  });

  // ── Subscribe to Channel ──────────────────────────────

  socket.on('subscribe', (channel) => {
    try {
      // Validate channel access based on user role
      if (!canAccessChannel(socket.userRole, channel)) {
        socket.emit('error', { 
          message: `Access denied: Cannot subscribe to ${channel}`,
          channel: channel 
        });
        console.log(`✗ Access denied for ${socket.userId}: ${channel}`);
        return;
      }

      socket.join(channel);

      // Track subscription
      if (!channelSubscriptions.has(channel)) {
        channelSubscriptions.set(channel, new Set());
      }
      channelSubscriptions.get(channel).add(socket.id);

      console.log(`✓ ${socket.userId} subscribed to ${channel}`);
      socket.emit('subscribed', {
        channel: channel,
        timestamp: new Date(),
        message: `Successfully subscribed to ${channel}`
      });

      // Notify others in channel
      socket.to(channel).emit('user-joined-channel', {
        userId: socket.userId,
        userName: socket.userName,
        channel: channel,
        timestamp: new Date()
      });

    } catch (err) {
      console.error('Subscribe error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  // ── Unsubscribe from Channel ──────────────────────────

  socket.on('unsubscribe', (channel) => {
    try {
      socket.leave(channel);

      // Remove subscription tracking
      if (channelSubscriptions.has(channel)) {
        channelSubscriptions.get(channel).delete(socket.id);
        if (channelSubscriptions.get(channel).size === 0) {
          channelSubscriptions.delete(channel);
        }
      }

      console.log(`✓ ${socket.userId} unsubscribed from ${channel}`);
      socket.emit('unsubscribed', {
        channel: channel,
        timestamp: new Date(),
        message: `Successfully unsubscribed from ${channel}`
      });

      // Notify others in channel
      socket.to(channel).emit('user-left-channel', {
        userId: socket.userId,
        userName: socket.userName,
        channel: channel,
        timestamp: new Date()
      });

    } catch (err) {
      console.error('Unsubscribe error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  // ── Disconnect Handler ────────────────────────────────

  socket.on('disconnect', () => {
    console.log(`✗ Socket disconnected: ${socket.id} (User: ${socket.userId})`);

    // Clean up user tracking
    if (connectedUsers.has(socket.userId)) {
      connectedUsers.get(socket.userId).delete(socket.id);
      if (connectedUsers.get(socket.userId).size === 0) {
        connectedUsers.delete(socket.userId);
      }
    }

    // Clean up subscriptions
    for (const [channel, sockets] of channelSubscriptions.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          channelSubscriptions.delete(channel);
        }
      }
    }
  });

  // ── Error Handler ─────────────────────────────────────

  socket.on('error', (error) => {
    console.error(`✗ Socket error for ${socket.id}:`, error);
  });

  // ── Ping/Heartbeat (optional, for connection health) ────

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date() });
  });
});

// ── Helper Functions ──────────────────────────────────────

/**
 * Check if user role can access a channel
 * @param {string} userRole - User's role (admin, manager, staff, viewer)
 * @param {string} channel - Channel name (e.g., "dashboards/kpis")
 * @returns {boolean} True if access allowed
 */
function canAccessChannel(userRole, channel) {
  const channelAccess = {
    'admin': ['*'], // Admins can access everything
    'manager': ['dashboards/*', 'finance/*', 'activities/*'],
    'staff': ['dashboards/*', 'activities/*'],
    'viewer': ['dashboards/public']
  };

  const allowedChannels = channelAccess[userRole] || [];
  
  return allowedChannels.some(pattern => {
    if (pattern === '*') return true;
    if (pattern.includes('*')) {
      const prefix = pattern.replace('*', '');
      return channel.startsWith(prefix);
    }
    return channel === pattern;
  });
}

/**
 * Get statistics about current connections
 */
function getStats() {
  return {
    totalConnections: connectedUsers.size,
    totalSockets: Array.from(connectedUsers.values()).reduce((sum, set) => sum + set.size, 0),
    activeChannels: channelSubscriptions.size,
    channels: Array.from(channelSubscriptions.keys()),
    timestamp: new Date()
  };
}

// ── Data Change Event Broadcasters ────────────────────────

/**
 * Broadcast KPI data update to all subscribers
 * Called when KPI data changes via REST API
 */
function emitKPIUpdate(data) {
  io.to('dashboards/kpis').emit('kpi-updated', {
    timestamp: new Date(),
    data: data
  });
  console.log('✓ KPI update broadcast to dashboards/kpis');
}

/**
 * Broadcast schedule data update
 */
function emitScheduleUpdate(data) {
  io.to('dashboards/schedule').emit('schedule-updated', {
    timestamp: new Date(),
    data: data
  });
  console.log('✓ Schedule update broadcast to dashboards/schedule');
}

/**
 * Broadcast alerts update
 */
function emitAlertUpdate(data) {
  io.to('dashboards/alerts').emit('alert-updated', {
    timestamp: new Date(),
    data: data
  });
  console.log('✓ Alert update broadcast to dashboards/alerts');
}

/**
 * Broadcast transaction data update
 */
function emitTransactionUpdate(data) {
  io.to('finance/transactions').emit('transaction-updated', {
    timestamp: new Date(),
    data: data
  });
  console.log('✓ Transaction update broadcast to finance/transactions');
}

/**
 * Broadcast budget data update
 */
function emitBudgetUpdate(data) {
  io.to('finance/budgets').emit('budget-updated', {
    timestamp: new Date(),
    data: data
  });
  console.log('✓ Budget update broadcast to finance/budgets');
}

/**
 * Broadcast activity data update
 */
function emitActivityUpdate(data) {
  io.to('activities/calendar').emit('activity-updated', {
    timestamp: new Date(),
    data: data
  });
  console.log('✓ Activity update broadcast to activities/calendar');
}

/**
 * Broadcast notification update
 */
function emitNotificationUpdate(channel, data) {
  io.to(channel).emit('notification-updated', {
    timestamp: new Date(),
    data: data
  });
  console.log(`✓ Notification update broadcast to ${channel}`);
}

// ── REST Endpoints for Manual Testing ─────────────────────

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'WebSocket',
    uptime: process.uptime(),
    stats: getStats()
  });
});

/**
 * Get connection statistics
 */
app.get('/stats', (req, res) => {
  res.json(getStats());
});

/**
 * Manual test: Emit KPI update
 * curl http://localhost:3001/test/emit/kpi-update
 */
app.get('/test/emit/kpi-update', (req, res) => {
  emitKPIUpdate({
    id: Math.random(),
    name: 'Test KPI',
    value: Math.random() * 100,
    change: Math.random() * 10
  });
  res.json({ message: 'KPI update emitted' });
});

/**
 * Manual test: Emit transaction update
 */
app.get('/test/emit/transaction-update', (req, res) => {
  emitTransactionUpdate({
    id: Math.random(),
    title: 'Test Transaction',
    amount: Math.random() * 1000
  });
  res.json({ message: 'Transaction update emitted' });
});

// ── Server Startup ───────────────────────────────────────

const PORT = process.env.WEBSOCKET_PORT || 3001;

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 WebSocket Server (Tier 3) Running');
  console.log('='.repeat(60));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`🔒 CORS: Enabled for frontend`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Statistics: http://localhost:${PORT}/stats`);
  console.log('='.repeat(60) + '\n');
});

// ── Graceful Shutdown ─────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✓ WebSocket server closed');
    process.exit(0);
  });
});

// ── Export for use in main API ────────────────────────────

module.exports = {
  io,
  emitKPIUpdate,
  emitScheduleUpdate,
  emitAlertUpdate,
  emitTransactionUpdate,
  emitBudgetUpdate,
  emitActivityUpdate,
  emitNotificationUpdate,
  getStats,
  server
};
