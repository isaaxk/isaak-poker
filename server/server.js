const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const crypto = require('crypto');
const { PokerGame, STAGES } = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size, timestamp: Date.now() });
});

// Store active rooms and socket mappings
// rooms: Map<roomCode, { game: PokerGame, hostId: string, createdAt: number }>
const rooms = new Map();
// socketToSession: Map<socketId, { playerId: string, roomCode: string }>
const socketToSession = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(crypto.randomInt(0, chars.length));
    }
  } while (rooms.has(code));
  return code;
}

function broadcastRoomState(roomCode) {
  const roomData = rooms.get(roomCode);
  if (!roomData) return;

  const { game } = roomData;

  // Get all connected socket IDs in this room
  const socketsInRoom = io.sockets.adapter.rooms.get(roomCode);
  if (!socketsInRoom) return;

  for (const socketId of socketsInRoom) {
    const session = socketToSession.get(socketId);
    const playerId = session ? session.playerId : null;
    const privateState = game.getPlayerPrivateState(playerId);
    io.to(socketId).emit('game_state', privateState);
  }
}

io.on('connection', (socket) => {
  // --- Create Room ---
  socket.on('create_room', (data) => {
    try {
      const name = (data.name || 'Host').trim().substring(0, 20);
      const roomCode = generateRoomCode();
      const playerId = data.playerId || crypto.randomUUID();

      const bigBlind = Math.max(2, Number(data.bigBlind) || 20);
      const smallBlind = data.smallBlind !== undefined
        ? Math.max(1, Number(data.smallBlind))
        : Math.max(1, Math.floor(bigBlind / 2));
      const startingChips = Math.max(10, Number(data.startingChips) || 1000);
      const maxSeats = Math.min(Math.max(Number(data.maxSeats) || 8, 2), 20);
      const turnTimeoutMs = data.turnTimeoutSeconds !== undefined
        ? Number(data.turnTimeoutSeconds) * 1000
        : (data.turnTimeoutMs !== undefined ? Number(data.turnTimeoutMs) : 0);

      const config = {
        smallBlind,
        bigBlind,
        startingChips,
        maxSeats,
        turnTimeoutMs,
        showHandHelper: data.showHandHelper !== undefined ? Boolean(data.showHandHelper) : true
      };

      const game = new PokerGame(roomCode, config);
      game.onStateChange = () => broadcastRoomState(roomCode);

      rooms.set(roomCode, {
        game,
        hostId: playerId,
        createdAt: Date.now()
      });

      // Add host to seat 0
      const seatResult = game.addPlayer({
        id: playerId,
        name,
        socketId: socket.id,
        chips: config.startingChips
      }, 0);

      socket.join(roomCode);
      socketToSession.set(socket.id, { playerId, roomCode });

      socket.emit('room_created', {
        roomCode,
        playerId,
        isHost: true,
        seatIndex: seatResult.seatIndex
      });

      broadcastRoomState(roomCode);
    } catch (err) {
      console.error('Error in create_room:', err);
      socket.emit('error_message', { message: 'Failed to create room' });
    }
  });

  // --- Update Room Settings (Host only) ---
  socket.on('update_room_settings', (data) => {
    try {
      const session = socketToSession.get(socket.id);
      if (!session) return;

      const roomData = rooms.get(session.roomCode);
      if (!roomData) return;

      if (roomData.hostId !== session.playerId) {
        return socket.emit('error_message', { message: 'Only the host can modify room settings' });
      }

      const newConfig = {};
      if (data.turnTimeoutSeconds !== undefined) {
        newConfig.turnTimeoutMs = Number(data.turnTimeoutSeconds) * 1000;
      } else if (data.turnTimeoutMs !== undefined) {
        newConfig.turnTimeoutMs = Number(data.turnTimeoutMs);
      }
      if (data.maxSeats !== undefined) {
        newConfig.maxSeats = Math.min(Math.max(Number(data.maxSeats), 2), 20);
      }
      if (data.bigBlind !== undefined) {
        newConfig.bigBlind = Math.max(2, Number(data.bigBlind));
        newConfig.smallBlind = data.smallBlind !== undefined
          ? Math.max(1, Number(data.smallBlind))
          : Math.max(1, Math.floor(newConfig.bigBlind / 2));
      } else if (data.smallBlind !== undefined) {
        newConfig.smallBlind = Math.max(1, Number(data.smallBlind));
      }
      if (data.startingChips !== undefined) {
        newConfig.startingChips = Math.max(10, Number(data.startingChips));
      }
      if (data.showHandHelper !== undefined) {
        newConfig.showHandHelper = Boolean(data.showHandHelper);
      }

      roomData.game.updateConfig(newConfig);
      broadcastRoomState(session.roomCode);
      socket.emit('settings_updated', { message: 'Table settings updated!' });
    } catch (err) {
      console.error('Error in update_room_settings:', err);
    }
  });

  // --- Join Room ---
  socket.on('join_room', (data) => {
    try {
      const roomCode = (data.roomCode || '').toUpperCase().trim();
      const name = (data.name || 'Player').trim().substring(0, 20);
      const playerId = data.playerId || crypto.randomUUID();

      const roomData = rooms.get(roomCode);
      if (!roomData) {
        return socket.emit('error_message', { message: 'Room not found. Check the code and try again.' });
      }

      const { game, hostId } = roomData;

      const seatResult = game.addPlayer({
        id: playerId,
        name,
        socketId: socket.id,
        chips: Number(data.startingChips) || game.config.startingChips
      }, data.preferredSeat ?? -1);

      if (!seatResult.success) {
        return socket.emit('error_message', { message: seatResult.error });
      }

      socket.join(roomCode);
      socketToSession.set(socket.id, { playerId, roomCode });

      socket.emit('room_joined', {
        roomCode,
        playerId,
        isHost: hostId === playerId,
        seatIndex: seatResult.seatIndex
      });

      broadcastRoomState(roomCode);
    } catch (err) {
      console.error('Error in join_room:', err);
      socket.emit('error_message', { message: 'Failed to join room' });
    }
  });

  // --- Reconnect Session ---
  socket.on('reconnect_session', (data) => {
    try {
      const roomCode = (data.roomCode || '').toUpperCase().trim();
      const playerId = data.playerId;

      if (!roomCode || !playerId) {
        return socket.emit('reconnect_failed', { message: 'Invalid session credentials' });
      }

      const roomData = rooms.get(roomCode);
      if (!roomData) {
        return socket.emit('reconnect_failed', { message: 'Room no longer exists' });
      }

      const { game, hostId } = roomData;
      const player = game.getPlayer(playerId);

      if (!player) {
        return socket.emit('reconnect_failed', { message: 'Player seat not found' });
      }

      // Re-attach player to socket
      player.socketId = socket.id;
      player.disconnected = false;

      socket.join(roomCode);
      socketToSession.set(socket.id, { playerId, roomCode });

      socket.emit('reconnect_success', {
        roomCode,
        playerId,
        isHost: hostId === playerId,
        seatIndex: player.seatIndex
      });

      game.log(`${player.name} restored connection.`);
      broadcastRoomState(roomCode);
    } catch (err) {
      console.error('Error in reconnect_session:', err);
      socket.emit('reconnect_failed', { message: 'Reconnection error' });
    }
  });

  // --- Start Game ---
  socket.on('start_game', () => {
    try {
      const session = socketToSession.get(socket.id);
      if (!session) return;

      const roomData = rooms.get(session.roomCode);
      if (!roomData) return;

      const result = roomData.game.startGame();
      if (!result.success) {
        socket.emit('error_message', { message: result.error });
      }
    } catch (err) {
      console.error('Error in start_game:', err);
    }
  });

  // --- Player Action ---
  socket.on('player_action', (data) => {
    try {
      const session = socketToSession.get(socket.id);
      if (!session) return;

      const roomData = rooms.get(session.roomCode);
      if (!roomData) return;

      const result = roomData.game.handlePlayerAction(session.playerId, data.action, data.amount);
      if (!result.success) {
        socket.emit('error_message', { message: result.error });
      }
    } catch (err) {
      console.error('Error in player_action:', err);
    }
  });

  // --- Rebuy (Creator / Host or Bankrupt Player) ---
  socket.on('rebuy', (data) => {
    try {
      const session = socketToSession.get(socket.id);
      if (!session) return;

      const roomData = rooms.get(session.roomCode);
      if (!roomData) return;

      const reloadAmount = Number(data?.amount) || roomData.game.config.startingChips || 1000;
      const targetPlayerId = data?.targetPlayerId;

      if (roomData.hostId === session.playerId) {
        if (targetPlayerId === 'all') {
          roomData.game.getSeatedPlayers().forEach(p => {
            if (p.chips === 0) {
              roomData.game.rebuy(p.id, reloadAmount);
            }
          });
        } else if (targetPlayerId) {
          roomData.game.rebuy(targetPlayerId, reloadAmount);
        } else {
          roomData.game.rebuy(session.playerId, reloadAmount);
        }
      } else {
        // Player reloading their own bankrupt chips
        const player = roomData.game.getPlayer(session.playerId);
        if (player && player.chips === 0) {
          roomData.game.rebuy(session.playerId, reloadAmount);
        } else if (player && player.chips > 0) {
          return socket.emit('error_message', { message: 'You still have chips!' });
        } else {
          return socket.emit('error_message', { message: 'Only the room creator can reload table chips' });
        }
      }
    } catch (err) {
      console.error('Error in rebuy:', err);
    }
  });

  // --- Edit Player Chips (Host only) ---
  socket.on('edit_player_chips', (data) => {
    try {
      const session = socketToSession.get(socket.id);
      if (!session) return;

      const roomData = rooms.get(session.roomCode);
      if (!roomData) return;

      if (roomData.hostId !== session.playerId) {
        return socket.emit('error_message', { message: 'Only the room creator can edit player chips' });
      }

      const targetPlayerId = data?.targetPlayerId;
      const newAmount = Number(data?.amount);

      if (!targetPlayerId || !Number.isFinite(newAmount) || newAmount < 0) {
        return socket.emit('error_message', { message: 'Invalid chip amount' });
      }

      const MAX_CHIPS = 1000000000;
      const clampedAmount = Math.min(newAmount, MAX_CHIPS);

      const success = roomData.game.setPlayerChips(targetPlayerId, clampedAmount);
      if (!success) {
        return socket.emit('error_message', { message: 'Player not found' });
      }

      broadcastRoomState(session.roomCode);
    } catch (err) {
      console.error('Error in edit_player_chips:', err);
    }
  });

  // --- Kick Player (Host only) ---
  socket.on('kick_player', (data) => {
    try {
      const session = socketToSession.get(socket.id);
      if (!session) return;

      const roomData = rooms.get(session.roomCode);
      if (!roomData) return;

      if (roomData.hostId !== session.playerId) {
        return socket.emit('error_message', { message: 'Only the room creator can kick players' });
      }

      const targetPlayerId = data?.targetPlayerId;
      if (!targetPlayerId || targetPlayerId === session.playerId) {
        return socket.emit('error_message', { message: 'Invalid kick target' });
      }

      const targetPlayer = roomData.game.getPlayer(targetPlayerId);
      if (!targetPlayer) {
        return socket.emit('error_message', { message: 'Player not found' });
      }

      const targetName = targetPlayer.name;
      const targetSocketId = targetPlayer.socketId;

      roomData.game.removePlayer(targetPlayerId);
      roomData.game.log(`🚪 ${targetName} was removed from the table by the host.`);

      // Notify and disconnect the kicked player's socket, if still connected
      if (targetSocketId) {
        io.to(targetSocketId).emit('kicked', { message: 'You were removed from the room by the host.' });
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.leave(session.roomCode);
          socketToSession.delete(targetSocketId);
        }
      }

      if (roomData.game.getSeatedPlayers().length === 0) {
        rooms.delete(session.roomCode);
      } else {
        broadcastRoomState(session.roomCode);
      }
    } catch (err) {
      console.error('Error in kick_player:', err);
    }
  });

  // --- Chat Message ---
  socket.on('send_chat', (data) => {
    try {
      const session = socketToSession.get(socket.id);
      if (!session) return;

      const roomData = rooms.get(session.roomCode);
      if (!roomData) return;

      const player = roomData.game.getPlayer(session.playerId);
      const senderName = player ? player.name : 'Spectator';
      const text = (data.text || '').trim().substring(0, 150);

      if (text.length > 0) {
        io.to(session.roomCode).emit('chat_message', {
          sender: senderName,
          text,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('Error in send_chat:', err);
    }
  });

  // --- Host Stage Advance (Deal Flop/Turn/River / Reveal Winner) ---
  socket.on('host_advance_stage', (data) => {
    try {
      const session = socketToSession.get(socket.id);
      if (!session) return;

      const roomData = rooms.get(session.roomCode);
      if (!roomData) return;

      if (roomData.hostId !== session.playerId) {
        return socket.emit('error_message', { message: 'Only the room creator / host can reveal cards or the winner' });
      }

      const result = roomData.game.executeHostAction(data?.action);
      if (!result.success) {
        socket.emit('error_message', { message: result.error });
      }
    } catch (err) {
      console.error('Error in host_advance_stage:', err);
    }
  });

  // --- Leave Room ---
  socket.on('leave_room', () => {
    try {
      const session = socketToSession.get(socket.id);
      if (session) {
        const roomData = rooms.get(session.roomCode);
        if (roomData) {
          roomData.game.removePlayer(session.playerId);
          if (roomData.hostId === session.playerId) {
            const seated = roomData.game.getSeatedPlayers();
            if (seated.length > 0) {
              roomData.hostId = seated[0].id;
              roomData.game.log(`👑 ${seated[0].name} is now the table host.`);
            }
          }
          if (roomData.game.getSeatedPlayers().length === 0) {
            rooms.delete(session.roomCode);
          } else {
            broadcastRoomState(session.roomCode);
          }
        }
        socket.leave(session.roomCode);
        socketToSession.delete(socket.id);
      }
      socket.emit('left_room');
    } catch (err) {
      console.error('Error in leave_room:', err);
      socket.emit('left_room');
    }
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    try {
      const session = socketToSession.get(socket.id);
      if (!session) return;

      const roomData = rooms.get(session.roomCode);
      if (roomData) {
        roomData.game.setPlayerDisconnected(session.playerId, true);
      }
      socketToSession.delete(socket.id);
    } catch (err) {
      console.error('Error in socket disconnect:', err);
    }
  });
});

function startServer(port) {
  const onError = (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is currently busy, trying port ${port + 1}...`);
      server.close();
      setTimeout(() => startServer(port + 1), 50);
    } else {
      console.error('Server error:', err);
    }
  };

  server.once('error', onError);

  server.listen(port, () => {
    server.removeListener('error', onError);
    console.log(`\n♠♥♦♣ Texas Hold'em Poker Server running on http://localhost:${port}\n`);
  });
}

startServer(PORT);
