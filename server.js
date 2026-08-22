const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = {};

io.on('connection', (socket) => {
    console.log(`A player connected: ${socket.id}`);

    socket.on('join_room', ({ roomCode, playerName }) => {
        socket.join(roomCode);
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [] };
        }
        
        rooms[roomCode].players.push({ id: socket.id, name: playerName });
        io.to(roomCode).emit('update_room', rooms[roomCode]);
        console.log(`${playerName} joined room: ${roomCode}`);
    });

    socket.on('game_action', ({ roomCode, actionData }) => {
        socket.to(roomCode).emit('sync_game_state', actionData);
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        for (const roomCode in rooms) {
            rooms[roomCode].players = rooms[roomCode].players.filter(p => p.id !== socket.id);
            io.to(roomCode).emit('update_room', rooms[roomCode]);
        }
    });
});

server.listen(3000, () => {
    console.log('Multiplayer server is running on port 3000');
});
