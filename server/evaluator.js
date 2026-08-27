const HAND_TYPES = {
  ROYAL_FLUSH: { rank: 9, name: 'Royal Flush' },
  STRAIGHT_FLUSH: { rank: 8, name: 'Straight Flush' },
  FOUR_OF_A_KIND: { rank: 7, name: 'Four of a Kind' },
  FULL_HOUSE: { rank: 6, name: 'Full House' },
  FLUSH: { rank: 5, name: 'Flush' },
  STRAIGHT: { rank: 4, name: 'Straight' },
  THREE_OF_A_KIND: { rank: 3, name: 'Three of a Kind' },
  TWO_PAIR: { rank: 2, name: 'Two Pair' },
  ONE_PAIR: { rank: 1, name: 'One Pair' },
  HIGH_CARD: { rank: 0, name: 'High Card' }
};

const RANK_LABELS = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven',
  8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace'
};

const RANK_LABELS_PLURAL = {
  2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens',
  8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces'
};

/**
 * Generate all combinations of k items from array arr
 */
function getCombinations(arr, k) {
  const result = [];
  function backtrack(start, combo) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      backtrack(i + 1, combo);
      combo.pop();
    }
  }
  backtrack(0, []);
  return result;
}

/**
 * Evaluates exactly 5 cards and returns the hand ranking and score array.
 */
function evaluate5Cards(cards) {
  // Sort descending by rank
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map(c => c.rank);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;
  let straightCards = sorted;

  if (
    ranks[0] - ranks[1] === 1 &&
    ranks[1] - ranks[2] === 1 &&
    ranks[2] - ranks[3] === 1 &&
    ranks[3] - ranks[4] === 1
  ) {
    isStraight = true;
    straightHigh = ranks[0];
  } else if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    // 5-high straight (Wheel: A-2-3-4-5)
    isStraight = true;
    straightHigh = 5;
    // Reorder wheel so 5 is at front and Ace is at back for display
    straightCards = [sorted[1], sorted[2], sorted[3], sorted[4], sorted[0]];
  }

  // Count rank frequencies
  const counts = {};
  for (const r of ranks) {
    counts[r] = (counts[r] || 0) + 1;
  }

  const freqEntries = Object.entries(counts).map(([r, count]) => ({
    rank: Number(r),
    count
  }));

  // Sort by count descending, then by rank descending
  freqEntries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.rank - a.rank;
  });

  // 1. Royal Flush / Straight Flush
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return {
        rank: HAND_TYPES.ROYAL_FLUSH.rank,
        name: HAND_TYPES.ROYAL_FLUSH.name,
        description: `Royal Flush in ${sorted[0].suit.toUpperCase()}`,
        score: [HAND_TYPES.ROYAL_FLUSH.rank, 14],
        cards: straightCards
      };
    }
    return {
      rank: HAND_TYPES.STRAIGHT_FLUSH.rank,
      name: HAND_TYPES.STRAIGHT_FLUSH.name,
      description: `${RANK_LABELS[straightHigh]}-high Straight Flush`,
      score: [HAND_TYPES.STRAIGHT_FLUSH.rank, straightHigh],
      cards: straightCards
    };
  }

  // 2. Four of a Kind
  if (freqEntries[0].count === 4) {
    const quadRank = freqEntries[0].rank;
    const kicker = freqEntries[1].rank;
    return {
      rank: HAND_TYPES.FOUR_OF_A_KIND.rank,
      name: HAND_TYPES.FOUR_OF_A_KIND.name,
      description: `Four of a Kind, ${RANK_LABELS_PLURAL[quadRank]}`,
      score: [HAND_TYPES.FOUR_OF_A_KIND.rank, quadRank, kicker],
      cards: sorted
    };
  }

  // 3. Full House
  if (freqEntries[0].count === 3 && freqEntries[1].count === 2) {
    const tripRank = freqEntries[0].rank;
    const pairRank = freqEntries[1].rank;
    return {
      rank: HAND_TYPES.FULL_HOUSE.rank,
      name: HAND_TYPES.FULL_HOUSE.name,
      description: `Full House, ${RANK_LABELS_PLURAL[tripRank]} full of ${RANK_LABELS_PLURAL[pairRank]}`,
      score: [HAND_TYPES.FULL_HOUSE.rank, tripRank, pairRank],
      cards: sorted
    };
  }

  // 4. Flush
  if (isFlush) {
    return {
      rank: HAND_TYPES.FLUSH.rank,
      name: HAND_TYPES.FLUSH.name,
      description: `Flush, ${RANK_LABELS[ranks[0]]}-high`,
      score: [HAND_TYPES.FLUSH.rank, ...ranks],
      cards: sorted
    };
  }

  // 5. Straight
  if (isStraight) {
    return {
      rank: HAND_TYPES.STRAIGHT.rank,
      name: HAND_TYPES.STRAIGHT.name,
      description: `Straight, ${RANK_LABELS[straightHigh]}-high`,
      score: [HAND_TYPES.STRAIGHT.rank, straightHigh],
      cards: straightCards
    };
  }

  // 6. Three of a Kind
  if (freqEntries[0].count === 3) {
    const tripRank = freqEntries[0].rank;
    const kickers = [freqEntries[1].rank, freqEntries[2].rank];
    return {
      rank: HAND_TYPES.THREE_OF_A_KIND.rank,
      name: HAND_TYPES.THREE_OF_A_KIND.name,
      description: `Three of a Kind, ${RANK_LABELS_PLURAL[tripRank]}`,
      score: [HAND_TYPES.THREE_OF_A_KIND.rank, tripRank, ...kickers],
      cards: sorted
    };
  }

  // 7. Two Pair
  if (freqEntries[0].count === 2 && freqEntries[1].count === 2) {
    const highPair = Math.max(freqEntries[0].rank, freqEntries[1].rank);
    const lowPair = Math.min(freqEntries[0].rank, freqEntries[1].rank);
    const kicker = freqEntries[2].rank;
    return {
      rank: HAND_TYPES.TWO_PAIR.rank,
      name: HAND_TYPES.TWO_PAIR.name,
      description: `Two Pair, ${RANK_LABELS_PLURAL[highPair]} and ${RANK_LABELS_PLURAL[lowPair]}`,
      score: [HAND_TYPES.TWO_PAIR.rank, highPair, lowPair, kicker],
      cards: sorted
    };
  }

  // 8. One Pair
  if (freqEntries[0].count === 2) {
    const pairRank = freqEntries[0].rank;
    const kickers = [freqEntries[1].rank, freqEntries[2].rank, freqEntries[3].rank];
    return {
      rank: HAND_TYPES.ONE_PAIR.rank,
      name: HAND_TYPES.ONE_PAIR.name,
      description: `One Pair of ${RANK_LABELS_PLURAL[pairRank]}`,
      score: [HAND_TYPES.ONE_PAIR.rank, pairRank, ...kickers],
      cards: sorted
    };
  }

  // 9. High Card
  return {
    rank: HAND_TYPES.HIGH_CARD.rank,
    name: HAND_TYPES.HIGH_CARD.name,
    description: `High Card, ${RANK_LABELS[ranks[0]]}`,
    score: [HAND_TYPES.HIGH_CARD.rank, ...ranks],
    cards: sorted
  };
}

