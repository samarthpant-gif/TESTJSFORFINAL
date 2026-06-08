function getTotalMultiplier() {
  const unlocked = Wallet.getUnlocked();
  return BRAINROT_CATALOG.filter((item) => unlocked.includes(item.id)).reduce(
    (sum, item) => sum + item.multiplier,
    0
  );
}

function buyPack(id) {
  const item = BRAINROT_CATALOG.find((b) => b.id === id);
  const statusEl = document.getElementById("index-status");
  if (!item) return;

  if (Wallet.isUnlocked(id)) {
    statusEl.textContent = "You already own this pack.";
    return;
  }

  if (Wallet.getCoins() < item.price) {
    statusEl.textContent = `Need ${item.price} coins — earn more in Quizzes or Casino!`;
    return;
  }

  if (!Wallet.spendCoins(item.price)) {
    statusEl.textContent = "Not enough coins.";
    return;
  }

  Wallet.unlock(id);
  statusEl.textContent = `Unlocked ${item.name}!`;
  renderIndex();
}

function renderIndex() {
  const grid = document.getElementById("item-grid");
  const progressLabel = document.getElementById("progress-label");
  const progressFill = document.getElementById("progress-fill");
  const multiplierEl = document.getElementById("total-multiplier");
  if (!grid) return;

  const unlocked = Wallet.getUnlocked();
  const total = BRAINROT_CATALOG.length;
  const owned = unlocked.length;
  const pct = total ? Math.round((owned / total) * 100) : 0;

  if (progressLabel) progressLabel.textContent = `Completion: ${pct}% (${owned}/${total})`;
  if (progressFill) progressFill.style.width = `${pct}%`;
  if (multiplierEl) {
    const mult = getTotalMultiplier();
    multiplierEl.textContent = mult > 0 ? `Total multiplier: +${mult.toFixed(1)}x` : "Total multiplier: none yet";
  }

  grid.innerHTML = BRAINROT_CATALOG.map((item) => {
    const ownedItem = unlocked.includes(item.id);
    const lockedClass = ownedItem ? "unlocked" : "locked";

    const iconHtml = ownedItem
      ? `<img src="${item.image}" alt="${item.name}" class="item-img" onerror="this.style.display='none'">`
      : "🔒";

    const name = ownedItem || item.starter ? (item.displayName || item.name) : "???";
    const bonus = ownedItem
      ? `Multiplier: +${item.multiplier}x`
      : item.starter
        ? `🪙 ${item.price} coins — your first unlock!`
        : `🪙 ${item.price} coins`;

    const buyBtn = ownedItem
      ? `<span class="owned-badge">Owned</span>`
      : `<button type="button" class="buy-btn${item.starter ? " starter-btn" : ""}" onclick="buyPack('${item.id}')">${item.starter ? "Unlock Starter" : "Buy Pack"}</button>`;

    const rarityLabel = item.starter ? "STARTER" : item.rarity.toUpperCase();

    return `
      <div class="item-card ${lockedClass}${item.starter ? " starter-card" : ""}">
        <div class="item-rarity ${item.rarity}${item.starter ? " starter" : ""}">${rarityLabel}</div>
        <div class="item-icon">${iconHtml}</div>
        <h3 class="item-name">${name}</h3>
        <p class="item-bonus">${bonus}</p>
        ${buyBtn}
      </div>
    `;
  }).join("");
}

Wallet.updateCoinDisplay();
renderIndex();

window.addEventListener("coins-updated", renderIndex);
window.addEventListener("inventory-updated", renderIndex);
