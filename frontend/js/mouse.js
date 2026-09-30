// Mouse Meadow: four tiny games that teach pointing, clicking, dragging,
// double-clicking and scrolling. No timers, no lives: mistakes only get a
// friendly hint, and every game ends with a celebration.

const MOUSE_LEVELS = [
  { icon: "🎈", text: "mouse.pop", run: levelPop },
  { icon: "🧺", text: "mouse.drag", run: levelDrag },
  { icon: "🥚", text: "mouse.dbl", run: levelDoubleClick },
  { icon: "📜", text: "mouse.scroll", run: levelScroll },
];

const rand = (min, max) => min + Math.random() * (max - min);

// Themes: coming back to a game brings a different look (freshPick in app.js). The game itself stays the same.
const POP_THEMES = [
  { id: "balloons", emoji: "🎈", text: "mouse.pop", tint: true }, { id: "bubbles", emoji: "🫧", text: "mouse.pop.bubbles" },
  { id: "ladybirds", emoji: "🐞", text: "mouse.pop.ladybirds" }, { id: "stars", emoji: "⭐", text: "mouse.pop.stars" },
  { id: "fish", emoji: "🐠", text: "mouse.pop.fish", tint: true },
];
const DRAG_THEMES = [
  { id: "shapes", text: "mouse.drag" }, { id: "fruit", text: "mouse.drag.fruit", items: ["🍎", "🍌", "🍇"] },
  { id: "animals", text: "mouse.drag.animals", items: ["🐶", "🐱", "🐰"] }, { id: "toys", text: "mouse.drag.toys", items: ["🧸", "⚽", "🪁"] },
];
const HATCH_THEMES = [
  { id: "eggs", emoji: "🥚", text: "mouse.dbl", inside: ["🐥", "🦖", "🐢", "🐍", "🦆", "🐧", "🐊", "🦜"] },
  { id: "gifts", emoji: "🎁", text: "mouse.dbl.gift", inside: ["🧸", "🚂", "🪀", "⚽", "🪁", "🎨", "🦄"] },
  { id: "shells", emoji: "🐚", text: "mouse.dbl.shell", inside: ["🦀", "🐙", "🐠", "🦐", "🐡", "🪼"] },
];
const SCROLL_THEMES = [
  { id: "meadow", text: "mouse.scroll", goal: "🎁", deco: ["🌳", "🌼", "☁️", "🦋", "🌷", "🐝", "🌲", "🍄"] },
  { id: "sea", text: "mouse.scroll.sea", goal: "💎", deco: ["🐠", "🐟", "🫧", "🪸", "🐡", "🦀", "🐚", "🐙"] },
  { id: "space", text: "mouse.scroll.space", goal: "🚀", deco: ["⭐", "🪐", "☄️", "🌙", "🛸", "✨", "🌟", "🛰️"] },
  { id: "forest", text: "mouse.scroll.forest", goal: "🦊", deco: ["🌲", "🍄", "🦔", "🍂", "🐿️", "🌰", "🪵", "🦉"] },
];

// The instruction at the top of a game: an icon, a short line, and a 🔊 to hear it again.
function instruction(icon, text) {
  const bubble = el("button", { class: "bubble instruction", onclick: () => speak(text) }, `${icon} ${text} 🔊`);
  queueMicrotask(() => speak(text));   // after the screen is set: setScreen() silences the previous screen
  return bubble;
}

// A double-click that forgives a slow child. The computer's own double-click needs two clicks within about half
// a second and without moving, which a 6-year-old often misses. Here two clicks within 0.9 seconds count, and the
// computer's own double-click counts too. `onFirst` runs after a single click (to show that it was seen).
function onDoubleClick(node, onDouble, onFirst = () => {}, ms = 900) {
  let last = -Infinity;
  node.addEventListener("click", () => {
    const now = performance.now();
    if (now - last < ms) { last = -Infinity; onDouble(); } else { last = now; onFirst(); }
  });
  node.addEventListener("dblclick", () => { last = -Infinity; onDouble(); });
}

