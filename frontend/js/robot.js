// Robot Helper: a computer does exactly what it is told, one step after the other. The child builds a
// little program by clicking arrow cards, then presses play and the robot follows it. If the robot does not
// reach the battery it simply walks back to the start, and the child can change the program and try again.
// The levels grow from two cards to a longer program with a "3 steps" card (a first loop).

const ROBOT_ICONS = ["🔋", "🗺️", "🪨", "⏩", "🔋🔋"];

// Cards: what each one does. "R3" and "D3" are the double arrows: the same step three times in a row.
const ROBOT_CARDS = {
  R: { label: "➡️", dx: 1, dy: 0, times: 1 }, L: { label: "⬅️", dx: -1, dy: 0, times: 1 },
  U: { label: "⬆️", dx: 0, dy: -1, times: 1 }, D: { label: "⬇️", dx: 0, dy: 1, times: 1 },
  R3: { label: "⏩", dx: 1, dy: 0, times: 3 }, D3: { label: "⏬", dx: 0, dy: 1, times: 3 },
};
const ARROWS = ["R", "L", "U", "D"];

// cols/rows: size of the garden. start, goals (batteries) and rocks are [x, y] cells. `slots` is how many cards the
// program may have. `solution` is one way to solve it (used for the gentle hints and by the automatic tests).
// `guide`: show which card is next while the child builds the program.
// Coming back to a level brings a new garden: levels 1 to 4 are made up fresh each time (makeGarden), level 5 is
// one of a few hand-made gardens (its double arrows must fit exactly).
const ROBOT_TEXTS = ["robot.l1", "robot.l2", "robot.l3", "robot.l4", "robot.l5"];
const LEVEL_FIVE = [
  { cols: 5, rows: 4, start: [0, 0], goals: [[4, 0], [4, 3]], rocks: [[2, 0]], solution: ["D", "R3", "R", "U", "D3"] },
  { cols: 5, rows: 4, start: [0, 3], goals: [[3, 0], [4, 3]], rocks: [[1, 3]], solution: ["U", "R3", "U", "U", "D3", "R"] },
  { cols: 5, rows: 4, start: [0, 0], goals: [[0, 3], [4, 3]], rocks: [[2, 1]], solution: ["D3", "R3", "R"] },
];
const pickInt5 = (n) => Math.floor(Math.random() * n);
const MOVE = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] };

// The shortest way from `from` to `to` that avoids rocks and stays inside, as single arrows ("R", "U"...), or null.
function shortestWay(cols, rows, rocks, from, to) {
  const key = ([x, y]) => `${x},${y}`;
  const blocked = new Set(rocks.map(key));
  const queue = [[from, []]], seen = new Set([key(from)]);
  while (queue.length) {
    const [[x, y], way] = queue.shift();
    if (x === to[0] && y === to[1]) return way;
    for (const [name, [dx, dy]] of Object.entries(MOVE)) {
      const next = [x + dx, y + dy];
      if (next[0] < 0 || next[1] < 0 || next[0] >= cols || next[1] >= rows || blocked.has(key(next)) || seen.has(key(next))) continue;
      seen.add(key(next)); queue.push([next, [...way, name]]);
    }
  }
  return null;
}

// A fresh garden for levels 1 to 4. Tries random layouts until one fits the level's idea.
function makeGarden(number) {
  const cell = (cols, rows) => [pickInt5(cols), pickInt5(rows)];
  for (;;) {
    if (number === 1) {                                 // two steps in a straight line
      const start = cell(4, 3), [dx, dy] = Object.values(MOVE)[pickInt5(4)], goal = [start[0] + 2 * dx, start[1] + 2 * dy];
      if (goal[0] < 0 || goal[1] < 0 || goal[0] > 3 || goal[1] > 2) continue;
      return { cols: 4, rows: 3, start, goals: [goal], rocks: [], slots: 3, cards: ARROWS, solution: shortestWay(4, 3, [], start, goal), guide: true };
    }
    if (number === 2) {                                 // four or five steps: across, then up or down
      const start = cell(5, 3), goal = cell(5, 3), dx = goal[0] - start[0], dy = goal[1] - start[1];
      if (Math.abs(dx) + Math.abs(dy) < 4 || !dy) continue;
      const solution = [...Array(Math.abs(dx)).fill(dx > 0 ? "R" : "L"), ...Array(Math.abs(dy)).fill(dy > 0 ? "D" : "U")];
      return { cols: 5, rows: 3, start, goals: [goal], rocks: [], slots: 6, cards: ARROWS, solution, guide: true };
    }
    if (number === 3) {                                 // a rock in the straight way, so the robot must go around it
      const row = pickInt5(3), start = [0, row], goal = [3 + pickInt5(2), row], rock = [1 + pickInt5(goal[0] - 1), row];
      const way = shortestWay(5, 3, [rock], start, goal);
      if (!way || way.length > 6) continue;
      return { cols: 5, rows: 3, start, goals: [goal], rocks: [rock], slots: 7, cards: ARROWS, solution: way, guide: true };
    }
    const row = pickInt5(3);                            // level 4: the double arrow, twice, along a long row
    return { cols: 7, rows: 3, start: [0, row], goals: [[6, row]], rocks: [], slots: 3, cards: [...ARROWS, "R3"], solution: ["R3", "R3"], guide: false };
  }
}

