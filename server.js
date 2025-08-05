import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(express.static('public'));

const httpServer = createServer(app);
const io = new Server(httpServer);
const MAX_SCORE = 3;

const state = {
  p1: { y: 160, speed: 5},
  p2: { y: 160, speed: 5},
  ball: { x: 400, y: 200, vx: 4, vy:2 },
  score: { p1: 0, p2: 0 }
};

let player = {p1: null, p2: null};
let gameInterval = null;

function gameTick() {
  // Move paddles
  if (player.p1) {
    if (player.p1.up) state.p1.y -= state.p1.speed;
    if (player.p1.down) state.p1.y += state.p1.speed;
    state.p1.y = Math.max(0, Math.min(420, state.p1.y));
  }
  if (player.p2) {
    if (player.p2.up) state.p2.y -= state.p2.speed;
    if (player.p2.down) state.p2.y += state.p2.speed;
    state.p2.y = Math.max(0, Math.min(420, state.p2.y));
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

    // Score
  if (state.ball.x < 0) {
    state.ball.x = 400;
    state.ball.y = 200;
    state.ball.vx = -state.ball.vx;
    state.ball.vy = -state.ball.vy;
    state.score.p2++;
    io.in('gameRoom').emit('score-update', state.score);
    console.log('p2 got a point, score:', state.score.p2);
    maybeGameOver('p2');
  }
  if (state.ball.x > 800) {
    state.ball.x = 400;
    state.ball.y = 200;
    state.ball.vx = -state.ball.vx;
    state.ball.vy = -state.ball.vy;
    state.score.p1++;
    io.in('gameRoom').emit('score-update', state.score);
    console.log('p1 got a point, score:', state.score.p1);
    maybeGameOver('p1');
  }

  // Reset if out of bounds
  // if (state.ball.x < 0 || state.ball.x > 800) {
  //   state.ball = { x:400, y:200, vx:4, vy:2 };
  // }

  // Broadcast to both players
  // only send to assigned player
  [player.p1, player.p2].forEach(s => {
    if (s && s.connected) {
      s.emit('game-state', state);
    }
  })
  io.in('gameRoom').emit('game-state', state);
};


function startGameLoop() {
  if (!gameInterval) {
    gameInterval = setInterval(gameTick, 1000 / 60);
  }
}

function stopGameLoop() {
  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
    player.p1.ready = player.p2.ready = false;
  }
}

function resetBall() {
  state.ball = {
    x:400,
    y:200,
    vx:4 * (Math.random() > 0.5 ? 1 : -1),
    vy:2 * (Math.random() > 0.5 ? 1 : -1)
  };
}

function resetGameState() {
  state.p1.y = state.p2.y = 160;
  resetBall();
  state.score = { p1: 0, p2: 0 };
}

function maybeGameOver(scoringPlayer) {
  if (state.score[scoringPlayer] >= MAX_SCORE) {
    io.in('gameRoom').emit('game-over', scoringPlayer);
    stopGameLoop();
  } else {
    resetBall();
  }
}

// On connect/disconnect
io.on('connection', (socket) => {
  // Assign to p1 or p2
  if (!player.p1) {
    player.p1 = socket;
    socket.player = 'p1';
  } else if (!player.p2) {
    player.p2 = socket;
    socket.player = 'p2';
  } else {
    // room full
    socket.emit('room-full');
    return socket.disconnect(true);
  }
  console.log('👤 client connected as '+ socket.player, socket.id);

  
  // Initialize ready flag
  socket.ready = false;
  
  // notify client of player assignment
  socket.emit('player-assigned', socket.player);
  
  socket.join('gameRoom');
  console.log(socket.player +' joined gameRoom...', socket.id);

  // broadcast lobby state (optional)
  // io.in('gameRoom').emit('lobby-update', {/* e.g. who’s connected/ready */});

  socket.on('player-ready', () => {
    socket.ready = true;

    if(player.p1 && player.p2 &&
      player.p1.ready && player.p2.ready
    ) {
      io.in('gameRoom').emit('game-start');
      startGameLoop();
    } else {
      // notify the other player someone just readied up (optional)
      io.in('gameRoom').emit('lobby-update', {
        p1: !!player.p1, p1Ready: player.p1?.ready,
        p2: !!player.p2, p2Ready: player.p2?.ready
      });
    }
  });

  
  // Handle paddle moves tagged by player
  socket.on('paddle-move', ({up, down}) => {
    socket.up = up;
    socket.down = down;
  });
  
  socket.on('chat-message', msg => {
    io.in('gameRoom').emit('chat-message', { id: socket.player, text: msg });
  })
  

  socket.on('ping', () => {
    console.log('⬅️ ping received');
    socket.emit('pong');
  });

  socket.on('restart', () => {
    console.log('🔄 restart received');
    // clear ready flags
    if (player.p1) player.p1.ready = false;
    if (player.p2) player.p2.ready = false;

    resetGameState();
    io.in('gameRoom').emit('score-update', state.score);
    // send them back to lobby
    io.in('gameRoom').emit('lobby-update', {
      p1: !!player.p1, p1Ready: false,
      p2: !!player.p2, p2Ready: false
    })
  });

  socket.on('disconnect', () => {
    // Free up the slot
    if (socket.player === 'p1') player.p1 = null;
    if (socket.player === 'p2') player.p2 = null;
    console.log('❌ client disconnected', socket.id);
    stopGameLoop();
    resetGameState();
    if (player.p1) player.p1.ready = false;
    if (player.p2) player.p2.ready = false;
    io.in('gameRoom').emit('lobby-update', {
      p1: !!player.p1, p1Ready: false,
      p2: !!player.p2, p2Ready: false
    })
  });
});

httpServer.listen(3000, () => {
  console.log('🔌 Server listening on http://localhost:3000');
});
