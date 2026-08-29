const { Deck } = require('./deck');
const { evaluateHand, compareScores } = require('./evaluator');

const STAGES = {
  WAITING: 'waiting',
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
  HAND_ENDED: 'hand_ended'
};

class PokerGame {
  constructor(roomCode, config = {}) {
    this.roomCode = roomCode;
    this.config = {
      smallBlind: Number(config.smallBlind) || 10,
      bigBlind: Number(config.bigBlind) || 20,
      startingChips: Number(config.startingChips) || 1000,
      maxSeats: Math.min(Math.max(Number(config.maxSeats) || 8, 2), 20),
      turnTimeoutMs: config.turnTimeoutMs !== undefined ? Number(config.turnTimeoutMs) : 0,
      nextHandDelayMs: config.nextHandDelayMs || 6000,
      showHandHelper: config.showHandHelper !== undefined ? Boolean(config.showHandHelper) : true
    };

    this.seats = Array(this.config.maxSeats).fill(null);
    this.deck = new Deck();
    this.stage = STAGES.WAITING;
    this.communityCards = [];
    this.pots = []; // Side pots: [{ amount, eligiblePlayerIds }]
    this.dealerSeatIndex = -1;
    this.smallBlindSeatIndex = -1;
    this.bigBlindSeatIndex = -1;
    this.currentTurnSeatIndex = -1;
    this.currentBet = 0; // Highest bet in current betting round
    this.minRaise = 0; // Minimum valid total raise amount
    this.lastRaiseAmount = 0; // Size of previous raise
    this.actionsCountThisRound = 0;
    this.handNumber = 0;
    this.handHistory = [];
    this.winners = [];
    this.pendingHostAction = null; // 'deal_flop' | 'deal_turn' | 'deal_river' | 'reveal_winner'
    this.pendingHostActionLabel = '';
    this.turnTimer = null;
    this.nextHandTimer = null;
    this.onStateChange = null; // Callback for state updates to sockets
  }

  updateConfig(newConfig = {}) {
    if (newConfig.turnTimeoutMs !== undefined) {
      this.config.turnTimeoutMs = Number(newConfig.turnTimeoutMs);
    }
    if (newConfig.showHandHelper !== undefined) {
      this.config.showHandHelper = Boolean(newConfig.showHandHelper);
    }
    if (newConfig.smallBlind !== undefined) {
      this.config.smallBlind = Math.max(1, Number(newConfig.smallBlind));
    }
    if (newConfig.bigBlind !== undefined) {
      this.config.bigBlind = Math.max(this.config.smallBlind, Number(newConfig.bigBlind));
    }
    if (newConfig.startingChips !== undefined) {
      this.config.startingChips = Math.max(10, Number(newConfig.startingChips));
    }
    if (newConfig.maxSeats) {
      const max = Math.min(Math.max(Number(newConfig.maxSeats), 2), 20);
      this.config.maxSeats = max;
      while (this.seats.length < max) {
        this.seats.push(null);
      }
      if (this.seats.length > max) {
        for (let i = this.seats.length - 1; i >= max; i--) {
          if (this.seats[i] === null) {
            this.seats.splice(i, 1);
          }
        }
      }
    }
    this.log('⚙️ Table settings updated by host.');
    this.notifyState();
  }

  log(message) {
    this.handHistory.push({
      timestamp: Date.now(),
      text: message
    });
    if (this.handHistory.length > 50) {
      this.handHistory.shift();
    }
  }

