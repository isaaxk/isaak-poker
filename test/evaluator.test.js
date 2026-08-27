const assert = require('assert');
const { evaluate5Cards, evaluateHand, compareScores, HAND_TYPES } = require('../server/evaluator');

function testEvaluator() {
  console.log('Testing Hand Evaluator...');

  // 1. Royal Flush
  const royalFlush = [
    { rank: 14, suit: 's' },
    { rank: 13, suit: 's' },
    { rank: 12, suit: 's' },
    { rank: 11, suit: 's' },
    { rank: 10, suit: 's' }
  ];
  const rfResult = evaluate5Cards(royalFlush);
  assert.strictEqual(rfResult.rank, HAND_TYPES.ROYAL_FLUSH.rank, 'Royal flush rank check');
  console.log('✔ Royal Flush passed');

  // 2. Straight Flush (Wheel A-2-3-4-5)
  const wheelStraightFlush = [
    { rank: 14, suit: 'h' },
    { rank: 5, suit: 'h' },
    { rank: 4, suit: 'h' },
    { rank: 3, suit: 'h' },
    { rank: 2, suit: 'h' }
  ];
  const wsfResult = evaluate5Cards(wheelStraightFlush);
  assert.strictEqual(wsfResult.rank, HAND_TYPES.STRAIGHT_FLUSH.rank, 'Wheel straight flush check');
  assert.strictEqual(wsfResult.score[1], 5, 'Wheel straight flush high card is 5');
  console.log('✔ Wheel Straight Flush passed');

  // 3. Four of a Kind
  const quads = [
    { rank: 9, suit: 's' },
    { rank: 9, suit: 'h' },
    { rank: 9, suit: 'd' },
    { rank: 9, suit: 'c' },
    { rank: 14, suit: 's' }
  ];
  const quadsResult = evaluate5Cards(quads);
  assert.strictEqual(quadsResult.rank, HAND_TYPES.FOUR_OF_A_KIND.rank);
  console.log('✔ Four of a Kind passed');

  // 4. Full House
  const fullHouse = [
    { rank: 14, suit: 's' },
    { rank: 14, suit: 'h' },
    { rank: 14, suit: 'd' },
    { rank: 13, suit: 'c' },
    { rank: 13, suit: 's' }
  ];
  const fhResult = evaluate5Cards(fullHouse);
  assert.strictEqual(fhResult.rank, HAND_TYPES.FULL_HOUSE.rank);
  console.log('✔ Full House passed');

  // 5. Flush
  const flush = [
    { rank: 14, suit: 'd' },
    { rank: 10, suit: 'd' },
    { rank: 7, suit: 'd' },
    { rank: 6, suit: 'd' },
    { rank: 2, suit: 'd' }
  ];
  const flushResult = evaluate5Cards(flush);
  assert.strictEqual(flushResult.rank, HAND_TYPES.FLUSH.rank);
  console.log('✔ Flush passed');

  // 6. Straight (Wheel vs Higher)
  const wheelStraight = [
    { rank: 14, suit: 's' },
    { rank: 5, suit: 'h' },
    { rank: 4, suit: 'd' },
    { rank: 3, suit: 'c' },
    { rank: 2, suit: 's' }
  ];
  const sixHighStraight = [
    { rank: 6, suit: 's' },
    { rank: 5, suit: 'h' },
    { rank: 4, suit: 'd' },
    { rank: 3, suit: 'c' },
    { rank: 2, suit: 's' }
  ];
  const wsResult = evaluate5Cards(wheelStraight);
  const shsResult = evaluate5Cards(sixHighStraight);
  assert.strictEqual(wsResult.rank, HAND_TYPES.STRAIGHT.rank);
  assert.strictEqual(shsResult.rank, HAND_TYPES.STRAIGHT.rank);
  assert(compareScores(shsResult.score, wsResult.score) > 0, '6-high straight beats 5-high wheel straight');
  console.log('✔ Straights and Wheel straight passed');

  // 7. Two Pair Kicker Comparison
  const twoPairA = [
    { rank: 10, suit: 's' },
    { rank: 10, suit: 'h' },
    { rank: 8, suit: 'd' },
    { rank: 8, suit: 'c' },
    { rank: 14, suit: 's' } // Ace kicker
  ];
  const twoPairB = [
    { rank: 10, suit: 'c' },
    { rank: 10, suit: 'd' },
    { rank: 8, suit: 's' },
    { rank: 8, suit: 'h' },
    { rank: 13, suit: 's' } // King kicker
  ];
  const tpA = evaluate5Cards(twoPairA);
  const tpB = evaluate5Cards(twoPairB);
  assert.strictEqual(tpA.rank, HAND_TYPES.TWO_PAIR.rank);
  assert(compareScores(tpA.score, tpB.score) > 0, 'Two pair with Ace kicker beats Two pair with King kicker');
  console.log('✔ Two Pair kicker comparisons passed');

  // 8. 7-Card evaluation: Pick best 5 from 7
  const holeCards = [
    { rank: 14, suit: 's' },
    { rank: 13, suit: 's' }
  ];
  const communityCards = [
    { rank: 12, suit: 's' },
    { rank: 11, suit: 's' },
    { rank: 10, suit: 's' },
    { rank: 2, suit: 'h' },
    { rank: 3, suit: 'd' }
  ];
  const best7 = evaluateHand(holeCards, communityCards);
  assert.strictEqual(best7.rank, HAND_TYPES.ROYAL_FLUSH.rank, '7-card hand correctly identifies Royal Flush');
  console.log('✔ 7-card best hand selection passed');

  // 9. GOLDEN RULE 1: Highest Card Rule
  console.log('Testing Golden Rule 1: Highest Card Rule...');

  // 9a. Flush vs Flush (Ace-high vs King-high)
  const aceHighFlush = [
    { rank: 14, suit: 's' }, { rank: 10, suit: 's' }, { rank: 7, suit: 's' }, { rank: 6, suit: 's' }, { rank: 2, suit: 's' }
  ];
  const kingHighFlush = [
    { rank: 13, suit: 'h' }, { rank: 12, suit: 'h' }, { rank: 11, suit: 'h' }, { rank: 9, suit: 'h' }, { rank: 7, suit: 'h' }
  ];
  const ahf = evaluate5Cards(aceHighFlush);
  const khf = evaluate5Cards(kingHighFlush);
  assert(compareScores(ahf.score, khf.score) > 0, 'Ace-high flush beats King-high flush');

  // 9b. Flush with matching high card, kicker tie-break
  const flushA = [
    { rank: 14, suit: 'd' }, { rank: 12, suit: 'd' }, { rank: 9, suit: 'd' }, { rank: 6, suit: 'd' }, { rank: 4, suit: 'd' }
  ];
  const flushB = [
    { rank: 14, suit: 'c' }, { rank: 11, suit: 'c' }, { rank: 10, suit: 'c' }, { rank: 8, suit: 'c' }, { rank: 3, suit: 'c' }
  ];
  assert(compareScores(evaluate5Cards(flushA).score, evaluate5Cards(flushB).score) > 0, 'A-Q-9-6-4 flush beats A-J-10-8-3 flush');

  // 9c. Full House: Highest 3-of-a-kind wins (Kings full of 4s vs Queens full of Aces)
  const fhKings = [
    { rank: 13, suit: 's' }, { rank: 13, suit: 'h' }, { rank: 13, suit: 'd' }, { rank: 4, suit: 'c' }, { rank: 4, suit: 's' }
  ];
  const fhQueens = [
    { rank: 12, suit: 's' }, { rank: 12, suit: 'h' }, { rank: 12, suit: 'd' }, { rank: 14, suit: 'c' }, { rank: 14, suit: 's' }
  ];
  assert(compareScores(evaluate5Cards(fhKings).score, evaluate5Cards(fhQueens).score) > 0, 'Kings full of 4s beats Queens full of Aces');

  // 9d. Full House: Same 3-of-a-kind, highest pair wins (Kings full of 10s vs Kings full of 8s)
  const fhKTens = [
    { rank: 13, suit: 's' }, { rank: 13, suit: 'h' }, { rank: 13, suit: 'd' }, { rank: 10, suit: 'c' }, { rank: 10, suit: 's' }
  ];
  const fhKEights = [
    { rank: 13, suit: 'c' }, { rank: 13, suit: 'h' }, { rank: 13, suit: 'd' }, { rank: 8, suit: 's' }, { rank: 8, suit: 'h' }
  ];
  assert(compareScores(evaluate5Cards(fhKTens).score, evaluate5Cards(fhKEights).score) > 0, 'Kings full of 10s beats Kings full of 8s');

  // 9e. Two Pair: Highest top pair wins (Aces and 4s vs Kings and Queens)
  const tpAces = [
    { rank: 14, suit: 's' }, { rank: 14, suit: 'h' }, { rank: 4, suit: 'd' }, { rank: 4, suit: 'c' }, { rank: 2, suit: 's' }
  ];
  const tpKingsQueens = [
    { rank: 13, suit: 's' }, { rank: 13, suit: 'h' }, { rank: 12, suit: 'd' }, { rank: 12, suit: 'c' }, { rank: 14, suit: 's' }
  ];
  assert(compareScores(evaluate5Cards(tpAces).score, evaluate5Cards(tpKingsQueens).score) > 0, 'Pair of Aces & 4s beats Pair of Kings & Queens');

  // 9f. Two Pair: Matching top pair, highest second pair wins (Aces & Jacks vs Aces & Tens)
  const tpAcesJacks = [
    { rank: 14, suit: 's' }, { rank: 14, suit: 'h' }, { rank: 11, suit: 'd' }, { rank: 11, suit: 'c' }, { rank: 2, suit: 's' }
  ];
  const tpAcesTens = [
    { rank: 14, suit: 'c' }, { rank: 14, suit: 'd' }, { rank: 10, suit: 's' }, { rank: 10, suit: 'h' }, { rank: 13, suit: 's' }
  ];
  assert(compareScores(evaluate5Cards(tpAcesJacks).score, evaluate5Cards(tpAcesTens).score) > 0, 'Aces and Jacks beats Aces and Tens');
  console.log('✔ Golden Rule 1 (Highest Card Rule) tests passed');

  // 10. GOLDEN RULE 2: The Kicker Rule
  console.log('Testing Golden Rule 2: The Kicker Rule...');

  // User Exact Example: Player A [A, A, K, 8, 4] vs Player B [A, A, Q, J, 9]
  const playerA_PairAces = [
    { rank: 14, suit: 's' }, { rank: 14, suit: 'h' }, { rank: 13, suit: 'd' }, { rank: 8, suit: 'c' }, { rank: 4, suit: 's' }
  ];
  const playerB_PairAces = [
    { rank: 14, suit: 'c' }, { rank: 14, suit: 'd' }, { rank: 12, suit: 's' }, { rank: 11, suit: 'h' }, { rank: 9, suit: 's' }
  ];
  const evalA = evaluate5Cards(playerA_PairAces);
  const evalB = evaluate5Cards(playerB_PairAces);
  assert.strictEqual(evalA.rank, HAND_TYPES.ONE_PAIR.rank);
  assert.strictEqual(evalB.rank, HAND_TYPES.ONE_PAIR.rank);
  assert(compareScores(evalA.score, evalB.score) > 0, 'Player A wins with King kicker over Queen kicker');

  // 10b. Second kicker test (A, A, K, 8, 4 vs A, A, K, 7, 6)
  const pairAcesK8 = [
    { rank: 14, suit: 's' }, { rank: 14, suit: 'h' }, { rank: 13, suit: 'd' }, { rank: 8, suit: 'c' }, { rank: 4, suit: 's' }
  ];
  const pairAcesK7 = [
    { rank: 14, suit: 'c' }, { rank: 14, suit: 'd' }, { rank: 13, suit: 's' }, { rank: 7, suit: 'h' }, { rank: 6, suit: 's' }
  ];
  assert(compareScores(evaluate5Cards(pairAcesK8).score, evaluate5Cards(pairAcesK7).score) > 0, 'A-A-K-8-4 beats A-A-K-7-6 via 2nd kicker (8 vs 7)');

  // 10c. Three of a kind kicker (8, 8, 8, K, 4 vs 8, 8, 8, Q, J)
  const tripsKickerK = [
    { rank: 8, suit: 's' }, { rank: 8, suit: 'h' }, { rank: 8, suit: 'd' }, { rank: 13, suit: 'c' }, { rank: 4, suit: 's' }
  ];
  const tripsKickerQ = [
    { rank: 8, suit: 'c' }, { rank: 8, suit: 'h' }, { rank: 8, suit: 'd' }, { rank: 12, suit: 's' }, { rank: 11, suit: 'h' }
  ];
  assert(compareScores(evaluate5Cards(tripsKickerK).score, evaluate5Cards(tripsKickerQ).score) > 0, '8-8-8-K-4 beats 8-8-8-Q-J with King kicker');

  // 10d. Quads kicker (9, 9, 9, 9, A vs 9, 9, 9, 9, K)
  const quadsAceKicker = [
    { rank: 9, suit: 's' }, { rank: 9, suit: 'h' }, { rank: 9, suit: 'd' }, { rank: 9, suit: 'c' }, { rank: 14, suit: 's' }
  ];
  const quadsKingKicker = [
    { rank: 9, suit: 's' }, { rank: 9, suit: 'h' }, { rank: 9, suit: 'd' }, { rank: 9, suit: 'c' }, { rank: 13, suit: 's' }
  ];
  assert(compareScores(evaluate5Cards(quadsAceKicker).score, evaluate5Cards(quadsKingKicker).score) > 0, '9-9-9-9-A beats 9-9-9-9-K with Ace kicker');
  console.log('✔ Golden Rule 2 (The Kicker Rule) tests passed');

  // 11. GOLDEN RULE 3: Split Pot (Chop) & Suits Never Break Ties
  console.log('Testing Golden Rule 3: Split Pot & Suits Never Break Ties...');

  // 11a. Straight Flush in Spades vs Straight Flush in Hearts (Exact same ranks)
  const sfSpades = [
    { rank: 9, suit: 's' }, { rank: 8, suit: 's' }, { rank: 7, suit: 's' }, { rank: 6, suit: 's' }, { rank: 5, suit: 's' }
  ];
  const sfHearts = [
    { rank: 9, suit: 'h' }, { rank: 8, suit: 'h' }, { rank: 7, suit: 'h' }, { rank: 6, suit: 'h' }, { rank: 5, suit: 'h' }
  ];
  assert.strictEqual(compareScores(evaluate5Cards(sfSpades).score, evaluate5Cards(sfHearts).score), 0, 'Straight flushes in different suits tie (suits never break ties)');

  // 11b. Exact same 5-card rank One Pair (A, A, K, 8, 4) in different suits
  const pairAcesSpades = [
    { rank: 14, suit: 's' }, { rank: 14, suit: 'h' }, { rank: 13, suit: 'd' }, { rank: 8, suit: 'c' }, { rank: 4, suit: 's' }
  ];
  const pairAcesClubs = [
    { rank: 14, suit: 'c' }, { rank: 14, suit: 'd' }, { rank: 13, suit: 'h' }, { rank: 8, suit: 's' }, { rank: 4, suit: 'h' }
  ];
  assert.strictEqual(compareScores(evaluate5Cards(pairAcesSpades).score, evaluate5Cards(pairAcesClubs).score), 0, 'Identical 5-card ranks in different suits tie');
  console.log('✔ Golden Rule 3 (Split Pot & Suits Never Break Ties) tests passed');

  console.log('\nAll evaluator tests passed successfully!\n');
}

testEvaluator();