/**
 * Compare two evaluated hands.
 * Returns > 0 if A > B, < 0 if A < B, 0 if Tie.
 */
function compareScores(scoreA, scoreB) {
  const len = Math.max(scoreA.length, scoreB.length);
  for (let i = 0; i < len; i++) {
    const valA = scoreA[i] || 0;
    const valB = scoreB[i] || 0;
    if (valA !== valB) {
      return valA - valB;
    }
  }
  return 0;
}

/**
 * Evaluates the best 5-card hand from a player's hole cards (2) + community cards (0 to 5)
 */
function evaluateHand(holeCards, communityCards = []) {
  const allCards = [...holeCards, ...communityCards];

  if (allCards.length < 5) {
    // If fewer than 5 cards (e.g. preflop preview), evaluate what we have
    const sorted = [...allCards].sort((a, b) => b.rank - a.rank);
    if (allCards.length === 2 && allCards[0].rank === allCards[1].rank) {
      return {
        rank: HAND_TYPES.ONE_PAIR.rank,
        name: HAND_TYPES.ONE_PAIR.name,
        description: `Pocket ${RANK_LABELS_PLURAL[allCards[0].rank]}`,
        score: [HAND_TYPES.ONE_PAIR.rank, allCards[0].rank],
        cards: sorted
      };
    }
    return {
      rank: HAND_TYPES.HIGH_CARD.rank,
      name: HAND_TYPES.HIGH_CARD.name,
      description: sorted.length ? `${RANK_LABELS[sorted[0].rank]} High` : 'Unknown',
      score: [HAND_TYPES.HIGH_CARD.rank, ...(sorted.map(c => c.rank))],
      cards: sorted
    };
  }

  const combos = getCombinations(allCards, 5);
  let bestHand = null;

  for (const combo of combos) {
    const evaluated = evaluate5Cards(combo);
    if (!bestHand || compareScores(evaluated.score, bestHand.score) > 0) {
      bestHand = evaluated;
    }
  }

  return bestHand;
}

module.exports = {
  HAND_TYPES,
  RANK_LABELS,
  RANK_LABELS_PLURAL,
  evaluate5Cards,
  evaluateHand,
  compareScores
};