  notifyState() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this);
    }
  }

  // --- Seat & Player Management ---

  getSeatedPlayers() {
    return this.seats.filter(p => p !== null);
  }

  getPlayer(playerId) {
    return this.seats.find(p => p && p.id === playerId) || null;
  }

  getSeatIndex(playerId) {
    return this.seats.findIndex(p => p && p.id === playerId);
  }

  findAvailableSeat() {
    return this.seats.findIndex(p => p === null);
  }

  addPlayer(playerData, preferredSeat = -1) {
    const existing = this.getPlayer(playerData.id);
    if (existing) {
      // Reconnection: update socket and connection status
      existing.socketId = playerData.socketId;
      existing.disconnected = false;
      existing.name = playerData.name || existing.name;
      this.log(`${existing.name} reconnected.`);
      this.notifyState();
      return { success: true, player: existing, seatIndex: existing.seatIndex };
    }

    let seatIdx = preferredSeat;
    if (seatIdx < 0 || seatIdx >= this.config.maxSeats || this.seats[seatIdx] !== null) {
      seatIdx = this.findAvailableSeat();
    }

    if (seatIdx === -1) {
      return { success: false, error: 'Table is full' };
    }

    const newPlayer = {
      id: playerData.id,
      name: playerData.name,
      socketId: playerData.socketId,
      chips: Number(playerData.chips) || this.config.startingChips,
      seatIndex: seatIdx,
      holeCards: [],
      currentBet: 0,
      totalHandBet: 0,
      folded: false,
      allIn: false,
      sittingOut: false,
      disconnected: false,
      lastAction: null,
      evaluatedHand: null,
      showCards: false
    };

    this.seats[seatIdx] = newPlayer;
    this.log(`${newPlayer.name} sat at seat ${seatIdx + 1} with $${newPlayer.chips}.`);
    this.notifyState();
    return { success: true, player: newPlayer, seatIndex: seatIdx };
  }

  removePlayer(playerId) {
    const seatIdx = this.getSeatIndex(playerId);
    if (seatIdx === -1) return false;

    const player = this.seats[seatIdx];
    this.log(`${player.name} left the table.`);

    // If game in progress and it's their turn, auto-fold
    if (this.isGameActive() && !player.folded && this.currentTurnSeatIndex === seatIdx) {
      this.handlePlayerAction(playerId, 'fold');
    } else if (this.isGameActive() && !player.folded) {
      player.folded = true;
      this.checkRemainingPlayers();
    }

    this.seats[seatIdx] = null;

    if (this.isGameActive()) {
      const activeCount = this.getActivePlayersInHand().length;
      if (activeCount <= 1) {
        this.endHandEarly();
      }
    } else {
      if (this.getSeatedPlayers().length < 2) {
        this.stage = STAGES.WAITING;
      }
    }

    this.notifyState();
    return true;
  }

  setPlayerDisconnected(playerId, disconnected = true) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.disconnected = disconnected;
      if (disconnected) {
        this.log(`${player.name} disconnected.`);
        // If it's their turn, set a shorter timer or auto-action on timeout
      }
      this.notifyState();
    }
  }

  rebuy(playerId, amount) {
    const player = this.getPlayer(playerId);
    if (player) {
      const reloadAmount = Number(amount) || this.config.startingChips || 1000;
      player.chips += reloadAmount;
      player.folded = false;
      this.log(`💰 ${player.name} received $${reloadAmount.toLocaleString()} reload.`);
      this.notifyState();
      return true;
    }
    return false;
  }

  setPlayerChips(playerId, amount) {
    const player = this.getPlayer(playerId);
    if (!player) return false;

    const newAmount = Math.max(0, Math.floor(Number(amount)));
    if (!Number.isFinite(newAmount)) return false;

    const oldAmount = player.chips;
    player.chips = newAmount;
    if (newAmount > 0) {
      player.folded = false;
    }
    this.log(`✏️ Host set ${player.name}'s chips: $${oldAmount.toLocaleString()} → $${newAmount.toLocaleString()}.`);
    this.notifyState();
    return true;
  }

  // --- Game Flow & Round Management ---

  isGameActive() {
    return [STAGES.PREFLOP, STAGES.FLOP, STAGES.TURN, STAGES.RIVER].includes(this.stage);
  }

  getActivePlayersInHand() {
    return this.seats.filter(p => p !== null && !p.folded && !p.sittingOut);
  }

  getEligiblePlayersForNewHand() {
    return this.seats.filter(p => p !== null && p.chips > 0 && !p.sittingOut);
  }

  getNextActiveSeatIndex(startIndex, condition = (p) => !p.folded && !p.sittingOut) {
    for (let i = 1; i <= this.config.maxSeats; i++) {
      const idx = (startIndex + i) % this.config.maxSeats;
      const p = this.seats[idx];
      if (p && condition(p)) {
        return idx;
      }
    }
    return -1;
  }

  canStartGame() {
    return this.getEligiblePlayersForNewHand().length >= 2 &&
      (this.stage === STAGES.WAITING || this.stage === STAGES.HAND_ENDED);
  }

  startGame() {
    if (!this.canStartGame()) {
      return { success: false, error: 'Need at least 2 players with chips to start' };
    }
    this.startNewHand();
    return { success: true };
  }

  startNewHand() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    if (this.nextHandTimer) clearTimeout(this.nextHandTimer);

    const eligible = this.getEligiblePlayersForNewHand();
    if (eligible.length < 2) {
      this.stage = STAGES.WAITING;
      this.log('Waiting for more players to join or rebuy...');
      this.notifyState();
      return;
    }

    this.handNumber++;
    this.stage = STAGES.PREFLOP;
    this.deck = new Deck();
    this.communityCards = [];
    this.pots = [];
    this.winners = [];
    this.actionsCountThisRound = 0;
    this.pendingHostAction = null;
    this.pendingHostActionLabel = '';

    // Reset player states
    for (const player of this.seats) {
      if (player) {
        player.holeCards = [];
        player.currentBet = 0;
        player.totalHandBet = 0;
        player.folded = player.chips <= 0 || player.sittingOut;
        player.allIn = false;
        player.lastAction = null;
        player.evaluatedHand = null;
        player.showCards = false;
      }
    }

    // Advance Dealer Button (Randomize initial dealer button on hand #1 so host is not always SB)
    if (this.dealerSeatIndex === -1) {
      const randomIdx = Math.floor(Math.random() * eligible.length);
      this.dealerSeatIndex = eligible[randomIdx].seatIndex;
    } else {
      this.dealerSeatIndex = this.getNextActiveSeatIndex(this.dealerSeatIndex, p => p.chips > 0 && !p.sittingOut);
    }

    const activePlayers = this.getActivePlayersInHand();

    // Assign Blinds
    if (activePlayers.length === 2) {
      // Heads-up: Dealer is SB, other player is BB
      this.smallBlindSeatIndex = this.dealerSeatIndex;
      this.bigBlindSeatIndex = this.getNextActiveSeatIndex(this.dealerSeatIndex);
    } else {
      // 3+ players: SB is left of Dealer, BB is left of SB
      this.smallBlindSeatIndex = this.getNextActiveSeatIndex(this.dealerSeatIndex);
      this.bigBlindSeatIndex = this.getNextActiveSeatIndex(this.smallBlindSeatIndex);
    }

    // Post Small Blind
    const sbPlayer = this.seats[this.smallBlindSeatIndex];
    const sbAmount = Math.min(sbPlayer.chips, this.config.smallBlind);
    sbPlayer.chips -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    sbPlayer.totalHandBet = sbAmount;
    if (sbPlayer.chips === 0) sbPlayer.allIn = true;
    sbPlayer.lastAction = `Small Blind ($${sbAmount})`;

    // Post Big Blind
    const bbPlayer = this.seats[this.bigBlindSeatIndex];
    const bbAmount = Math.min(bbPlayer.chips, this.config.bigBlind);
    bbPlayer.chips -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    bbPlayer.totalHandBet = bbAmount;
    if (bbPlayer.chips === 0) bbPlayer.allIn = true;
    bbPlayer.lastAction = `Big Blind ($${bbAmount})`;

    this.currentBet = Math.max(sbAmount, bbAmount);
    this.lastRaiseAmount = this.config.bigBlind;
    this.minRaise = this.currentBet + this.config.bigBlind;

    // Deal 2 hole cards to each active player
    for (const p of this.getActivePlayersInHand()) {
      p.holeCards = this.deck.drawMultiple(2);
    }

    this.log(`--- Hand #${this.handNumber} Started ---`);
    this.log(`Dealer: ${this.seats[this.dealerSeatIndex].name}, SB: ${sbPlayer.name} ($${sbAmount}), BB: ${bbPlayer.name} ($${bbAmount})`);

    // Determine first player to act preflop:
    // Heads-up: Dealer (SB) acts first preflop
    // 3+ players: First player to left of BB acts first preflop
    if (activePlayers.length === 2) {
      this.currentTurnSeatIndex = this.dealerSeatIndex;
    } else {
      this.currentTurnSeatIndex = this.getNextActiveSeatIndex(this.bigBlindSeatIndex, p => !p.folded && !p.allIn);
    }

    // If everyone is already all-in from blinds
    if (this.currentTurnSeatIndex === -1 || this.countPlayersCanAct() <= 1) {
      this.currentTurnSeatIndex = -1;
      this.setPendingHostAction('deal_flop', 'Deal Flop (3 Cards)');
    } else {
      this.startTurnTimer();
    }

    this.notifyState();
  }

  countPlayersCanAct() {
    return this.seats.filter(p => p !== null && !p.folded && !p.allIn && !p.sittingOut).length;
  }

  startTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    if (this.currentTurnSeatIndex === -1) return;

    if (this.config.turnTimeoutMs > 0) {
      this.turnTimer = setTimeout(() => {
        this.handleTimeout();
      }, this.config.turnTimeoutMs);
    }
  }

  handleTimeout() {
    const player = this.seats[this.currentTurnSeatIndex];
    if (!player) return;

    this.log(`${player.name} timed out.`);
    // If player can check, check; otherwise fold
    if (player.currentBet === this.currentBet) {
      this.handlePlayerAction(player.id, 'check');
    } else {
      this.handlePlayerAction(player.id, 'fold');
    }
  }

  // --- Player Action Handling ---

  handlePlayerAction(playerId, action, amount = 0) {
    if (!this.isGameActive()) {
      return { success: false, error: 'Game is not in an active betting round' };
    }

    const playerSeat = this.getSeatIndex(playerId);
    if (playerSeat === -1 || playerSeat !== this.currentTurnSeatIndex) {
      return { success: false, error: 'Not your turn' };
    }

    const player = this.seats[playerSeat];
    if (player.folded || player.allIn) {
      return { success: false, error: 'Player cannot act' };
    }

    if (this.turnTimer) clearTimeout(this.turnTimer);

    const callAmount = this.currentBet - player.currentBet;

    switch (action.toLowerCase()) {
      case 'fold': {
        player.folded = true;
        player.lastAction = 'Fold';
        this.log(`${player.name} folded.`);

        const remaining = this.getActivePlayersInHand();
        if (remaining.length === 1) {
          this.endHandEarly();
          return { success: true };
        }
        break;
      }

      case 'check': {
        if (callAmount > 0) {
          return { success: false, error: `Cannot check; must call $${callAmount} or fold` };
        }
        player.lastAction = 'Check';
        this.log(`${player.name} checked.`);
        break;
      }

      case 'call': {
        if (callAmount <= 0) {
          player.lastAction = 'Check';
          this.log(`${player.name} checked.`);
          break;
        }

        const chipsToPay = Math.min(player.chips, callAmount);
        player.chips -= chipsToPay;
        player.currentBet += chipsToPay;
        player.totalHandBet += chipsToPay;

        if (player.chips === 0) {
          player.allIn = true;
          player.lastAction = `All-in ($${player.currentBet})`;
          this.log(`${player.name} called all-in with $${chipsToPay}.`);
        } else {
          player.lastAction = `Call ($${chipsToPay})`;
          this.log(`${player.name} called $${chipsToPay}.`);
        }
        break;
      }

      case 'bet':
      case 'raise': {
        const targetTotalBet = Number(amount);

        // Calculate minimum valid raise:
        // If currentBet === 0, minimum bet is Big Blind (or all-in if fewer chips)
        // If currentBet > 0, minimum raise is currentBet + lastRaiseAmount (or all-in)
        const minValidTotal = this.currentBet === 0 ? this.config.bigBlind : this.minRaise;

        const maxAffordable = player.currentBet + player.chips;

        if (targetTotalBet < minValidTotal && targetTotalBet < maxAffordable) {
          return { success: false, error: `Minimum bet/raise is $${minValidTotal}` };
        }

        if (targetTotalBet > maxAffordable) {
          return { success: false, error: `Cannot bet more than available chips ($${maxAffordable})` };
        }

        const additionalChips = targetTotalBet - player.currentBet;
        if (additionalChips <= 0) {
          return { success: false, error: 'Raise amount must be higher than current bet' };
        }

        const actualRaiseAmount = targetTotalBet - this.currentBet;
        if (actualRaiseAmount > this.lastRaiseAmount) {
          this.lastRaiseAmount = actualRaiseAmount;
        }

        this.currentBet = targetTotalBet;
        this.minRaise = this.currentBet + Math.max(this.lastRaiseAmount, this.config.bigBlind);

        player.chips -= additionalChips;
        player.currentBet = targetTotalBet;
        player.totalHandBet += additionalChips;

        if (player.chips === 0) {
          player.allIn = true;
          player.lastAction = `All-in ($${targetTotalBet})`;
          this.log(`${player.name} raised all-in to $${targetTotalBet}.`);
        } else {
          const actionText = this.currentBet === targetTotalBet && action === 'bet' ? 'bet' : 'raised to';
          player.lastAction = `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} $${targetTotalBet}`;
          this.log(`${player.name} ${actionText} $${targetTotalBet}.`);
        }
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }

    this.actionsCountThisRound++;
    this.advanceTurn();
    this.notifyState();
    return { success: true };
  }

  setPendingHostAction(action, label) {
    this.pendingHostAction = action;
    this.pendingHostActionLabel = label;
    this.currentTurnSeatIndex = -1;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.log(`👑 Creator prompt: ${label}`);
    this.notifyState();
  }

  executeHostAction(action) {
    if (!this.pendingHostAction) {
      return { success: false, error: 'No pending host action' };
    }

    const pending = this.pendingHostAction;
    this.pendingHostAction = null;
    this.pendingHostActionLabel = '';

    if (pending === 'start_next_hand' || this.stage === STAGES.HAND_ENDED) {
      const eligible = this.getEligiblePlayersForNewHand();
      if (eligible.length >= 2) {
        this.startNewHand();
        return { success: true };
      } else {
        this.stage = STAGES.WAITING;
        this.log('Game paused: Not enough players with chips.');
        this.notifyState();
        return { success: false, error: 'Need at least 2 players with chips to start' };
      }
    } else if (pending === 'reveal_winner' || this.stage === STAGES.RIVER) {
      this.handleShowdown();
      return { success: true };
    } else {
      this.advanceStage();
      return { success: true };
    }
  }

  advanceTurn() {
    if (this.checkRemainingPlayers()) {
      return;
    }

    if (this.isBettingRoundComplete()) {
      if (this.turnTimer) clearTimeout(this.turnTimer);
      this.currentTurnSeatIndex = -1;

      // Ask the creator / host before revealing new card or revealing winner
      switch (this.stage) {
        case STAGES.PREFLOP:
          this.setPendingHostAction('deal_flop', 'Deal Flop (3 Cards)');
          break;
        case STAGES.FLOP:
          this.setPendingHostAction('deal_turn', 'Deal Turn Card');
          break;
        case STAGES.TURN:
          this.setPendingHostAction('deal_river', 'Deal River Card');
          break;
        case STAGES.RIVER:
          this.setPendingHostAction('reveal_winner', 'Reveal Winner & Showdown');
          break;
        default:
          this.advanceStage();
      }
    } else {
      this.currentTurnSeatIndex = this.getNextActiveSeatIndex(
        this.currentTurnSeatIndex,
        p => !p.folded && !p.allIn
      );
      this.startTurnTimer();
    }
  }

  isBettingRoundComplete() {
    const activeInHand = this.getActivePlayersInHand();

    // If only 1 player remains, hand ends
    if (activeInHand.length <= 1) return true;

    const playersCanAct = activeInHand.filter(p => !p.allIn);

    // If 0 or 1 players can act (others are all-in or folded), round is complete if everyone matched
    if (playersCanAct.length === 0) return true;

    // Every player who can act must have matched currentBet and had an opportunity to act
    const allMatched = playersCanAct.every(p => p.currentBet === this.currentBet);
    const minActions = activeInHand.length;

    // In preflop, BB must get an opportunity to act even if all just called BB
    return allMatched && (this.actionsCountThisRound >= minActions || (playersCanAct.length === 1 && allMatched));
  }

  checkRemainingPlayers() {
    const active = this.getActivePlayersInHand();
    if (active.length <= 1) {
      this.endHandEarly();
      return true;
    }
    return false;
  }

  getTotalPot() {
    let total = 0;
    for (const p of this.seats) {
      if (p && p.totalHandBet) {
        total += p.totalHandBet;
      }
    }
    return total;
  }

  get pot() {
    return this.getTotalPot();
  }

  advanceStage() {
    if (this.turnTimer) clearTimeout(this.turnTimer);

    // Reset round bets (totalHandBet remains intact for pot calculation)
    for (const p of this.seats) {
      if (p) {
        p.currentBet = 0;
        if (!p.folded && !p.allIn) {
          p.lastAction = null;
        }
      }
    }

    this.currentBet = 0;
    this.lastRaiseAmount = this.config.bigBlind;
    this.minRaise = this.config.bigBlind;
    this.actionsCountThisRound = 0;

    const playersCanAct = this.countPlayersCanAct();

    switch (this.stage) {
      case STAGES.PREFLOP:
        this.stage = STAGES.FLOP;
        this.communityCards = this.deck.drawMultiple(3);
        this.log(`Flop dealt: ${this.communityCards.map(c => c.display).join(' ')}`);
        break;

      case STAGES.FLOP:
        this.stage = STAGES.TURN;
        const turnCard = this.deck.draw();
        this.communityCards.push(turnCard);
        this.log(`Turn dealt: ${turnCard.display}`);
        break;

      case STAGES.TURN:
        this.stage = STAGES.RIVER;
        const riverCard = this.deck.draw();
        this.communityCards.push(riverCard);
        this.log(`River dealt: ${riverCard.display}`);
        break;

      case STAGES.RIVER:
        this.stage = STAGES.SHOWDOWN;
        this.handleShowdown();
        return;
    }

    // If fewer than 2 players can still make betting actions (e.g. all-in showdown)
    if (playersCanAct <= 1) {
      this.currentTurnSeatIndex = -1;
      switch (this.stage) {
        case STAGES.FLOP:
          this.setPendingHostAction('deal_turn', 'Deal Turn Card');
          break;
        case STAGES.TURN:
          this.setPendingHostAction('deal_river', 'Deal River Card');
          break;
        case STAGES.RIVER:
          this.setPendingHostAction('reveal_winner', 'Reveal Winner & Showdown');
          break;
      }
      this.notifyState();
      return;
    }

    // Next round action starts with first active player clockwise from Dealer
    this.currentTurnSeatIndex = this.getNextActiveSeatIndex(this.dealerSeatIndex, p => !p.folded && !p.allIn);
    this.startTurnTimer();
    this.notifyState();
  }

  // --- Side Pot & Showdown Calculation ---

  calculatePots() {
    // Calculates main pot and all side pots based on totalHandBet from each player
    const contributors = this.seats
      .filter(p => p !== null && p.totalHandBet > 0)
      .map(p => ({
        id: p.id,
        seatIndex: p.seatIndex,
        totalBet: p.totalHandBet,
        folded: p.folded
      }))
      .sort((a, b) => a.totalBet - b.totalBet);

    if (contributors.length === 0) return [];

    const pots = [];
    let previousLevel = 0;

    for (let i = 0; i < contributors.length; i++) {
      const currentLevel = contributors[i].totalBet;
      const difference = currentLevel - previousLevel;

      if (difference > 0) {
        let potAmount = 0;
        const eligiblePlayerIds = [];

        for (const c of contributors) {
          if (c.totalBet >= currentLevel) {
            potAmount += difference;
            if (!c.folded) {
              eligiblePlayerIds.push(c.id);
            }
          }
        }

        if (potAmount > 0 && eligiblePlayerIds.length > 0) {
          pots.push({
            amount: potAmount,
            eligiblePlayerIds
          });
        }
        previousLevel = currentLevel;
      }
    }

    return pots;
  }

  handleShowdown() {
    this.stage = STAGES.SHOWDOWN;
    if (this.turnTimer) clearTimeout(this.turnTimer);

    const pots = this.calculatePots();
    const activePlayers = this.getActivePlayersInHand();

    // Evaluate 5-card best hand for all showdown players
    for (const player of activePlayers) {
      player.evaluatedHand = evaluateHand(player.holeCards, this.communityCards);
      player.showCards = true;
    }

    const winnersMap = new Map(); // playerId -> { player, amountWon, handDescription, winningCards }

    // Award each side pot / main pot to best hand among eligible players
    for (const pot of pots) {
      const eligibleShowdownPlayers = activePlayers.filter(p => pot.eligiblePlayerIds.includes(p.id));
      if (eligibleShowdownPlayers.length === 0) continue;

      let bestScore = null;
      let potWinners = [];

      for (const p of eligibleShowdownPlayers) {
        if (!bestScore) {
          bestScore = p.evaluatedHand.score;
          potWinners = [p];
        } else {
          const comp = compareScores(p.evaluatedHand.score, bestScore);
          if (comp > 0) {
            bestScore = p.evaluatedHand.score;
            potWinners = [p];
          } else if (comp === 0) {
            potWinners.push(p);
          }
        }
      }

      const winShare = Math.floor(pot.amount / potWinners.length);
      const remainder = pot.amount % potWinners.length;

      potWinners.forEach((winner, idx) => {
        const extra = idx === 0 ? remainder : 0;
        const totalWin = winShare + extra;
        winner.chips += totalWin;

        if (winnersMap.has(winner.id)) {
          const entry = winnersMap.get(winner.id);
          entry.amountWon += totalWin;
        } else {
          winnersMap.set(winner.id, {
            id: winner.id,
            name: winner.name,
            seatIndex: winner.seatIndex,
            amountWon: totalWin,
            handName: winner.evaluatedHand.name,
            handDescription: winner.evaluatedHand.description,
            winningCards: winner.evaluatedHand.cards,
            holeCards: winner.holeCards
          });
        }
      });
    }

    this.winners = Array.from(winnersMap.values());
    if (this.winners.length > 1 && pots.length === 1) {
      this.log(`🤝 Split pot between ${this.winners.map(w => `${w.name} ($${w.amountWon.toLocaleString()})`).join(' & ')} with ${this.winners[0].handDescription}!`);
    } else {
      for (const w of this.winners) {
        this.log(`🏆 ${w.name} won $${w.amountWon.toLocaleString()} with ${w.handDescription}!`);
      }
    }

    this.endHand();
  }

  endHandEarly() {
    this.stage = STAGES.HAND_ENDED;
    if (this.turnTimer) clearTimeout(this.turnTimer);

    const remaining = this.getActivePlayersInHand();

    if (remaining.length === 1) {
      const winner = remaining[0];
      const totalPot = this.getTotalPot();
      winner.chips += totalPot;
      this.winners = [{
        id: winner.id,
        name: winner.name,
        seatIndex: winner.seatIndex,
        amountWon: totalPot,
        handName: 'Won by Fold',
        handDescription: 'All other players folded',
        winningCards: [],
        holeCards: [] // Hidden unless player chooses to show
      }];
      this.log(`🏆 ${winner.name} won $${totalPot.toLocaleString()} (all others folded).`);
    }

    this.endHand();
  }

  endHand() {
    this.stage = STAGES.HAND_ENDED;
    this.currentTurnSeatIndex = -1;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    if (this.nextHandTimer) clearTimeout(this.nextHandTimer);

    // Stop here and ask the room creator to start the next hand
    const eligible = this.getEligiblePlayersForNewHand();
    if (eligible.length >= 2) {
      this.setPendingHostAction('start_next_hand', 'Start Next Hand');
    } else {
      this.stage = STAGES.HAND_ENDED;
      this.pendingHostAction = null;
      this.log('Hand finished: Need at least 2 players with chips to start next hand.');
      this.notifyState();
    }
  }

  // --- State Sanitization & Client Views ---

  getPublicState() {
    return {
      roomCode: this.roomCode,
      stage: this.stage,
      handNumber: this.handNumber,
      communityCards: this.communityCards,
      pot: this.getTotalPot(),
      pots: this.calculatePots(),
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      dealerSeatIndex: this.dealerSeatIndex,
      smallBlindSeatIndex: this.smallBlindSeatIndex,
      bigBlindSeatIndex: this.bigBlindSeatIndex,
      currentTurnSeatIndex: this.currentTurnSeatIndex,
      pendingHostAction: this.pendingHostAction,
      pendingHostActionLabel: this.pendingHostActionLabel,
      winners: this.winners,
      handHistory: this.handHistory.slice(-20),
      config: {
        smallBlind: this.config.smallBlind,
        bigBlind: this.config.bigBlind,
        startingChips: this.config.startingChips,
        maxSeats: this.config.maxSeats,
        turnTimeoutMs: this.config.turnTimeoutMs,
        showHandHelper: this.config.showHandHelper
      },
      seats: this.seats.map((p, idx) => {
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          seatIndex: idx,
          chips: p.chips,
          currentBet: p.currentBet,
          folded: p.folded,
          allIn: p.allIn,
          disconnected: p.disconnected,
          lastAction: p.lastAction,
          hasCards: p.holeCards && p.holeCards.length > 0 && !p.folded,
          // Reveal cards at showdown, when hand ended, or if player won/chose to show
          holeCards: (this.stage === STAGES.SHOWDOWN || this.stage === STAGES.HAND_ENDED || (this.winners && this.winners.length > 0) || p.showCards) ? p.holeCards : [],
          evaluatedHand: ((this.stage === STAGES.SHOWDOWN || this.stage === STAGES.HAND_ENDED || (this.winners && this.winners.length > 0) || p.showCards) && p.evaluatedHand) ? {
            name: p.evaluatedHand.name,
            description: p.evaluatedHand.description
          } : null
        };
      })
    };
  }

  getPlayerPrivateState(playerId) {
    const publicState = this.getPublicState();
    const player = this.getPlayer(playerId);

    if (!player) {
      return {
        ...publicState,
        self: null,
        actions: { canAct: false }
      };
    }

    const isMyTurn = this.currentTurnSeatIndex === player.seatIndex && this.isGameActive() && !player.folded && !player.allIn;
    const callAmount = Math.max(0, this.currentBet - player.currentBet);
    const maxRaise = player.currentBet + player.chips;
    const minRaise = this.currentBet === 0 ? this.config.bigBlind : Math.min(this.minRaise, maxRaise);

    // Current best hand evaluation for the player previewing their own hand (if helper enabled)
    let currentEvaluation = null;
    if (this.config.showHandHelper && player.holeCards.length > 0 && !player.folded) {
      currentEvaluation = evaluateHand(player.holeCards, this.communityCards);
    }

    return {
      ...publicState,
      self: {
        id: player.id,
        name: player.name,
        seatIndex: player.seatIndex,
        chips: player.chips,
        holeCards: player.holeCards,
        folded: player.folded,
        allIn: player.allIn,
        currentEvaluation: currentEvaluation ? {
          name: currentEvaluation.name,
          description: currentEvaluation.description
        } : null
      },
      actions: {
        canAct: isMyTurn,
        canFold: isMyTurn,
        canCheck: isMyTurn && callAmount === 0,
        canCall: isMyTurn && callAmount > 0,
        canBet: isMyTurn && this.currentBet === 0 && player.chips > 0,
        canRaise: isMyTurn && this.currentBet > 0 && player.chips > callAmount,
        callAmount: Math.min(player.chips, callAmount),
        minRaise: minRaise,
        maxRaise: maxRaise,
        currentBet: this.currentBet
      }
    };
  }
}

module.exports = {
  PokerGame,
  STAGES
};
