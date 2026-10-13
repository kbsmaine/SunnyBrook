const CROPS = {
  wheat: { name: "Wheat", icon: "🌾", seed: 4, sell: 10, days: 2, xp: 4, level: 1 },
  carrot: { name: "Carrot", icon: "🥕", seed: 8, sell: 20, days: 3, xp: 6, level: 2 },
  strawberry: { name: "Berry", icon: "🍓", seed: 15, sell: 38, days: 4, xp: 9, level: 3 },
  corn: { name: "Corn", icon: "🌽", seed: 24, sell: 62, days: 5, xp: 13, level: 4 },
  pumpkin: { name: "Pumpkin", icon: "🎃", seed: 38, sell: 100, days: 6, xp: 20, level: 6 }
};

const ANIMALS = {
  chicken: { name: "Chicken", icon: "🐔", product: "Egg", productIcon: "🥚", cost: 120, value: 20, level: 2 },
  cow: { name: "Cow", icon: "🐄", product: "Milk", productIcon: "🥛", cost: 450, value: 55, level: 5 }
};

const ORDERS = [
  { id: "starter", title: "Baker's Basket", icon: "🥖", needs: { wheat: 4 }, reward: 60, xp: 15 },
  { id: "salad", title: "Picnic Salad", icon: "🥗", needs: { carrot: 3, strawberry: 2 }, reward: 150, xp: 28 },
  { id: "festival", title: "Harvest Festival", icon: "🎪", needs: { wheat: 5, corn: 3, pumpkin: 1 }, reward: 390, xp: 55 }
];

const ACHIEVEMENTS = [
  { id: "green_thumb", title: "Green Thumb", text: "Plant 10 crops", key: "planted", goal: 10, reward: 50 },
  { id: "harvester", title: "Field Hand", text: "Harvest 15 crops", key: "harvested", goal: 15, reward: 80 },
  { id: "merchant", title: "Market Maven", text: "Earn 500 coins", key: "earned", goal: 500, reward: 120 },
  { id: "rancher", title: "Happy Rancher", text: "Collect 8 animal goods", key: "collected", goal: 8, reward: 150 }
];

const WEATHER = [
  { name: "Sunny", icon: "☀️", note: "A bright day at Sunnybrook." },
  { name: "Cloudy", icon: "☁️", note: "Cool clouds roll over the fields." },
  { name: "Rainy", icon: "🌧️", note: "The rain watered every planted crop!" }
];

const emptyTile = (locked = false) => ({ locked, crop: null, stage: 0, watered: false, ready: false });

const freshState = () => ({
  version: 2,
  coins: 180,
  level: 1,
  xp: 0,
  energy: 30,
  maxEnergy: 30,
  day: 1,
  weather: 0,
  tool: "plant",
  crop: "wheat",
  tiles: Array.from({ length: 48 }, (_, i) => emptyTile(i >= 24)),
  barn: Object.fromEntries(Object.keys(CROPS).map((key) => [key, 0])),
  barnCapacity: 30,
  animals: { chicken: 0, cow: 0 },
  animalReady: { chicken: 0, cow: 0 },
  stats: { planted: 0, harvested: 0, earned: 0, collected: 0 },
  achievements: [],
  orders: [],
  sound: true,
  tutorial: true
});

let state = load();
let toastTimer;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem("sunnybrook-farm-save"));
    if (!saved || saved.version !== 2) return freshState();
    const base = freshState();
    return {
      ...base, ...saved,
      barn: { ...base.barn, ...saved.barn },
      animals: { ...base.animals, ...saved.animals },
      animalReady: { ...base.animalReady, ...saved.animalReady },
      stats: { ...base.stats, ...saved.stats },
      tiles: base.tiles.map((tile, i) => ({ ...tile, ...(saved.tiles?.[i] || {}) }))
    };
  } catch {
    return freshState();
  }
}

function save() {
  localStorage.setItem("sunnybrook-farm-save", JSON.stringify(state));
}