// A row of dots showing how far along the game is.
function progressDots(done, total) {
  return el("div", { class: "dots" }, "●".repeat(Math.min(done, total)) + "○".repeat(Math.max(0, total - done)));
}

// ---------- Level picker ----------
async function mouseMeadow() {
  await loadProgress();
  const stars = progress.worlds.mouse.levels;
  const cards = MOUSE_LEVELS.map((level, i) => {
    const n = i + 1;
    const earned = stars[n] || 0;
    return el("button", { class: "world level", onclick: () => { sfx("tap"); reopenPicker = mouseMeadow; startMouseLevel(n); } },
      el("span", { class: "icon" }, level.icon),
      el("span", { class: "stars" }, earned ? "⭐".repeat(earned) : "☆☆☆"));
  });
  setScreen("mouse", el("h1", { class: "title" }, "🐭 " + t("world.mouse")), el("div", { class: "worlds" }, ...cards));
  speak(t("world.mouse"));
}

function startMouseLevel(n) {
  const level = MOUSE_LEVELS[n - 1];
  level.run(() => completeLevel("mouse", n, mouseMeadow));
}

// ---------- Level 1: move and click ----------
// One big balloon at a time: easiest possible target.
async function levelPop(done) {
  const theme = (await freshPick("mouse:1", POP_THEMES))[0];
  const total = 5;
  // Design section 5, stage 1: "large targets that shrink gradually." Still well above the 64px
  // minimum touch target used everywhere else in the app, so the last balloon stays reachable.
  const SIZES = [150, 132, 114, 96, 80];
  let popped = 0;
  const arena = el("div", { class: "arena" });
  const dots = progressDots(0, total);
  setScreen("mouse-1", instruction(theme.emoji, t(theme.text)), dots, arena);

  function spawn() {
    const size = SIZES[Math.min(popped, SIZES.length - 1)];
    const balloon = el("button", { class: "target balloon", "aria-label": theme.id }, theme.emoji);
    balloon.style.width = `${size}px`;
    balloon.style.height = `${size}px`;
    balloon.style.fontSize = `${(size * 7) / 150}rem`;
    // Anywhere in the play area, but always fully inside it (reserve the largest possible size).
    balloon.style.left = `calc((100% - 150px) * ${rand(0.03, 0.97)})`;
    balloon.style.top = `calc((100% - 150px) * ${rand(0.03, 0.97)})`;
    if (theme.tint) balloon.style.filter = `hue-rotate(${Math.floor(rand(0, 360))}deg)`;
    balloon.addEventListener("click", () => {
      sfx("tap");
      balloon.classList.add("pop");
      popped++;
      dots.textContent = progressDots(popped, total).textContent;
      later(() => (popped === total ? done() : spawn()), 350);
      balloon.disabled = true;
    });
    arena.replaceChildren(balloon);
  }
  spawn();
}

