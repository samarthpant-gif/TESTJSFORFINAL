// ─── TOKENS (shared wallet) ───────────────────────────────────────────────────
function getTokens() {
  return Wallet.getCoins();
}

function updateTokens(v) {
  Wallet.setCoins(v);
  Wallet.updateCoinDisplay("token-display");
}

Wallet.updateCoinDisplay("token-display");

// ─── TABS ─────────────────────────────────────────────────────────────────────
function switchGame(game) {
  document.querySelectorAll(".game-panel").forEach((p) => p.classList.remove("active"));
  document.getElementById("panel-" + game).classList.add("active");

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.getAttribute("onclick").includes(game)) {
      btn.classList.add("active");
    }
  });
}

// ─── BET HELPERS ──────────────────────────────────────────────────────────────
function quickBet(id, m) {
  const el = document.getElementById(id);
  el.value = Math.max(1, Math.floor(parseInt(el.value, 10) * m));
}

function allIn(id) {
  document.getElementById(id).value = getTokens();
}

function validateBet(id) {
  const tokens = getTokens();
  const bet = parseInt(document.getElementById(id).value, 10);
  if (isNaN(bet) || bet < 1) {
    alert("Please enter a valid bet of at least 1 coin.");
    return null;
  }
  if (bet > tokens) {
    alert("You don't have enough coins for that bet! Earn more in Quizzes.");
    return null;
  }
  return bet;
}

// ─── ROULETTE ─────────────────────────────────────────────────────────────────
let rBet = "red";

function selectRBet(el, t) {
  rBet = t;
  document.querySelectorAll(".rbet-btn").forEach((b) => b.classList.remove("active"));
  el.classList.add("active");
}

function getRouletteColor(n) {
  if (n === 0) return "green";
  const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return reds.includes(n) ? "red" : "black";
}

function spinRoulette() {
  const bet = validateBet("r-bet");
  if (bet === null) return;

  const resultEl = document.getElementById("r-result");
  const landedEl = document.getElementById("landed-number");
  const spinBtn = document.getElementById("r-spin-btn");

  spinBtn.disabled = true;
  resultEl.className = "result-box";
  resultEl.textContent = "Spinning...";

  setTimeout(() => {
    const number = Math.floor(Math.random() * 37);
    const color = getRouletteColor(number);
    landedEl.textContent = `${number} (${color.toUpperCase()})`;

    let win = false;
    let multiplier = 1;

    switch (rBet) {
      case "red":
      case "black":
        win = color === rBet;
        multiplier = 2;
        break;
      case "green":
        win = color === "green";
        multiplier = 14;
        break;
      case "odd":
        win = number !== 0 && number % 2 !== 0;
        multiplier = 2;
        break;
      case "even":
        win = number !== 0 && number % 2 === 0;
        multiplier = 2;
        break;
      case "low":
        win = number >= 1 && number <= 18;
        multiplier = 2;
        break;
      case "high":
        win = number >= 19 && number <= 36;
        multiplier = 2;
        break;
    }

    if (win) {
      updateTokens(getTokens() + bet * (multiplier - 1));
      resultEl.textContent = `🎉 WIN! +${bet * (multiplier - 1)} coins`;
      resultEl.className = "result-box win";
    } else {
      updateTokens(getTokens() - bet);
      resultEl.textContent = `💀 LOSE! -${bet} coins`;
      resultEl.className = "result-box lose";
    }

    spinBtn.disabled = false;
  }, 1000);
}

// ─── SLOTS ────────────────────────────────────────────────────────────────────
const SLOT_SYMBOLS = ["🍒", "🍋", "🍇", "⭐", "💎", "🎰", "🔔", "7️⃣"];

function spinSlots() {
  const bet = validateBet("s-bet");
  if (bet === null) return;

  const resultEl = document.getElementById("s-result");
  const spinBtn = document.getElementById("s-spin-btn");
  spinBtn.disabled = true;
  resultEl.className = "result-box";
  resultEl.textContent = "Spinning...";

  let ticks = 0;
  const interval = setInterval(() => {
    for (let i = 0; i < 3; i++) {
      document.getElementById(`reel-${i}`).textContent =
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    }
    ticks++;
    if (ticks > 15) {
      clearInterval(interval);

      const reels = [0, 1, 2].map((i) => {
        const sym = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
        document.getElementById(`reel-${i}`).textContent = sym;
        return sym;
      });

      const allMatch = reels[0] === reels[1] && reels[1] === reels[2];
      const twoMatch = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];

      if (allMatch) {
        const prize = bet * 5;
        updateTokens(getTokens() + prize);
        resultEl.textContent = `🎉 JACKPOT! +${prize} coins`;
        resultEl.className = "result-box win";
      } else if (twoMatch) {
        const prize = bet;
        updateTokens(getTokens() + prize);
        resultEl.textContent = `✨ Two of a kind! +${prize} coins`;
        resultEl.className = "result-box win";
      } else {
        updateTokens(getTokens() - bet);
        resultEl.textContent = `💀 No match. -${bet} coins`;
        resultEl.className = "result-box lose";
      }

      spinBtn.disabled = false;
    }
  }, 80);
}