function xpTarget() { return 35 + (state.level - 1) * 30; }
function barnCount() { return Object.values(state.barn).reduce((a, b) => a + b, 0); }
function plotCost(index) { return 35 + Math.floor(index / 8) * 15; }

function addXp(amount) {
  state.xp += amount;
  while (state.xp >= xpTarget()) {
    state.xp -= xpTarget();
    state.level += 1;
    state.maxEnergy += 3;
    state.energy = state.maxEnergy;
    notify(`Level ${state.level}! Your energy is full.`, "level");
  }
}

function spendEnergy(amount = 1) {
  if (state.energy < amount) {
    notify("Out of energy — begin the next day to refill it.", "warn");
    return false;
  }
  state.energy -= amount;
  return true;
}

function spendCoins(amount) {
  if (state.coins < amount) {
    notify("You need more coins for that.", "warn");
    return false;
  }
  state.coins -= amount;
  return true;
}

function track(key, amount = 1) {
  state.stats[key] += amount;
  for (const item of ACHIEVEMENTS) {
    if (item.key !== key || state.achievements.includes(item.id) || state.stats[key] < item.goal) continue;
    state.achievements.push(item.id);
    state.coins += item.reward;
    addXp(20);
    notify(`${item.title} complete! +${item.reward} coins`, "level");
  }
}

function actOnTile(index) {
  const tile = state.tiles[index];
  if (tile.locked) {
    const cost = plotCost(index);
    if (spendCoins(cost)) {
      tile.locked = false;
      addXp(3);
      notify("A new plot is ready for planting!");
      commit();
    }
    return;
  }

  if (state.tool === "plant") {
    const crop = CROPS[state.crop];
    if (tile.crop) return notify(tile.ready ? "This crop is ready to harvest." : "That plot is already planted.");
    if (state.level < crop.level) return notify(`Reach level ${crop.level} to plant ${crop.name}.`, "warn");
    if (state.energy < 1) return notify("Out of energy — begin the next day to refill it.", "warn");
    if (!spendCoins(crop.seed) || !spendEnergy()) return;
    Object.assign(tile, { crop: state.crop, stage: 0, watered: false, ready: false });
    track("planted");
  } else if (state.tool === "water") {
    if (!tile.crop || tile.ready) return notify("Plant a growing crop here first.");
    if (tile.watered) return notify("This plot is already watered.");
    if (!spendEnergy()) return;
    tile.watered = true;
  } else if (state.tool === "harvest") {
    if (!tile.ready) return notify("That crop is not ready yet.");
    if (barnCount() >= state.barnCapacity) return notify("The barn is full — sell or deliver some produce.", "warn");
    const crop = CROPS[tile.crop];
    state.barn[tile.crop] += 1;
    addXp(crop.xp);
    track("harvested");
    Object.assign(tile, emptyTile());
  } else if (state.tool === "clear") {
    if (!tile.crop) return;
    if (!spendEnergy()) return;
    Object.assign(tile, emptyTile());
  }
  commit();
}

function nextDay() {
  state.day += 1;
  state.energy = state.maxEnergy;
  state.weather = Math.floor(Math.random() * WEATHER.length);
  const rainy = WEATHER[state.weather].name === "Rainy";
  let grown = 0;
  state.tiles.forEach((tile) => {
    if (!tile.crop || tile.ready) return;
    if (rainy) tile.watered = true;
    if (!tile.watered) return;
    tile.stage += 1;
    tile.watered = false;
    grown += 1;
    if (tile.stage >= CROPS[tile.crop].days) tile.ready = true;
  });
  Object.keys(ANIMALS).forEach((key) => { state.animalReady[key] += state.animals[key]; });
  notify(`${WEATHER[state.weather].note} ${grown} crop${grown === 1 ? "" : "s"} grew.`, "day");
  commit();
}

function sell(key) {
  if (!state.barn[key]) return;
  const income = CROPS[key].sell;
  state.barn[key] -= 1;
  state.coins += income;
  track("earned", income);
  notify(`Sold ${CROPS[key].name} for ${income} coins.`);
  commit();
}