// ---------- Level 2: drag and drop ----------
async function levelDrag(done) {
  const theme = (await freshPick("mouse:2", DRAG_THEMES))[0];
  const colours = ["#ff6b6b", "#4dabf7", "#fcc419"];
  // Coloured shapes, or pictures (fruit into bowls, animals into beds...): `name` pairs each item with its basket.
  const shapes = theme.items ? theme.items.map((emoji, i) => ({ name: `i${i}`, color: colours[i], emoji }))
    : [{ name: "circle", color: colours[0] }, { name: "square", color: colours[1] }, { name: "triangle", color: colours[2] }];
  const shuffled = [...shapes].sort(() => Math.random() - 0.5);
  const tray = el("div", { class: "tray" });
  const baskets = el("div", { class: "tray baskets" });
  let placed = 0;
  const dots = progressDots(0, shapes.length);
  const bubble = instruction(theme.items ? theme.items[0] : "🧺", t(theme.text));

  const shapeEl = (s, cls) => {
    const node = s.emoji ? el("div", { class: `shape emoji ${cls}` }, s.emoji) : el("div", { class: `shape ${s.name} ${cls}` });
    node.style.setProperty("--c", s.color);
    node.dataset.shape = s.name;
    return node;
  };

  for (const s of shapes) {
    const basket = el("div", { class: "basket", "data-shape": s.name }, shapeEl(s, "ghost"));
    basket.style.borderColor = s.color;
    baskets.append(basket);
  }

  for (const s of shuffled) {
    const item = shapeEl(s, "draggable");
    let startX = 0, startY = 0;
    item.addEventListener("pointerdown", (e) => {
      item.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      item.classList.add("dragging");
      item.style.transition = "none";
      sfx("key");
    });
    item.addEventListener("pointermove", (e) => {
      if (!item.classList.contains("dragging")) return;
      item.style.transform = `translate(${e.clientX - startX}px, ${e.clientY - startY}px)`;
    });
    item.addEventListener("pointerup", (e) => {
      if (!item.classList.contains("dragging")) return;
      item.classList.remove("dragging");
      const basket = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.classList?.contains("basket"));
      if (basket && basket.dataset.shape === s.name) {
        // Right basket: it drops in and stays there.
        item.style.transform = "";
        item.classList.remove("draggable");
        item.style.pointerEvents = "none";
        basket.replaceChildren(item);
        sfx("success");
        placed++;
        dots.textContent = progressDots(placed, shapes.length).textContent;
        if (placed === shapes.length) later(done, 700);
        return;
      }
      // Wrong basket, or dropped elsewhere: glide home and point at the right basket. No buzzer.
      item.style.transition = "transform .35s ease";
      item.style.transform = "";
      const right = baskets.querySelector(`[data-shape="${s.name}"]`);
      right.classList.add("hint");
      setTimeout(() => right.classList.remove("hint"), 1800);
      if (basket) speak(t("mouse.tryBasket"));
    });
    tray.append(item);
  }
  setScreen("mouse-2", bubble, dots, tray, baskets);
}

// ---------- Level 3: double-click ----------
async function levelDoubleClick(done) {
  const theme = (await freshPick("mouse:3", HATCH_THEMES))[0];
  const hatchlings = shuffled(theme.inside).slice(0, 3);
  let hatched = 0;
  const arena = el("div", { class: "arena center" });
  const dots = progressDots(0, hatchlings.length);
  setScreen("mouse-3", instruction(theme.emoji, t(theme.text)), dots, arena);

  function nextEgg() {
    const egg = el("button", { class: "target egg", "aria-label": theme.id }, theme.emoji);
    const hint = el("div", { class: "double-hint" }, "👆👆");
    // A single click only wiggles the egg and shows the hint again. Nothing bad happens.
    const hatch = () => {
      if (egg.disabled) return;
      egg.disabled = true;
      egg.textContent = hatchlings[hatched];
      egg.classList.add("hatched");
      hint.remove();
      sfx("boing");
      hatched++;
      dots.textContent = progressDots(hatched, hatchlings.length).textContent;
      later(() => (hatched === hatchlings.length ? done() : nextEgg()), 1100);
    };
    onDoubleClick(egg, hatch, () => {
      egg.classList.remove("wobble"); void egg.offsetWidth; egg.classList.add("wobble");
      sfx("key");
    });
    arena.replaceChildren(egg, hint);
  }
  nextEgg();
}

// ---------- Level 4: scroll ----------
async function levelScroll(done) {
  const theme = (await freshPick("mouse:4", SCROLL_THEMES))[0];
  const scroller = el("div", { class: "scroller" });
  const tall = el("div", { class: `tall ${theme.id}` });
  const decorations = theme.deco;
  for (let i = 0; i < 26; i++) {
    const d = el("span", { class: "deco" }, decorations[i % decorations.length]);
    d.style.left = rand(3, 90) + "%";
    d.style.top = rand(12, 88) + "%";
    tall.append(d);
  }
  tall.append(el("div", { class: "scroll-hint" }, "⬇️"));
  const chest = el("button", { class: "target chest", "aria-label": "treasure" }, theme.goal);
  chest.addEventListener("click", () => { chest.disabled = true; sfx("boing"); later(done, 700); });
  tall.append(chest);
  scroller.append(tall);
  setScreen("mouse-4", instruction("📜", t(theme.text)), scroller);
}
