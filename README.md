# ♠♥♦♣ Royal Hold'em — Real-Time Multiplayer Texas Hold'em Poker

A real-time multiplayer Texas Hold'em poker card game with a server-authoritative **Node.js + Express + Socket.io** backend and a responsive **vanilla HTML5 / CSS3 / JavaScript** frontend.

---

## 🌟 Key Features

1. **Room & Code System**:
   - Create private rooms with custom starting chips ($500 - $5,000), blinds ($5/$10 to $50/$100), and player capacities (2 to 8 seats).
   - Instant 6-character room codes (e.g. `A9B2X7`) and 1-click shareable invite links (`/?room=A9B2X7`).
2. **Server-Authoritative Game State**:
   - The server completely owns the deck (Fisher-Yates cryptographic shuffle), betting rounds, pots, turn orders, and timers.
   - Clients are "dumb" renderers that only display verified server events.
3. **Zero-Leak Information Security**:
   - Private hole cards are transmitted exclusively to their respective player's socket.
   - Opponents only see card backs until showdown.
4. **Texas Hold'em Rules & Engine**:
   - Complete 5-stage progression: `Pre-flop` ➔ `Flop` (3 cards) ➔ `Turn` (1 card) ➔ `River` (1 card) ➔ `Showdown`.
   - Player actions: **Fold**, **Check**, **Call**, **Bet / Raise** (with min-raise rules, raise slider, and preset shortcuts).
   - Side-pot & multi-way pot calculation for all-in players with differing chip stacks.
   - Full 7-card best-5 hand evaluator covering all 10 rankings (Royal Flush down to High Card, including Ace-5 Wheel Straights and kicker tie-breakers).
   - Instant fold-to-win detection (awards pot immediately without card reveal if all opponents fold).
5. **Seamless Reconnection Handling**:
   - Session tokens saved in `sessionStorage` allow players to refresh or recover from brief network dropouts without losing their seat, chips, or active hand.
6. **Polished Table UI & Audio**:
   - Oval luxury felt table, dynamic seat cards, dealer/SB/BB tags, turn indicator glow, procedural Web Audio sound synthesis (chips, cards, turn chimes, victory fanfare), table history log, and in-game chat.

---

## 📁 Project Structure

```
multiplayer-poker/
├── package.json               # Project metadata and dependencies (express, socket.io)
├── README.md                  # Setup and deployment documentation
├── server/
│   ├── server.js              # Express app, Socket.io events, room management
│   ├── game.js                # Texas Hold'em game engine & betting state machine
│   ├── deck.js                # 52-card deck & Fisher-Yates shuffle
│   └── evaluator.js           # 7-card hand evaluator & tie-breaking logic
├── public/
│   ├── index.html             # Single-page markup (Lobby & Poker Arena)
│   ├── style.css              # Casino dark theme stylesheet
│   └── client.js              # Socket.io client, table renderers & Web Audio
└── test/
    ├── evaluator.test.js      # Unit tests for hand evaluation & tie-breakers
    └── game.test.js           # Simulation tests for game cycle & betting rounds
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)

### 1. Installation
```bash
git clone <repo-url>
cd multiplayer-poker
npm install
```

### 2. Run Automated Tests
```bash
npm test
```

### 3. Start the Server
```bash
npm start
```
The server will boot on `http://localhost:3000`.

### 4. Play Multiplayer
- Open `http://localhost:3000` in a browser window (e.g. Chrome).
- Create a room as **Player 1**. Copy the 6-character room code.
- Open a second window / tab / incognito window (or a second device on the same local network `http://<your-local-ip>:3000`).
- Join the room as **Player 2**.
- Click **Start Hand Now** and play!

---

## 🌐 Production Deployment

> [!IMPORTANT]
> **Persistent WebSocket Connections Required**:
> This application relies on stateful, long-lived WebSocket connections via Socket.io and in-memory game state.
> - **Recommended Hosts**: **Render**, **Railway**, **Fly.io**, **DigitalOcean App Platform**, or **AWS EC2 / VPS**.
> - **Avoid Serverless Platforms**: Serverless function environments (e.g. AWS Lambda, Vercel Serverless Functions, Netlify Functions) terminate connections quickly and do not support persistent stateful WebSockets without external brokers.

### Deploying to Render / Railway
1. Push your repository to GitHub / GitLab.
2. Create a **Web Service** on Render or Railway.
3. Set the build command:
   ```bash
   npm install
   ```
4. Set the start command:
   ```bash
   npm start
   ```
5. Set environment variable `PORT` (or let the platform provide it automatically).
