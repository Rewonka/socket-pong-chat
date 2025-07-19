import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(express.static('public'));

const httpServer = createServer(app);
const io = new Server(httpServer);

let player = []; //socket
const state = {
  p1: { y: 160, speed: 8, score: 0 },
  p2: { y: 160, speed: 8, score: 0 },
  ball: { x: 400, y: 200, vx: 4, vy:2 }
};

// On connect/disconnect
io.on('connection', (socket) => {
  if (player.length < 2) player.push(socket);
  else { socket.disconnect(true); return; }

  socket.on('paddle move', ({up, down}) => {
    socket.up = up; socket.down = down;
  });
  
  socket.on('chat message', msg => {
    io.emit('chat message', { id: socket.id, text:msg });
  })
  
  console.log('👤 client connected', socket.id);

  socket.on('ping', () => {
    console.log('⬅️ ping received');
    socket.emit('pong');
  });

  socket.on('disconnect', () => {
    console.log('❌ client disconnected', socket.id);
    player = player.filter(s => s !== socket);
    // reset positions
    state.p1.y = state.p2.y = 160;
    state.ball = { x:400,y:200, vx:4, vy:2};
  });
});

// Game loop @ 60FPS
setInterval(() => {
  // Move paddles
  if (player[0]) {
    if (player[0].up) state.p1.y -= state.p1.speed;
    if (player[0].down) state.p1.y += state.p1.speed;
    state.p1.y = Math.max(0, Math.min(320, state.p1.y));
  }
  if (player[1]) {
    if (player[1].up) state.p2.y -= state.p2.speed;
    if (player[1].down) state.p2.y += state.p2.speed;
    state.p2.y = Math.max(0, Math.min(320, state.p2.y));
  }

  // Move ball
  state.ball.x += state.ball.vx;
  state.ball.y += state.ball.vy;

  // Bounce off top/bottom
  if (state.ball.y < 8 || state.ball.y > 492)
    state.ball.vy = -state.ball.vy;

  // Bounce off paddles
  if (
    (state.ball.x < 18 && state.ball.y > state.p1.y && state.ball.y < state.p1.y+80) ||
    (state.ball.x > 782 && state.ball.y > state.p2.y && state.ball.y < state.p2.y+80)
  ) {
    state.ball.vx = -state.ball.vx;
  }

  if (state.ball.x < 0) {
    state.ball.x = 400;
    state.ball.y = 200;
    state.ball.vx = -state.ball.vx;
    state.ball.vy = -state.ball.vy;
    state.p2.score++;
  }
  if (state.ball.x > 800) {
    state.ball.x = 400;
    state.ball.y = 200;
    state.ball.vx = -state.ball.vx;
    state.ball.vy = -state.ball.vy;
    state.p1.score++;
  }

  // Reset if out of bounds
  // if (state.ball.x < 0 || state.ball.x > 800) {
  //   state.ball = { x:400, y:200, vx:4, vy:2 };
  // }

  // Broadcast to both players
  io.emit('game state', state);
}, 1000 / 60);

httpServer.listen(3000, () => {
  console.log('🔌 Server listening on http://localhost:3000');
});
