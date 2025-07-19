# Pong Game with Socket.io and Chat

This project was made as a learning exercise. I implemented a simple pong game using HTML5 canvas and [Socket.io](https://socket.io/) for real-time multiplayer interaction.

## How to play

1. Clone this repository.
2. Run `npm install` to install the dependencies.
3. Start the server with `node server.js`.
4. Open `http://localhost:3000` in your browser.

To start a game, open the app in two different browsers. You can then use the arrow keys to control the paddles and try to hit the ball.

You can also chat with the other player by typing in the chat box.

## Technical details

The game is implemented using the following technologies:

- HTML5 canvas for rendering the game.
- [Socket.io](https://socket.io/) for real-time communication between the players.

The game logic is implemented in the `server.js` file. The server receives paddle movements from the clients and updates the game state. It broadcasts the game state to all the clients, which then redraw the game.

The chat functionality is implemented in the `public/index.html` file. The clients send chat messages to the server, which broadcasts them to all the clients.

## License

The code is licensed under the [MIT](LICENSE) license.