// ─── BLACKJACK ────────────────────────────────────────────────────────────────
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

let deck = [];
let playerHand = [];
let dealerHand = [];
let bjBetAmount = 0;
let gameOver = false;

function buildDeck() {
  deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function drawCard() {
  return deck.pop();
}

function cardValue(card) {
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  if (card.rank === "A") return 11;
  return parseInt(card.rank, 10);
}

function handTotal(hand) {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function renderCards(hand, elId, hideSecond = false) {
  const el = document.getElementById(elId);
  el.innerHTML = hand
    .map((c, i) => {
      if (hideSecond && i === 1) return `<div class="bj-card back">🂠</div>`;
      const color = ["♥", "♦"].includes(c.suit) ? "red" : "black";
      return `<div class="bj-card" style="color:${color}">${c.rank}${c.suit}</div>`;
    })
    .join("");
}

function setBjButtons(dealing) {
  document.getElementById("bj-deal-btn").disabled = dealing;
  document.getElementById("bj-hit-btn").disabled = !dealing;
  document.getElementById("bj-stand-btn").disabled = !dealing;
  document.getElementById("bj-double-btn").disabled = !dealing;
}

function bjDeal() {
  const bet = validateBet("bj-bet");
  if (bet === null) return;
  bjBetAmount = bet;
  gameOver = false;

  buildDeck();
  playerHand = [drawCard(), drawCard()];
  dealerHand = [drawCard(), drawCard()];

  renderCards(playerHand, "player-cards");
  renderCards(dealerHand, "dealer-cards", true);
  document.getElementById("player-score").textContent = `Score: ${handTotal(playerHand)}`;
  document.getElementById("dealer-score").textContent = "Score: ?";

  const resultEl = document.getElementById("bj-result");
  resultEl.className = "result-box";
  resultEl.textContent = "Your move!";

  setBjButtons(true);

  if (handTotal(playerHand) === 21) {
    bjFinish("blackjack");
  }
}

function bjHit() {
  if (gameOver) return;
  playerHand.push(drawCard());
  renderCards(playerHand, "player-cards");
  const total = handTotal(playerHand);
  document.getElementById("player-score").textContent = `Score: ${total}`;
  if (total > 21) bjFinish("bust");
}

function bjStand() {
  if (gameOver) return;
  while (handTotal(dealerHand) < 17) {
    dealerHand.push(drawCard());
  }
  bjFinish("stand");
}

function bjDouble() {
  if (gameOver) return;
  if (bjBetAmount * 2 > getTokens()) {
    alert("Not enough coins to double down!");
    return;
  }
  bjBetAmount *= 2;
  playerHand.push(drawCard());
  renderCards(playerHand, "player-cards");
  document.getElementById("player-score").textContent = `Score: ${handTotal(playerHand)}`;
  if (handTotal(playerHand) > 21) {
    bjFinish("bust");
  } else {
    bjStand();
  }
}

function bjFinish(reason) {
  gameOver = true;
  setBjButtons(false);

  const playerTotal = handTotal(playerHand);
  const dealerTotal = handTotal(dealerHand);

  renderCards(dealerHand, "dealer-cards");
  document.getElementById("dealer-score").textContent = `Score: ${dealerTotal}`;

  const resultEl = document.getElementById("bj-result");
  let msg = "";

  if (reason === "blackjack") {
    const prize = Math.floor(bjBetAmount * 1.5);
    updateTokens(getTokens() + prize);
    msg = `🃏 BLACKJACK! +${prize} coins`;
    resultEl.className = "result-box win";
  } else if (reason === "bust") {
    updateTokens(getTokens() - bjBetAmount);
    msg = `💀 BUST! -${bjBetAmount} coins`;
    resultEl.className = "result-box lose";
  } else {
    if (dealerTotal > 21 || playerTotal > dealerTotal) {
      updateTokens(getTokens() + bjBetAmount);
      msg = `🎉 YOU WIN! +${bjBetAmount} coins`;
      resultEl.className = "result-box win";
    } else if (playerTotal === dealerTotal) {
      msg = "🤝 PUSH! Bet returned.";
      resultEl.className = "result-box";
    } else {
      updateTokens(getTokens() - bjBetAmount);
      msg = `💀 DEALER WINS! -${bjBetAmount} coins`;
      resultEl.className = "result-box lose";
    }
  }

  resultEl.textContent = msg;
}

window.addEventListener("coins-updated", () => Wallet.updateCoinDisplay("token-display"));
