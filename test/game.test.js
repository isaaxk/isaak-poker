const assert = require('assert');
const { PokerGame, STAGES } = require('../server/game');

function testGameFlow() {
  console.log('Testing Poker Game Engine Simulation...');

  const game = new PokerGame('TEST01', {
    smallBlind: 10,
    bigBlind: 20,
    startingChips: 1000,
    turnTimeoutMs: 100000,
    nextHandDelayMs: 100000
  });

  // 1. Add Players
  const p1 = game.addPlayer({ id: 'p1', name: 'Alice', socketId: 's1', chips: 1000 });
  const p2 = game.addPlayer({ id: 'p2', name: 'Bob', socketId: 's2', chips: 1000 });
  assert(p1.success && p2.success, 'Players successfully seated');
  assert.strictEqual(game.getSeatedPlayers().length, 2, '2 players seated');

  // 2. Start Game
  game.dealerSeatIndex = 1; // Prior to start, so startNewHand rotates to 0 (Alice is Dealer/SB)
  const startResult = game.startGame();
  assert(startResult.success, 'Game started');
  assert.strictEqual(game.stage, STAGES.PREFLOP, 'Stage is preflop');

  const alice = game.getPlayer('p1');
  const bob = game.getPlayer('p2');

  assert.strictEqual(alice.holeCards.length, 2, 'Alice has 2 hole cards');
  assert.strictEqual(bob.holeCards.length, 2, 'Bob has 2 hole cards');

  // Heads-up: Dealer is SB (Alice), acts first preflop
  assert.strictEqual(alice.currentBet, 10, 'Alice posted Small Blind 10');
  assert.strictEqual(bob.currentBet, 20, 'Bob posted Big Blind 20');
  assert.strictEqual(game.currentBet, 20, 'Current bet is 20');
  assert.strictEqual(game.currentTurnSeatIndex, alice.seatIndex, 'Alice acts first preflop');

  // 3. Preflop: Alice calls 10 (total 20), Bob checks
  const aliceCall = game.handlePlayerAction('p1', 'call');
  assert(aliceCall.success, 'Alice call successful');
  assert.strictEqual(alice.currentBet, 20, 'Alice bet matched 20');
  assert.strictEqual(game.currentTurnSeatIndex, bob.seatIndex, 'Now Bob turn');

  const bobCheck = game.handlePlayerAction('p2', 'check');
  assert(bobCheck.success, 'Bob check successful');

  // Preflop complete -> Prompts host to deal Flop
  assert.strictEqual(game.pendingHostAction, 'deal_flop', 'Host prompted to deal Flop');
  assert.strictEqual(game.communityCards.length, 0, 'Flop not dealt before host approval');
  const dealFlop = game.executeHostAction('deal_flop');
  assert(dealFlop.success, 'Host dealt Flop');

  // Should transition to Flop
  assert.strictEqual(game.stage, STAGES.FLOP, 'Stage transitioned to Flop');
  assert.strictEqual(game.communityCards.length, 3, 'Flop has 3 community cards');
  assert.strictEqual(game.pot, 40, 'Pot collected 40 chips');
  assert.strictEqual(alice.currentBet, 0, 'Alice round bet reset');
  assert.strictEqual(bob.currentBet, 0, 'Bob round bet reset');

  // 4. Flop: Bob checks, Alice bets 40, Bob calls
  // In heads-up postflop, Bob (non-dealer) acts first
  assert.strictEqual(game.currentTurnSeatIndex, bob.seatIndex, 'Bob acts first post-flop');
  game.handlePlayerAction('p2', 'check');
  game.handlePlayerAction('p1', 'bet', 40);
  assert.strictEqual(game.currentBet, 40, 'Current bet is 40');
  game.handlePlayerAction('p2', 'call');

  // Flop complete -> Prompts host to deal Turn
  assert.strictEqual(game.pendingHostAction, 'deal_turn', 'Host prompted to deal Turn');
  assert.strictEqual(game.communityCards.length, 3, 'Turn not dealt before host approval');
  const dealTurn = game.executeHostAction('deal_turn');
  assert(dealTurn.success, 'Host dealt Turn');

  // Should transition to Turn
  assert.strictEqual(game.stage, STAGES.TURN, 'Stage transitioned to Turn');
  assert.strictEqual(game.communityCards.length, 4, 'Turn has 4 community cards');
  assert.strictEqual(game.pot, 120, 'Pot is 120');

  // 5. Turn: Both check
  game.handlePlayerAction('p2', 'check');
  game.handlePlayerAction('p1', 'check');

  // Turn complete -> Prompts host to deal River
  assert.strictEqual(game.pendingHostAction, 'deal_river', 'Host prompted to deal River');
  assert.strictEqual(game.communityCards.length, 4, 'River not dealt before host approval');
  const dealRiver = game.executeHostAction('deal_river');
  assert(dealRiver.success, 'Host dealt River');

  // Should transition to River
  assert.strictEqual(game.stage, STAGES.RIVER, 'Stage transitioned to River');
  assert.strictEqual(game.communityCards.length, 5, 'River has 5 community cards');

  // 6. River: Both check -> Prompts host to reveal showdown & winner
  game.handlePlayerAction('p2', 'check');
  game.handlePlayerAction('p1', 'check');

  assert.strictEqual(game.pendingHostAction, 'reveal_winner', 'Host prompted to reveal Winner');
  assert.strictEqual(game.winners.length, 0, 'Winners not revealed before host approval');
  const revealWinner = game.executeHostAction('reveal_winner');
  assert(revealWinner.success, 'Host revealed winner');

  assert.strictEqual(game.stage, STAGES.HAND_ENDED, 'Stage ended at showdown');
  assert.strictEqual(game.pendingHostAction, 'start_next_hand', 'Creator prompted to start next hand');
  assert(game.winners.length >= 1, 'Winners decided');
  console.log(`✔ Showdown winner: ${game.winners.map(w => `${w.name} ($${w.amountWon}) with ${w.handDescription}`).join(', ')}`);

  const totalChips = alice.chips + bob.chips;
  assert.strictEqual(totalChips, 2000, 'Total chip balance preserved');
  console.log('✔ Complete Texas Holdem betting cycle passed');

  // 7. Test Fold Win
  console.log('Testing Fold Win...');
  const gameFold = new PokerGame('TEST02', { smallBlind: 10, bigBlind: 20, startingChips: 1000 });
  gameFold.addPlayer({ id: 'p1', name: 'Alice', chips: 1000 });
  gameFold.addPlayer({ id: 'p2', name: 'Bob', chips: 1000 });
  gameFold.startGame();

  // Preflop: Current turn player raises or folds
  const firstToActId = gameFold.seats[gameFold.currentTurnSeatIndex].id;
  const otherPlayerId = firstToActId === 'p1' ? 'p2' : 'p1';

  gameFold.handlePlayerAction(firstToActId, 'raise', 100);
  const otherFold = gameFold.handlePlayerAction(otherPlayerId, 'fold');
  assert(otherFold.success, 'Fold successful');
  assert.strictEqual(gameFold.stage, STAGES.HAND_ENDED, 'Hand ended immediately on fold');
  assert.strictEqual(gameFold.pendingHostAction, 'start_next_hand', 'Creator prompted to start next hand on fold win');
  assert.strictEqual(gameFold.winners[0].id, firstToActId, 'First player awarded pot on fold');

  // Verify creator can start the next hand manually
  const nextHandRes = gameFold.executeHostAction('start_next_hand');
  assert(nextHandRes.success, 'Host started next hand successfully');
  assert.strictEqual(gameFold.handNumber, 2, 'Hand number advanced to 2');
  assert.strictEqual(gameFold.stage, STAGES.PREFLOP, 'Stage is now PREFLOP');
  console.log('✔ Manual creator progression to next hand verified');
  // 9. Test Split Pot (Chop)
  console.log('Testing Split Pot (Chop) Simulation...');
  const gameSplit = new PokerGame('TEST_SPLIT', { smallBlind: 10, bigBlind: 20, startingChips: 1000 });
  gameSplit.addPlayer({ id: 'p1', name: 'Alice', chips: 1000 });
  gameSplit.addPlayer({ id: 'p2', name: 'Bob', chips: 1000 });
  gameSplit.startGame();

  // Rig hole cards and board for exact tie
  const p1Split = gameSplit.getPlayer('p1');
  const p2Split = gameSplit.getPlayer('p2');
  p1Split.holeCards = [{ rank: 14, suit: 's' }, { rank: 13, suit: 's' }]; // A♠ K♠
  p2Split.holeCards = [{ rank: 14, suit: 'h' }, { rank: 13, suit: 'h' }]; // A♥ K♥
  gameSplit.communityCards = [
    { rank: 12, suit: 'd' }, // Q♦
    { rank: 11, suit: 'c' }, // J♣
    { rank: 10, suit: 'd' }, // 10♦
    { rank: 2, suit: 'c' },
    { rank: 3, suit: 's' }
  ]; // Broadway straight for both (A-K-Q-J-10)

  // Preflop bets: each puts in 100
  p1Split.totalHandBet = 100;
  p2Split.totalHandBet = 100;
  p1Split.chips = 900;
  p2Split.chips = 900;

  assert.strictEqual(gameSplit.getTotalPot(), 200, 'Total pot is 200 before showdown');
  gameSplit.handleShowdown();

  assert.strictEqual(gameSplit.winners.length, 2, 'Two winners in split pot');
  assert.strictEqual(gameSplit.winners[0].amountWon, 100, 'Alice won 100 (half of 200)');
  assert.strictEqual(gameSplit.winners[1].amountWon, 100, 'Bob won 100 (half of 200)');
  assert.strictEqual(p1Split.chips, 1000, 'Alice returned to 1000 chips');
  assert.strictEqual(p2Split.chips, 1000, 'Bob returned to 1000 chips');
  console.log('✔ Split pot (Chop) test passed ($100 each)');

  // 10. Test Pot Accuracy During Hand
  console.log('Testing Realtime Pot Accuracy...');
  const gamePot = new PokerGame('TEST_POT', { smallBlind: 10, bigBlind: 20, startingChips: 1000 });
  gamePot.addPlayer({ id: 'p1', name: 'Alice', chips: 1000 });
  gamePot.addPlayer({ id: 'p2', name: 'Bob', chips: 1000 });
  gamePot.addPlayer({ id: 'p3', name: 'Charlie', chips: 1000 });
  gamePot.startGame();

  // Blinds posted: SB(10) + BB(20) = 30
  assert.strictEqual(gamePot.getPublicState().pot, 30, 'Pot immediately shows 30 after blinds');
  gamePot.handlePlayerAction(gamePot.seats[gamePot.currentTurnSeatIndex].id, 'call'); // 20
  assert.strictEqual(gamePot.getPublicState().pot, 50, 'Pot updates to 50 after call');
  console.log('✔ Realtime pot accuracy tests passed');

  // 11. Test 20 Players Full Ring Game
  console.log('Testing 20-Player Game Setup...');
  const game20 = new PokerGame('TEST20', { maxSeats: 20, smallBlind: 10, bigBlind: 20, startingChips: 1000 });
  for (let i = 1; i <= 20; i++) {
    const res = game20.addPlayer({ id: `p${i}`, name: `Player ${i}`, chips: 1000 });
    assert(res.success, `Player ${i} seated`);
  }
  assert.strictEqual(game20.getSeatedPlayers().length, 20, '20 players seated');
  const start20 = game20.startGame();
  assert(start20.success, '20-player game started successfully');
  assert.strictEqual(game20.seats.filter(s => s && s.holeCards.length === 2).length, 20, 'All 20 players dealt 2 cards');
  console.log('✔ 20-player full table test passed');

  // 12. Test Protection of the All-In (Short-stack calling a larger bet)
  console.log('Testing Protection of the All-In Scenario...');
  const gameAllIn = new PokerGame('TEST_ALLIN', { smallBlind: 10, bigBlind: 20, startingChips: 1000 });
  gameAllIn.addPlayer({ id: 'p1', name: 'Alice', chips: 1000 });
  gameAllIn.addPlayer({ id: 'p2', name: 'Bob', chips: 40 }); // Bob only has $40!
  gameAllIn.startGame();

  const aliceAllIn = gameAllIn.getPlayer('p1');
  const bobAllIn = gameAllIn.getPlayer('p2');

  // Handle betting regardless of which player is randomly assigned SB in hand #1
  const firstTurnId = gameAllIn.seats[gameAllIn.currentTurnSeatIndex].id;
  if (firstTurnId === 'p1') {
    gameAllIn.handlePlayerAction('p1', 'raise', 100);
    const bobCall = gameAllIn.handlePlayerAction('p2', 'call');
    assert(bobCall.success, 'Bob successfully called all-in with remaining chips');
  } else {
    gameAllIn.handlePlayerAction('p2', 'call'); // Bob matches BB
    gameAllIn.handlePlayerAction('p1', 'raise', 100); // Alice raises to 100
    const bobCall = gameAllIn.handlePlayerAction('p2', 'call'); // Bob calls all-in with remaining 20
    assert(bobCall.success, 'Bob successfully called all-in with remaining chips');
  }

  assert.strictEqual(bobAllIn.chips, 0, 'Bob has 0 chips');
  assert.strictEqual(bobAllIn.allIn, true, 'Bob is all-in');
  assert.strictEqual(bobAllIn.totalHandBet, 40, 'Bob totalHandBet is 40');
  assert.strictEqual(aliceAllIn.totalHandBet, 100, 'Alice totalHandBet is 100');

  // Verify side pots structure:
  // Main Pot: $80 ($40 from Bob + $40 from Alice), eligible: [Bob, Alice]
  // Side Pot / Excess: $60 (from Alice), eligible: [Alice]
  const calculatedPots = gameAllIn.calculatePots();
  assert.strictEqual(calculatedPots.length, 2, 'Two pots formed (Main Pot + Unmatched Excess)');
  assert.strictEqual(calculatedPots[0].amount, 80, 'Main pot is $80');
  assert.deepStrictEqual(calculatedPots[0].eligiblePlayerIds.sort(), ['p1', 'p2'].sort(), 'Both eligible for Main Pot');
  assert.strictEqual(calculatedPots[1].amount, 60, 'Side pot is $60');
  assert.deepStrictEqual(calculatedPots[1].eligiblePlayerIds, ['p1'], 'Only Alice eligible for excess $60');

  // Rig hole cards: Bob has Royal Flush, Alice has High Card
  bobAllIn.holeCards = [{ rank: 14, suit: 's' }, { rank: 13, suit: 's' }];
  aliceAllIn.holeCards = [{ rank: 2, suit: 'c' }, { rank: 3, suit: 'd' }];
  gameAllIn.communityCards = [
    { rank: 12, suit: 's' },
    { rank: 11, suit: 's' },
    { rank: 10, suit: 's' },
    { rank: 8, suit: 'h' },
    { rank: 7, suit: 'd' }
  ];

  gameAllIn.handleShowdown();

  // Bob wins Main Pot ($80). Alice gets back unmatched $60.
  assert.strictEqual(bobAllIn.chips, 80, 'Bob doubled his $40 stack to $80!');
  assert.strictEqual(aliceAllIn.chips, 960, 'Alice received $60 excess back, losing only matched $40');
  assert.strictEqual(bobAllIn.chips + aliceAllIn.chips, 1040, 'Exact total chips preserved');
  console.log('✔ Protection of the All-In test passed (Bob won $80 main pot, Alice refunded $60 excess)');

  console.log('\nAll game simulation tests passed successfully!\n');
}

testGameFlow();
