// Keyboard Kingdom: discover the keyboard. Five tiny games:
// find a glowing key, then Space, Enter, Backspace and Shift each get a game.
// Nothing here is timed, and a wrong key only gets a friendly hint.

const KINGDOM_ICONS = ["🔎", "🚀", "✈️", "🎈", "🌞"];

function kingdom() {
  levelPicker("keyboard", "⌨️", KINGDOM_ICONS, (n) => {
    [levelFindKeys, levelSpace, levelEnter, levelBackspace, levelShift, levelArrows, levelCapsLock][n - 1](
      () => completeLevel("keyboard", n, kingdom));
  });
}

// Themes: coming back to a game brings other letters, or another picture that jumps, drives, pops or grows
// (freshPick in app.js). Only letters that are on every keyboard shape (QWERTY, QWERTZ, Spanish) are used.
const FIND_SETS = [{ id: "home", keys: ["A", "S", "D", "F", "J", "K", "L"] }, { id: "top", keys: ["E", "R", "T", "U", "I", "O", "P"] },
  { id: "bottom", keys: ["C", "V", "B", "N", "M", "X"] }, { id: "mixed", keys: ["A", "E", "I", "O", "U", "M", "S"] }];
const JUMP_THEMES = [{ id: "rocket", emoji: "🚀", text: "kb.space" }, { id: "frog", emoji: "🐸", text: "kb.space.frog" },
  { id: "kangaroo", emoji: "🦘", text: "kb.space.kangaroo" }, { id: "dolphin", emoji: "🐬", text: "kb.space.dolphin" }];
const GO_THEMES = [{ id: "plane", emoji: "✈️", text: "kb.enter" }, { id: "train", emoji: "🚂", text: "kb.enter.train" },
  { id: "boat", emoji: "⛵", text: "kb.enter.boat" }, { id: "car", emoji: "🚗", text: "kb.enter.car" }];
const POP_KEY_THEMES = [{ id: "balloons", emoji: "🎈", text: "kb.backspace", tint: true }, { id: "bubbles", emoji: "🫧", text: "kb.backspace.bubbles" },
  { id: "candles", emoji: "🕯️", text: "kb.backspace.candles" }, { id: "snowmen", emoji: "⛄", text: "kb.backspace.snowmen" }];
const GROW_THEMES = [{ id: "sun", emoji: "🌞", text: "kb.shift" }, { id: "flower", emoji: "🌷", text: "kb.shift.flower" },
  { id: "moon", emoji: "🌝", text: "kb.shift.moon" }, { id: "pumpkin", emoji: "🎃", text: "kb.shift.pumpkin" }];

// ---------- Game 1: find the glowing key ----------
async function levelFindKeys(done) {
  const pool = (await freshPick("keyboard:1", FIND_SETS))[0].keys;
  const total = 6;
  let count = 0, target = null, shownAt = 0;
  const board = renderKeyboard();
  const big = el("div", { class: "big-letter" });
  const dots = progressDots(0, total);
  setScreen("kb-1", instruction("🔎", t("kb.find")), big, dots, board.node);

  function next() {
    let pick;
    do { pick = pool[Math.floor(Math.random() * pool.length)]; } while (pick === target);
    target = pick;
    big.textContent = target;
    big.style.background = zoneColor(target);
    board.highlight(target);
    shownAt = performance.now();
  }
  next();

  keyHandler = (e) => {
    const key = keyName(e);
    if (!key) return;
    const ms = Math.round(performance.now() - shownAt);
    sendKeys([{ key: target, correct: key === target, ms }]);
    if (key !== target) return softMiss(board, target, key);
    board.press(key);
    sfx("tap");
    count++;
    dots.textContent = progressDots(count, total).textContent;
    if (count === total) { keyHandler = null; return later(done, 700); }
    next();
  };
}

// ---------- Games 2 to 5: one special key each ----------
// `scene` is the picture; `react(n)` makes the picture respond to the n-th press.
function specialKeyGame(done, { screen, icon, text, key, total, scene, react, rows = null }) {
  const board = renderKeyboard(settings.keyboard_layout, rows);
  const dots = progressDots(0, total);
  setScreen(screen, instruction(icon, text), scene, dots, board.node);
  board.highlight(key);
  let count = 0, shownAt = performance.now();

  keyHandler = (e) => {
    const pressed = keyName(e);
    if (!pressed) return;
    sendKeys([{ key, correct: pressed === key, ms: Math.round(performance.now() - shownAt) }]);
    if (pressed !== key) return softMiss(board, key, pressed);
    board.press(key);
    count++;
    react(count);
    dots.textContent = progressDots(count, total).textContent;
    shownAt = performance.now();
    if (count === total) { keyHandler = null; later(done, 1000); }
  };
}

// Restart a CSS animation on an element (so pressing twice quickly still animates).
function replayAnimation(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }

