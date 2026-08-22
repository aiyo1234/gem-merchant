const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Enable CORS so your GitHub Pages frontend can talk to Render
const io = new Server(server, {
    cors: {
        origin: "*", // Allows connections from any frontend URL (like your GitHub Pages)
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('Gem Merchant Multiplayer Server is Running!');
});

// Track rooms and players
const rooms = {};

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // Listen for players joining a specific room code
    socket.on('join-room', ({ roomCode, playerName }) => {
        socket.join(roomCode);
        console.log(`${playerName} (${socket.id}) joined room: ${roomCode}`);

        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [] };
        }

        // Add player to room list
        rooms[roomCode].players.push({ id: socket.id, name: playerName });

        // Tell everyone in the room that a new player joined
        io.to(roomCode).emit('player-joined', rooms[roomCode]);
        
        // Send updated game state to the room
        io.to(roomCode).emit('update-game-state', {
            room: roomCode,
            players: rooms[roomCode].players,
            turn: rooms[roomCode].players[0]?.name || 'Waiting...'
        });
    });

    // Handle game actions (like picking tokens or buying cards)
    socket.on('player-action', (data) => {
        // Broadcast the action to everyone else in the same room
        socket.to(data.roomCode).emit('update-game-state', data.newState);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Optional: clean up rooms if players leave
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});