function buyAnimal(key) {
  const animal = ANIMALS[key];
  if (state.level < animal.level) return notify(`Reach level ${animal.level} first.`, "warn");
  if (!spendCoins(animal.cost)) return;
  state.animals[key] += 1;
  addXp(15);
  notify(`${animal.name} joined Sunnybrook!`, "level");
  commit();
}

function collectAnimal(key) {
  const amount = state.animalReady[key];
  if (!amount) return notify("More goods will be ready tomorrow.");
  const income = amount * ANIMALS[key].value;
  state.animalReady[key] = 0;
  state.coins += income;
  addXp(amount * 4);
  track("collected", amount);
  track("earned", income);
  notify(`Collected ${amount} ${ANIMALS[key].product}${amount === 1 ? "" : "s"}! +${income}`);
  commit();
}

function canFill(order) {
  return Object.entries(order.needs).every(([key, amount]) => state.barn[key] >= amount);
}

function fillOrder(id) {
  const order = ORDERS.find((item) => item.id === id);
  if (!order || state.orders.includes(id) || !canFill(order)) return;
  Object.entries(order.needs).forEach(([key, amount]) => { state.barn[key] -= amount; });
  state.orders.push(id);
  state.coins += order.reward;
  addXp(order.xp);
  track("earned", order.reward);
  notify(`Order delivered! +${order.reward} coins`, "level");
  commit();
}

function upgradeBarn() {
  const cost = state.barnCapacity * 8;
  if (!spendCoins(cost)) return;
  state.barnCapacity += 15;
  addXp(10);
  notify(`Barn expanded to ${state.barnCapacity} spaces!`, "level");
  commit();
}

function commit() { save(); render(); }

function cropVisual(tile) {
  if (!tile.crop) return "";
  if (tile.ready) return `<span class="crop ready">${CROPS[tile.crop].icon}</span>`;
  const scale = Math.min(.96, .48 + ((tile.stage + 1) / CROPS[tile.crop].days) * .42);
  return `<span class="crop sprout" style="--grow:${scale}">${tile.stage ? "🌿" : "🌱"}</span>`;
}

function renderTile(tile, index) {
  if (tile.locked) return `<button class="plot locked" data-tile="${index}" aria-label="Unlock plot for ${plotCost(index)} coins"><span>🌳</span><small>🔒 ${plotCost(index)}</small></button>`;
  const label = tile.crop ? `${CROPS[tile.crop].name}, ${tile.ready ? "ready" : `growth ${tile.stage} of ${CROPS[tile.crop].days}`}` : "Empty plot";
  return `<button class="plot ${tile.watered ? "watered" : ""} ${tile.ready ? "harvestable" : ""}" data-tile="${index}" aria-label="${label}">
    ${cropVisual(tile)}${tile.watered ? '<span class="drop">💧</span>' : ""}${tile.ready ? '<span class="star">★</span>' : ""}
  </button>`;
}

function renderCrop(key, crop) {
  const locked = state.level < crop.level;
  return `<button class="shop-card ${state.crop === key ? "selected" : ""}" data-crop="${key}" ${locked ? "disabled" : ""}>
    <span class="shop-icon">${crop.icon}</span><span><b>${crop.name}</b><small>${locked ? `Unlocks level ${crop.level}` : `${crop.seed} coins · ${crop.days} days`}</small></span>
  </button>`;
}

function renderOrder(order) {
  const done = state.orders.includes(order.id);
  const needs = Object.entries(order.needs).map(([key, amount]) => `${CROPS[key].icon} ${Math.min(state.barn[key], amount)}/${amount}`).join(" · ");
  return `<article class="order ${done ? "complete" : ""}"><span>${order.icon}</span><div><b>${order.title}</b><small>${done ? "Delivered" : needs}</small></div><button data-order="${order.id}" ${done || !canFill(order) ? "disabled" : ""}>${done ? "✓" : `${order.reward} 🪙`}</button></article>`;
}

