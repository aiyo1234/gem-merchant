const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
// Serve static client assets
app.use(express.static(path.join(__dirname)));

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

    // Player joins a room with a room code & player name
    socket.on('join_room', ({ roomCode, playerName }) => {
        if (!roomCode || !playerName) return;

        socket.join(roomCode);
        console.log(`${playerName} (${socket.id}) joined room: ${roomCode}`);

        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                hostId: socket.id,
                players: [],
                gameStarted: false,
                initialState: null
            };
        }

        const room = rooms[roomCode];

        // Remove old socket for same player if reconnecting
        room.players = room.players.filter(p => p.id !== socket.id);
        const isHost = room.players.length === 0 || room.hostId === socket.id;
        if (isHost) {
            room.hostId = socket.id;
        }

        room.players.push({
            id: socket.id,
            name: playerName.trim(),
            isHost: isHost
        });

        // Broadcast updated room info
        io.to(roomCode).emit('update_room', {
            roomCode,
            hostId: room.hostId,
            players: room.players,
            gameStarted: room.gameStarted
        });

        // If game is already underway, send the initial setup to reconnecting player
        if (room.gameStarted && room.initialState) {
            socket.emit('game_started', room.initialState);
        }
    });

    // Host starts the game and broadcasts the synchronized initial state (decks, market, patrons)
    socket.on('start_game', ({ roomCode, initialState }) => {
        const room = rooms[roomCode];
        if (room) {
            room.gameStarted = true;
            room.initialState = initialState;
            io.to(roomCode).emit('game_started', initialState);
            console.log(`Game started in room: ${roomCode} with ${room.players.length} players.`);
        }
    });

    // Broadcast a player turn action to all other players in the room
    socket.on('game_action', ({ roomCode, actionData }) => {
        console.log(`Action in ${roomCode}:`, actionData);
        socket.to(roomCode).emit('sync_game_state', actionData);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                    console.log(`Room ${roomCode} closed (empty).`);
                } else {
                    if (room.hostId === socket.id) {
                        room.hostId = room.players[0].id;
                        room.players[0].isHost = true;
                    }
                    io.to(roomCode).emit('update_room', {
                        roomCode,
                        hostId: room.hostId,
                        players: room.players,
                        gameStarted: room.gameStarted
                    });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Multiplayer server running on http://localhost:${PORT}`);
});