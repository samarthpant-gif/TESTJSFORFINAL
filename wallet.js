// Shared Brainrot Coins — quiz earnings, casino bets, and index purchases all use this.
(function (global) {
  const COINS_KEY = "brainrotCoins";
  const INVENTORY_KEY = "brainrotCoins_inventory";

  const POINTS_PER_CORRECT = 4;

  function getCoins() {
    const stored = localStorage.getItem(COINS_KEY);
    if (stored === null) return 0;
    const n = parseInt(stored, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function setCoins(amount) {
    const value = Math.max(0, Math.floor(amount));
    localStorage.setItem(COINS_KEY, String(value));
    global.dispatchEvent(new CustomEvent("coins-updated", { detail: { coins: value } }));
    return value;
  }

  function addCoins(amount) {
    return setCoins(getCoins() + amount);
  }

  function spendCoins(amount) {
    const cost = Math.floor(amount);
    if (cost < 1 || getCoins() < cost) return false;
    setCoins(getCoins() - cost);
    return true;
  }

  function updateCoinDisplay(elementId) {
    const el = document.getElementById(elementId || "token-display");
    if (el) el.textContent = getCoins();
  }

  function getUnlocked() {
    try {
      return JSON.parse(localStorage.getItem(INVENTORY_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function isUnlocked(id) {
    return getUnlocked().includes(id);
  }

  function unlock(id) {
    const owned = getUnlocked();
    if (!owned.includes(id)) {
      owned.push(id);
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(owned));
      global.dispatchEvent(new CustomEvent("inventory-updated", { detail: { id } }));
    }
  }

  // Migrate legacy key from early casino builds
  (function migrateLegacy() {
    const legacy = localStorage.getItem("brainrots");
    if (!legacy) return;
    try {
      const ids = JSON.parse(legacy);
      if (Array.isArray(ids)) {
        ids.forEach(unlock);
        localStorage.removeItem("brainrots");
      }
    } catch {
      /* ignore */
    }
  })();

  global.addEventListener("coins-updated", () => updateCoinDisplay());

  global.Wallet = {
    COINS_KEY,
    INVENTORY_KEY,
    POINTS_PER_CORRECT,
    getCoins,
    setCoins,
    addCoins,
    spendCoins,
    updateCoinDisplay,
    getUnlocked,
    isUnlocked,
    unlock,
  };
})(window);
