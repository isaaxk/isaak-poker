const crypto = require('crypto');

const SUITS = [
  { code: 's', symbol: '♠', color: 'black', name: 'Spades' },
  { code: 'h', symbol: '♥', color: 'red', name: 'Hearts' },
  { code: 'd', symbol: '♦', color: 'red', name: 'Diamonds' },
  { code: 'c', symbol: '♣', color: 'black', name: 'Clubs' }
];

const RANKS = [
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: '10' },
  { value: 11, label: 'J' },
  { value: 12, label: 'Q' },
  { value: 13, label: 'K' },
  { value: 14, label: 'A' }
];

class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({
          suit: suit.code,
          symbol: suit.symbol,
          color: suit.color,
          rank: rank.value,
          label: rank.label,
          display: `${rank.label}${suit.symbol}`
        });
      }
    }
    this.shuffle();
  }

  shuffle() {
    // Fisher-Yates shuffle using crypto for unbiased randomness
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (this.cards.length === 0) {
      throw new Error('No cards left in deck');
    }
    return this.cards.pop();
  }

  drawMultiple(count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      drawn.push(this.draw());
    }
    return drawn;
  }

  get remaining() {
    return this.cards.length;
  }
}

module.exports = {
  Deck,
  SUITS,
  RANKS
};
