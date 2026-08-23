const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
// Serve static client assets with aggressive caching headers for instant image loading
app.use(express.static(path.join(__dirname), {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.mp3')) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        }
    }
}));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    allowEIO3: true
});

const rooms = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Player joins or reconnects to a room
    socket.on('join_room', ({ roomCode, playerName }) => {
        if (!roomCode || !playerName) return;

        const normalizedRoom = roomCode.trim().toLowerCase();
        const trimmedName = playerName.trim();
        socket.join(normalizedRoom);

        if (!rooms[normalizedRoom]) {
            rooms[normalizedRoom] = {
                roomCode: normalizedRoom,
                hostId: socket.id,
                players: [],
                gameStarted: false,
                initialState: null,
                currentLiveState: null,
                actionLog: []
            };
        }

        const room = rooms[normalizedRoom];

        // Check if player is reconnecting with the same name
        const existingPlayer = room.players.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());

        if (existingPlayer) {
            existingPlayer.id = socket.id;
            existingPlayer.online = true;
            console.log(`Player ${trimmedName} RECONNECTED to room ${normalizedRoom}`);
        } else {
            // New player joining
            const isHost = room.players.length === 0 || room.hostId === socket.id;
            if (isHost) room.hostId = socket.id;

            room.players.push({
                id: socket.id,
                name: trimmedName,
                isHost: isHost,
                online: true
            });
            console.log(`Player ${trimmedName} JOINED room ${normalizedRoom}`);
        }

        // Broadcast updated room info
        io.to(normalizedRoom).emit('update_room', {
            roomCode: room.roomCode,
            hostId: room.hostId,
            players: room.players,
            gameStarted: room.gameStarted
        });

        // If the game is already in progress, send the latest LIVE state to reconnecting player
        if (room.gameStarted) {
            if (room.currentLiveState) {
                socket.emit('sync_live_state', { liveState: room.currentLiveState, reconnect: true });
            } else if (room.initialState) {
                socket.emit('game_started', room.initialState);
            }
        }
    });

    // Host adds a Grandmaster AI bot to fill in player slots (up to 4 total)
    socket.on('add_bot', ({ roomCode }) => {
        if (!roomCode) return;
        const normalizedRoom = roomCode.trim().toLowerCase();
        const room = rooms[normalizedRoom];
        if (room && room.hostId === socket.id && !room.gameStarted && room.players.length < 4) {
            const existingBots = room.players.filter(p => p.isBot);
            const botNames = ['Grandmaster Bot 1', 'Grandmaster Bot 2', 'Grandmaster Bot 3'];
            const botName = botNames[existingBots.length] || `Grandmaster Bot ${existingBots.length + 1}`;

            room.players.push({
                id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name: botName,
                isHost: false,
                isBot: true,
                online: true
            });

            console.log(`Host added ${botName} to room ${normalizedRoom}. Total players: ${room.players.length}`);

            io.to(normalizedRoom).emit('update_room', {
                roomCode: room.roomCode,
                hostId: room.hostId,
                players: room.players,
                gameStarted: room.gameStarted
            });
        }
    });

    // Host removes a specific bot
    socket.on('remove_bot', ({ roomCode, botId }) => {
        if (!roomCode || !botId) return;
        const normalizedRoom = roomCode.trim().toLowerCase();
        const room = rooms[normalizedRoom];
        if (room && room.hostId === socket.id && !room.gameStarted) {
            room.players = room.players.filter(p => p.id !== botId);
            console.log(`Host removed bot ${botId} from room ${normalizedRoom}. Total players: ${room.players.length}`);

            io.to(normalizedRoom).emit('update_room', {
                roomCode: room.roomCode,
                hostId: room.hostId,
                players: room.players,
                gameStarted: room.gameStarted
            });
        }
    });

    // Host starts the game and broadcasts the initial synchronized state
    socket.on('start_game', ({ roomCode, initialState }) => {
        const normalizedRoom = roomCode.trim().toLowerCase();
        const room = rooms[normalizedRoom];
        if (room) {
            room.gameStarted = true;
            room.initialState = initialState;
            room.currentLiveState = initialState;
            io.to(normalizedRoom).emit('game_started', initialState);
            console.log(`Game started in room: ${normalizedRoom} with ${room.players.length} players.`);
        }
    });

    // Broadcast a player turn action and cache the current live state for reconnects
    socket.on('game_action', ({ roomCode, actionData, fullState }) => {
        const normalizedRoom = roomCode.trim().toLowerCase();
        const room = rooms[normalizedRoom];
        if (room) {
            if (fullState) {
                room.currentLiveState = fullState;
            }
            if (actionData) {
                room.actionLog.push({ ...actionData, timestamp: Date.now() });
                if (room.actionLog.length > 50) room.actionLog.shift();
            }
            // Broadcast to other players in room
            socket.to(normalizedRoom).emit('sync_game_state', { actionData, fullState });
        }
    });

    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const normalizedRoom in rooms) {
            const room = rooms[normalizedRoom];
            const player = room.players.find(p => p.id === socket.id);
            
            if (player) {
                player.online = false;
                console.log(`Player ${player.name} went OFFLINE in room ${normalizedRoom}`);

                // If game hasn't started yet, remove player from lobby
                if (!room.gameStarted) {
                    room.players = room.players.filter(p => p.id !== socket.id);
                    if (room.players.length === 0) {
                        delete rooms[normalizedRoom];
                        console.log(`Lobby room ${normalizedRoom} deleted (empty).`);
                        continue;
                    } else if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        room.players[0].isHost = true;
                    }
                }

                // Notify remaining players about offline status
                io.to(normalizedRoom).emit('update_room', {
                    roomCode: room.roomCode,
                    hostId: room.hostId,
                    players: room.players,
                    gameStarted: room.gameStarted
                });

                io.to(normalizedRoom).emit('player_status_changed', {
                    playerName: player.name,
                    online: false
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Multiplayer server running on http://localhost:${PORT}`);
});