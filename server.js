import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(express.static('public'));

const httpServer = createServer(app);
const io = new Server(httpServer);

io.on('connection', (socket) => {
  console.log('👤 client connected', socket.id);

  socket.on('ping', () => {
    console.log('⬅️ ping received');
    socket.emit('pong');
  });

  socket.on('disconnect', () => {
    console.log('❌ client disconnected', socket.id);
  });

  socket.on('chat message', msg => {
    io.emit('chat message', { id: socket.id, text:msg });
  })

});

httpServer.listen(3000, () => {
  console.log('🔌 Server listening on http://localhost:3000');
});