function renderAchievement(item) {
  const done = state.achievements.includes(item.id);
  const progress = Math.min(state.stats[item.key], item.goal);
  return `<article class="achievement ${done ? "complete" : ""}"><span>${done ? "✓" : "!"}</span><div><b>${item.title}</b><small>${done ? "Complete" : item.text}</small><i><em style="width:${progress / item.goal * 100}%"></em></i></div><strong>${done ? "✓" : `${progress}/${item.goal}`}</strong></article>`;
}

function render() {
  const weather = WEATHER[state.weather];
  document.querySelector("#app").innerHTML = `
    <div class="game-shell">
      <header class="topbar">
        <div class="brand"><span>☀</span><div><h1>Sunnybrook</h1><small>FARM</small></div></div>
        <div class="resource"><span>🪙</span><b>${state.coins.toLocaleString()}</b></div>
        <div class="resource energy"><span>⚡</span><div><b>${state.energy}/${state.maxEnergy}</b><i><em style="width:${state.energy/state.maxEnergy*100}%"></em></i></div></div>
        <div class="profile"><span>🧑‍🌾</span><div><b>Farmer</b><small>Level ${state.level}</small><i><em style="width:${state.xp/xpTarget()*100}%"></em></i></div></div>
        <button id="settings" class="icon-button" aria-label="Open settings">⚙️</button>
      </header>
      <main>
        <aside class="shop panel">
          <section><div class="section-title"><h2>Seed Shop</h2><span>🌱</span></div><p class="hint">Pick a seed, then choose a field plot.</p><div class="crop-list">${Object.entries(CROPS).map(([k,v]) => renderCrop(k,v)).join("")}</div></section>
          <section><div class="section-title"><h2>Animal Pen</h2><span>🐾</span></div>${Object.entries(ANIMALS).map(([key,a]) => `<div class="animal"><span>${a.icon}</span><div><b>${a.name}</b><small>Owned: ${state.animals[key]}</small></div><button data-buy="${key}" ${state.level < a.level ? "disabled" : ""}>${state.level < a.level ? `Lvl ${a.level}` : `${a.cost} 🪙`}</button></div>${state.animals[key] ? `<button class="collect" data-collect="${key}">${a.productIcon} Collect ${state.animalReady[key] || ""}</button>` : ""}`).join("")}</section>
        </aside>
        <section class="farm-view">
          <div class="cloud c1">☁</div><div class="cloud c2">☁</div>
          <div class="day-card"><span>${weather.icon}</span><div><b>Day ${state.day}</b><small>${weather.name}</small></div><button id="next-day">Next day ›</button></div>
          <div class="farm-scene">
            <div class="barn"><div class="roof"></div><b>★</b><i></i></div><div class="silo"></div><div class="windmill"><i></i><b></b></div>
            <div class="pond"><span>🦆</span></div><div class="animals-on-farm">${"🐔".repeat(Math.min(3,state.animals.chicken))}<br>${"🐄".repeat(Math.min(2,state.animals.cow))}</div>
            <div class="farm-grid">${state.tiles.map(renderTile).join("")}</div>
          </div>
          <nav class="tool-dock" aria-label="Farm tools">${[["plant","🌱","Plant"],["water","💧","Water"],["harvest","🧺","Harvest"],["clear","🧹","Clear"]].map(([tool,icon,label]) => `<button data-tool="${tool}" class="${state.tool === tool ? "active" : ""}"><span>${icon}</span><small>${label}</small></button>`).join("")}</nav>
        </section>
        <aside class="dashboard">
          <section class="panel"><div class="section-title"><h2>Farm Orders</h2><span>📦</span></div><div class="order-list">${ORDERS.map(renderOrder).join("")}</div></section>
          <section class="panel"><div class="section-title"><h2>Market Barn</h2><span>🏚️</span></div><div class="capacity"><span>Storage</span><b>${barnCount()} / ${state.barnCapacity}</b></div><div class="bar"><i style="width:${barnCount()/state.barnCapacity*100}%"></i></div><div class="inventory">${Object.entries(CROPS).map(([key,c]) => `<div><span>${c.icon}</span><b>${state.barn[key]}</b><button data-sell="${key}" ${!state.barn[key] ? "disabled" : ""}>Sell ${c.sell}</button></div>`).join("")}</div><button id="upgrade" class="upgrade">Expand barn · ${state.barnCapacity*8} 🪙</button></section>
          <section class="panel achievements"><div class="section-title"><h2>Achievements</h2><span>🏆</span></div>${ACHIEVEMENTS.map(renderAchievement).join("")}</section>
        </aside>
      </main>
      <footer><span>● Autosaved in this browser</span><span>Water crops, then advance the day to grow them.</span></footer>
    </div>
    <div id="toast" role="status" aria-live="polite"></div>
    ${state.tutorial ? `<div class="modal"><section class="welcome"><span class="mascot">🧑‍🌾</span><small>WELCOME, FARMER!</small><h2>Your patch of sunshine is ready.</h2><p>Plant seeds, water the fields, and advance the day. Harvest crops, fill orders, raise animals, and grow Sunnybrook into a thriving homestead.</p><div class="steps"><span><b>1</b>Pick a seed</span><span><b>2</b>Plant & water</span><span><b>3</b>Harvest & sell</span></div><button id="start">Let's grow!</button></section></div>` : ""}
    <dialog id="settings-dialog"><button class="dialog-close" aria-label="Close">×</button><h2>Farm Settings</h2><p>Your progress is stored only in this browser.</p><label><input id="sound" type="checkbox" ${state.sound ? "checked" : ""}> Sound effects</label><button id="reset" class="danger">Start a new farm</button></dialog>`;
  bind();
}

function bind() {
  document.querySelectorAll("[data-tile]").forEach((el) => el.addEventListener("click", () => actOnTile(Number(el.dataset.tile))));
  document.querySelectorAll("[data-tool]").forEach((el) => el.addEventListener("click", () => { state.tool = el.dataset.tool; commit(); }));
  document.querySelectorAll("[data-crop]").forEach((el) => el.addEventListener("click", () => { state.crop = el.dataset.crop; state.tool = "plant"; commit(); }));
  document.querySelectorAll("[data-sell]").forEach((el) => el.addEventListener("click", () => sell(el.dataset.sell)));
  document.querySelectorAll("[data-buy]").forEach((el) => el.addEventListener("click", () => buyAnimal(el.dataset.buy)));
  document.querySelectorAll("[data-collect]").forEach((el) => el.addEventListener("click", () => collectAnimal(el.dataset.collect)));
  document.querySelectorAll("[data-order]").forEach((el) => el.addEventListener("click", () => fillOrder(el.dataset.order)));
  document.querySelector("#next-day").addEventListener("click", nextDay);
  document.querySelector("#upgrade").addEventListener("click", upgradeBarn);
  document.querySelector("#start")?.addEventListener("click", () => { state.tutorial = false; commit(); });
  const dialog = document.querySelector("#settings-dialog");
  document.querySelector("#settings").addEventListener("click", () => dialog.showModal());
  document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  document.querySelector("#sound").addEventListener("change", (event) => { state.sound = event.target.checked; save(); });
  document.querySelector("#reset").addEventListener("click", () => { if (confirm("Start over and erase this farm?")) { state = freshState(); save(); render(); } });
}

function notify(message, type = "") {
  requestAnimationFrame(() => {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = ""; }, 2600);
    if (state.sound) chirp(type);
  });
}

function chirp(type) {
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.frequency.value = type === "warn" ? 180 : type === "level" ? 680 : 430;
    gain.gain.setValueAtTime(.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .1);
    oscillator.start(); oscillator.stop(audio.currentTime + .1);
  } catch { /* Sound is optional. */ }
}

render();