async function levelSpace(done) {
  const theme = (await freshPick("keyboard:2", JUMP_THEMES))[0];
  const rocket = el("div", { class: "scene-item rocket" }, theme.emoji);
  specialKeyGame(done, {
    screen: "kb-2", icon: theme.emoji, text: t(theme.text), key: "SPACE", total: 4,
    scene: el("div", { class: "scene" }, rocket),
    react: () => { replayAnimation(rocket, "jump-up"); sfx("boing"); },
  });
}

async function levelEnter(done) {
  const theme = (await freshPick("keyboard:3", GO_THEMES))[0];
  const plane = el("div", { class: "scene-item plane" }, theme.emoji);
  specialKeyGame(done, {
    screen: "kb-3", icon: theme.emoji, text: t(theme.text), key: "ENTER", total: 3,
    scene: el("div", { class: "scene" }, plane),
    react: () => { replayAnimation(plane, "fly"); sfx("play"); },
  });
}

async function levelBackspace(done) {
  const theme = (await freshPick("keyboard:4", POP_KEY_THEMES))[0];
  const balloons = el("div", { class: "scene balloons" }, ...[0, 1, 2, 3].map((i) => {
    const node = el("span", { class: "scene-item" }, theme.emoji);
    if (theme.tint) node.style.filter = `hue-rotate(${i * 80}deg)`;
    return node;
  }));
  specialKeyGame(done, {
    screen: "kb-4", icon: theme.emoji, text: t(theme.text), key: "BACKSPACE", total: 4,
    scene: balloons,
    react: () => { // Backspace removes the last thing, just like when typing
      const last = balloons.lastElementChild;
      last.classList.add("pop");
      sfx("tap");
      setTimeout(() => last.remove(), 300);
    },
  });
}

async function levelShift(done) {
  const theme = (await freshPick("keyboard:5", GROW_THEMES))[0];
  const sun = el("div", { class: "scene-item sun" }, theme.emoji);
  specialKeyGame(done, {
    screen: "kb-5", icon: theme.emoji, text: t(theme.text), key: "SHIFT", total: 3,
    scene: el("div", { class: "scene" }, sun),
    react: () => { replayAnimation(sun, "grow"); sfx("sparkle"); },
  });
}

// ---------- Bonus game 6: arrow keys ----------
const pickInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
// A bunny hops through a small garden to the carrot. The arrow that moves it next glows.
function levelArrows(done) {
  const COLS = 5, ROWS = 3;
  const MOVES = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };
  // A random start and carrot 4 to 6 steps apart; the path goes sideways first, then up or down.
  let start, goal;
  do {
    start = [pickInt(0, COLS - 1), pickInt(0, ROWS - 1)];
    goal = [pickInt(0, COLS - 1), pickInt(0, ROWS - 1)];
  } while (Math.abs(goal[0] - start[0]) + Math.abs(goal[1] - start[1]) < 4);
  const path = [
    ...Array(Math.abs(goal[0] - start[0])).fill(goal[0] > start[0] ? "RIGHT" : "LEFT"),
    ...Array(Math.abs(goal[1] - start[1])).fill(goal[1] > start[1] ? "DOWN" : "UP"),
  ];
  let [x, y] = start, step = 0, shownAt = performance.now();

  const cells = [];
  const garden = el("div", { class: "garden" });
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = el("div", { class: "garden-cell" });
    cells.push(cell);
    garden.append(cell);
  }
  const draw = () => cells.forEach((cell, i) => {
    const cx = i % COLS, cy = Math.floor(i / COLS);
    cell.textContent = cx === x && cy === y ? "🐰" : cx === goal[0] && cy === goal[1] ? "🥕" : "";
  });
  draw();

  const board = renderKeyboard(settings.keyboard_layout, ARROW_ROWS);
  const dots = progressDots(0, path.length);
  setScreen("kb-6", instruction("🐰", t("kb.arrows")), garden, dots, board.node);
  board.highlight(path[0]);

  keyHandler = (e) => {
    const key = keyName(e);
    if (!key) return;
    const target = path[step];
    sendKeys([{ key: target, correct: key === target, ms: Math.round(performance.now() - shownAt) }]);
    if (key !== target) return softMiss(board, target, key);
    board.press(key);
    x += MOVES[key][0]; y += MOVES[key][1];
    draw();
    sfx("boing");
    step++;
    shownAt = performance.now();
    dots.textContent = progressDots(step, path.length).textContent;
    if (step === path.length) { keyHandler = null; board.highlight(null); sfx("sparkle"); return later(done, 1000); }
    board.highlight(path[step]);
  };
}

// ---------- Bonus game 7: Caps Lock ----------
function levelCapsLock(done) {
  const word = el("div", { class: "caps-word" }, "happy");
  specialKeyGame(done, {
    screen: "kb-7", icon: "🔠", text: t("kb.caps"), key: "CAPS", total: 4, rows: CAPS_ROWS,
    scene: el("div", { class: "scene" }, word),
    react: (n) => { word.textContent = n % 2 ? "HAPPY" : "happy"; sfx("sparkle"); },   // big, small, big, small
  });
}