function robotGarden(number) {
  const level = number < 5 ? makeGarden(number)
    : { ...LEVEL_FIVE[pickInt5(LEVEL_FIVE.length)], slots: 6, cards: [...ARROWS, "R3", "D3"], guide: false };
  return { ...level, text: ROBOT_TEXTS[number - 1] };
}

function robotHelper() {
  levelPicker("robot", "🤖", ROBOT_ICONS, (n) => robotLevel(n, () => completeLevel("robot", n, robotHelper)));
}

function robotLevel(number, done) {
  const level = robotGarden(number);
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  let program = [];
  let running = false;

  // ----- the garden -----
  const grid = el("div", { class: "rgrid" });
  grid.style.gridTemplateColumns = `repeat(${level.cols}, 1fr)`;
  grid.style.setProperty("--cols", level.cols);
  grid.style.setProperty("--rows", level.rows);
  const cells = {};
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      cells[`${x},${y}`] = el("div", { class: "rcell" });
      grid.append(cells[`${x},${y}`]);
    }
  }
  const robot = el("div", { class: "robot" }, "🤖");
  let at = [...level.start], got = [];
  function drawGarden() {
    Object.values(cells).forEach((cell) => cell.replaceChildren());
    level.rocks.forEach(([x, y]) => cells[`${x},${y}`].append(el("span", {}, "🪨")));
    level.goals.forEach(([x, y]) => { if (!got.some((g) => same(g, [x, y]))) cells[`${x},${y}`].append(el("span", {}, "🔋")); });
    cells[`${at[0]},${at[1]}`].append(robot);
  }

  // ----- the program -----
  const strip = el("div", { class: "rprog" });
  const slots = Array.from({ length: level.slots }, () => el("div", { class: "rslot" }));
  strip.append(...slots);
  const cardRow = el("div", { class: "rcards" });
  const buttons = {};
  for (const name of level.cards) {
    buttons[name] = el("button", { class: "rcard", "data-card": name, "aria-label": name }, ROBOT_CARDS[name].label);
    buttons[name].addEventListener("click", () => add(name));
    cardRow.append(buttons[name]);
  }
  const undo = el("button", { class: "rcard rundo", "aria-label": "undo" }, "↩️");
  const run = el("button", { class: "rcard rrun", "aria-label": "play" }, "▶️");
  cardRow.append(undo, run);

  function drawProgram() {
    slots.forEach((slot, i) => { slot.textContent = program[i] ? ROBOT_CARDS[program[i]].label : ""; slot.classList.toggle("filled", !!program[i]); });
    // The gentle guide: if the cards so far are right, the next card glows; if not, the take-back button does.
    Object.values(buttons).concat([undo, run]).forEach((b) => b.classList.remove("attention-btn"));
    if (!level.guide || running) return;
    const onTrack = program.every((card, i) => card === level.solution[i]);
    if (!onTrack) undo.classList.add("attention-btn");
    else if (program.length === level.solution.length) run.classList.add("attention-btn");
    else buttons[level.solution[program.length]].classList.add("attention-btn");
  }
  function add(name) {
    if (running || program.length >= level.slots) return;
    program.push(name); sfx("tap"); drawProgram();
  }
  undo.addEventListener("click", () => { if (running || !program.length) return; program.pop(); sfx("key"); drawProgram(); });

  // ----- running it -----
  // Every step is one small move; a rock or the edge of the garden just makes the robot stay where it is.
  const steps = () => program.flatMap((name) => Array(ROBOT_CARDS[name].times).fill(ROBOT_CARDS[name]));
  run.addEventListener("click", () => {
    if (running || !program.length) return;
    running = true; drawProgram(); sfx("play");
    const list = steps();
    at = [...level.start]; got = []; drawGarden();
    let i = 0;
    const tick = () => {
      if (i === list.length) return finish();
      const next = [at[0] + list[i].dx, at[1] + list[i].dy];
      const inside = next[0] >= 0 && next[1] >= 0 && next[0] < level.cols && next[1] < level.rows;
      if (inside && !level.rocks.some((r) => same(r, next))) {
        at = next; sfx("note", i % 8);
        if (level.goals.some((g) => same(g, at)) && !got.some((g) => same(g, at))) { got.push([...at]); sfx("sparkle"); }
      } else {
        replayAnimation(robot, "wobble"); sfx("key");
      }
      drawGarden();
      i++;
      later(tick, 450);
    };
    const finish = () => {
      if (got.length === level.goals.length) {
        sfx("success"); robot.classList.add("happy");
        $("#screen").dataset.need = "";
        return later(done, 1100);
      }
      speak(t("robot.again"));                        // not there yet: back to the start, the program stays
      later(() => { at = [...level.start]; got = []; running = false; drawGarden(); drawProgram(); }, 900);
    };
    later(tick, 400);
  });

  const bubble = instruction("🤖", t(level.text));
  setScreen(`robot-${number}`, bubble, grid, strip, cardRow);
  $("#screen").dataset.need = level.solution.join(",");
  drawGarden(); drawProgram();
}
