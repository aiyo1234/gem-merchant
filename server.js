const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('Gem Merchant Multiplayer Server is Running!');
});

// Track rooms and their players/state
const rooms = {};

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // Handle joining a room code
    socket.on('join_room', ({ roomCode, playerName }) => {
        socket.join(roomCode);
        console.log(`${playerName} (${socket.id}) joined room: ${roomCode}`);

        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [] };
        }

        // Avoid duplicate entries if reconnecting
        rooms[roomCode].players = rooms[roomCode].players.filter(p => p.id !== socket.id);
        rooms[roomCode].players.push({ id: socket.id, name: playerName });

        // Broadcast updated room players to everyone in the room
        io.to(roomCode).emit('update_room', rooms[roomCode]);
    });

    // Handle game actions (taking tokens, buying cards, etc.) and sync to others
    socket.on('game_action', ({ roomCode, actionData }) => {
        console.log(`Action in room ${roomCode}:`, actionData);
        // Send this action to everyone else in the same room
        socket.to(roomCode).emit('sync_game_state', actionData);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Remove player from any rooms they were in
        for (const roomCode in rooms) {
            rooms[roomCode].players = rooms[roomCode].players.filter(p => p.id !== socket.id);
            io.to(roomCode).emit('update_room', rooms[roomCode]);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});