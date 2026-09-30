// Things that make a child want to come back (owner's feedback: "some kids found it boring after some time"):
// Keybo's wardrobe, Keybo's garden, today's adventure and a party for every finished stage.
// Nothing here can be lost or used to pressure a child: outfits unlock at star totals (stars are never spent),
// the garden only ever grows, and a missed day costs nothing. The session and daily limits apply as everywhere.

// ---------- Keybo's wardrobe ----------
// An item unlocks once the child has this many stars in total. `slot`: where Keybo wears it (one item per slot).
const WARDROBE = [
  { id: "bow", emoji: "🎀", slot: "head", stars: 5 }, { id: "cap", emoji: "🧢", slot: "head", stars: 15 },
  { id: "glasses", emoji: "👓", slot: "eyes", stars: 25 }, { id: "flower", emoji: "🌸", slot: "head", stars: 35 },
  { id: "scarf", emoji: "🧣", slot: "neck", stars: 45 }, { id: "tophat", emoji: "🎩", slot: "head", stars: 60 },
  { id: "sunglasses", emoji: "🕶️", slot: "eyes", stars: 80 }, { id: "medal", emoji: "🏅", slot: "neck", stars: 100 },
  { id: "crown", emoji: "👑", slot: "head", stars: 130 }, { id: "graduate", emoji: "🎓", slot: "head", stars: 170 },
];
const outfit = () => (settings.outfit || "").split(",").map((id) => WARDROBE.find((item) => item.id === id)).filter(Boolean);

// Puts Keybo's outfit on a drawn mascot (mascotSVG in app.js calls this for every Keybo on every screen).
function dressUp(mascot) {
  for (const item of outfit()) mascot.append(el("span", { class: `outfit ${item.slot}`, "aria-hidden": "true" }, item.emoji));
}

async function wardrobeScreen() {
  await loadProgress();
  const worn = new Set(outfit().map((item) => item.id));
  const preview = el("div", { class: "wardrobe-mascot" }, mascotSVG());
  const items = WARDROBE.map((item) => {
    const open = progress.total_stars >= item.stars;
    const button = el("button", { class: "wardrobe-item" + (worn.has(item.id) ? " on" : "") + (open ? "" : " locked"),
      "data-item": item.id, "aria-label": item.id },
      el("span", { class: "icon" }, open ? item.emoji : "🔒"), el("span", { class: "stars" }, open ? "" : `⭐ ${item.stars}`));
    button.addEventListener("click", async () => {
      if (!open) { sfx("key"); speak(t("wardrobe.locked")); return; }
      // Wearing it takes off whatever was in the same place; tapping what Keybo wears takes it off.
      const next = worn.has(item.id) ? [...worn].filter((id) => id !== item.id)
        : [...worn].filter((id) => WARDROBE.find((w) => w.id === id).slot !== item.slot).concat(item.id);
      const { status, body } = await api("/api/outfit", { method: "POST", body: JSON.stringify({ items: next }) });
      if (status !== 200) return;
      settings.outfit = body.outfit;
      sfx("sparkle");
      wardrobeScreen();
    });
    return button;
  });
  setScreen("wardrobe", el("h1", { class: "title" }, "👕 " + t("wardrobe")), preview, el("div", { class: "wardrobe" }, ...items));
  speak(t("wardrobe.say"));
}

// ---------- Keybo's garden ----------
// Grows from what the child has done, so it needs no saving of its own: a flower for every finished level, a tree
// for every finished world, an animal for every finished stage and a butterfly for every adventure. Each thing has
// its own fixed spot (from a hash of its name), so the garden looks the same every visit and only gets fuller.
const FLOWERS = ["🌷", "🌼", "🌻", "🌸", "🌹", "🪻", "🌺"];
const TREES = ["🌳", "🌲", "🌴"];
const STAGE_ANIMALS = ["🐇", "🦆", "🦔", "🐿️", "🐝", "🐢", "🏡"];

function hashOf(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

function gardenThings() {
  const things = [];
  const add = (key, emoji, size) => {
    const h = hashOf(key);
    things.push({ emoji, size, x: 4 + (h % 88), y: 20 + ((h >>> 8) % 74) });   // below the sky, above the edge
  };
  for (const [world, info] of Object.entries(progress.worlds)) {
    for (const level of Object.keys(info.levels)) add(`${world}:${level}`, FLOWERS[hashOf(world + level) % FLOWERS.length], 1);
    if (info.complete) add(`${world}:tree`, TREES[hashOf(world) % TREES.length], 2);
  }
  STAGES.forEach((stage, i) => { if (stageDone(stage)) add(stage.key, STAGE_ANIMALS[i % STAGE_ANIMALS.length], 1.6); });
  for (let i = 0; i < Math.min(progress.adventures, 12); i++) add(`adventure:${i}`, "🦋", 1.2);
  return things.sort((a, b) => a.y - b.y);              // further back first, so nearer things stand in front
}

async function gardenScreen() {
  await loadProgress();
  const things = gardenThings();
  const garden = el("div", { class: "mascot-garden" }, ...(things.length ? things : [{ emoji: "🌱", size: 1.6, x: 46, y: 50 }]).map((thing) => {
    const node = el("span", { class: "mascot-garden-thing" }, thing.emoji);
    node.style.left = thing.x + "%";
    node.style.top = thing.y + "%";
    node.style.fontSize = `calc(${thing.size} * min(5vh, 44px))`;
    return node;
  }));
  const say = things.length ? t("garden.say") : t("garden.empty");
  setScreen("garden", el("h1", { class: "title" }, "🌷 " + t("garden")), el("div", { class: "bubble" }, say), garden);
  speak(say);
}

// ---------- The stage party ----------
const stageDone = (stage) => stage.worlds.every((w) => progress.worlds[w] && progress.worlds[w].complete);
const doneStages = () => new Set(STAGES.filter(stageDone).map((stage) => stage.key));

// Shown instead of the usual celebration when a level finishes a whole stage: fireworks, Keybo dancing, the child's
// name in lights, and the stage's certificate to print.
function stageParty(stageKey, newStickerIds, next) {
  const name = settings.child_name || t("friend");
  const stickers = newStickerIds.map(stickerById).filter(Boolean);
  const mascot = mascotSVG();
  mascot.classList.add("dance");
  const nodes = [el("h1", { class: "title" }, "🎉 " + t("party.title")), el("div", { class: "lights" }, name), mascot,
    el("div", { class: "bubble" }, t("party.text").replace("{stage}", t(stageKey).replace(/^\d+\.\s*/, "")))];
  for (const s of stickers) nodes.push(el("div", { class: "sticker-pop" }, el("span", { class: "sticker-emoji" }, s.emoji), el("span", {}, stickerName(s))));
  const buttons = el("div", { class: "party-buttons" });
  buttons.append(el("button", { class: "big-btn blue small-btn", onclick: () => printCertificate(stageKey) }, "🖨️ " + t("party.print")));
  buttons.append(el("button", { class: "big-btn play-btn", onclick: () => { sfx("play"); next(); } }, "▶"));
  nodes.push(buttons);
  setScreen("party", ...nodes);
  $("#screen").append(confetti(), confetti(), fireworks());
  sfx("sparkle");
  setTimeout(() => sfx("success"), 400);
  const serial = screenSerial;
  mascotLine("stage").then((line) => { if (serial === screenSerial) speak(line || t("party.title")); });
}

function fireworks() {
  const layer = el("div", { class: "fireworks" });
  for (let i = 0; i < 6; i++) {
    const burst = el("span", { class: "burst" }, ["✨", "🌟", "🎉", "💫"][i % 4]);
    burst.style.left = 8 + Math.random() * 84 + "%";
    burst.style.top = 6 + Math.random() * 40 + "%";
    burst.style.animationDelay = i * 0.35 + "s";
    layer.append(burst);
  }
  setTimeout(() => layer.remove(), 5000);
  return layer;
}

// ---------- Today's adventure ----------
// Three quick levels from three different worlds the child has opened, different every day (the same all day, so a
// child who stops half-way finds the same adventure again). Finishing it gives a butterfly in the garden and, on the
// 1st, 3rd, 7th and 14th adventure, a special sticker (backend/progress.py record_adventure).
let adventure = null;                                   // { tasks: [{ world, level }], index } while one is running
const ADVENTURE_WORLDS = ["mouse", "paint", "keyboard", "letters", "numbers", "name", "words", "sentences", "desktop",
  "internet", "basics", "safety", "robot", "quiz"];

function adventureTasks() {
  let seed = hashOf(new Date().toDateString() + settings.profile_id);
  const random = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0) % 10000) / 10000;
  const open = ADVENTURE_WORLDS.filter((w) => progress.worlds[w] && progress.worlds[w].unlocked);
  const worlds = [...open].sort((a, b) => hashOf(a + seed) - hashOf(b + seed)).slice(0, 3);
  return worlds.map((world) => ({ world, level: 1 + Math.floor(random() * progress.worlds[world].size) }));
}

// A picture, not words (most children here cannot read yet): the map pulses until today's adventure is done.
function adventureChip() {
  if (progress.adventure_today) return el("span", { class: "chip", "aria-label": t("adventure.chip") }, "🗺️✅");
  return el("button", { class: "chip adventure-chip attention-btn", "aria-label": t("adventure.chip"),
    onclick: () => { sfx("tap"); startAdventure(); } }, "🗺️");
}

function startAdventure() {
  adventure = { tasks: adventureTasks(), index: 0 };
  adventureStep();
}

// Between the levels: "step 2 of 3" with the world's picture, then the level itself.
function adventureStep() {
  if (adventure.index === adventure.tasks.length) return finishAdventure();
  const { world } = adventure.tasks[adventure.index];
  const trail = adventure.tasks.map((task, i) => el("span", { class: "trail-step" + (i < adventure.index ? " done" : i === adventure.index ? " now" : "") },
    i < adventure.index ? "✅" : WORLD_ICONS[task.world]));
  const text = t(`adventure.step${adventure.index + 1}`);          // three fixed lines, so each one has a recording
  setScreen("adventure", el("h1", { class: "title" }, "🗺️ " + t("adventure.title")), el("div", { class: "trail" }, ...trail),
    el("div", { class: "bubble" }, `${text} ${WORLD_ICONS[world]} ${t("world." + world)}`),
    el("button", { class: "big-btn play-btn", onclick: () => { sfx("play"); startLevel(adventure.tasks[adventure.index]); } }, "▶"));
  speak(text);
}

// Opens a world and starts one of its levels, the same way a tap on the level card does.
async function startLevel({ world, level }) {
  const serial = screenSerial;
  openWorld(world);
  for (let i = 0; i < 100; i++) {
    const cards = document.querySelectorAll("#screen .world.level");
    if (screenSerial !== serial && $("#screen").dataset.name === world && cards.length >= level) return cards[level - 1].click();
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

// Called by completeLevel: the "next" button after a level goes on with the adventure instead of to the level cards.
function adventureNext(world, level, next) {
  const task = adventure && adventure.tasks[adventure.index];
  if (!task || task.world !== world || task.level !== level) return next;
  return () => { adventure.index++; adventureStep(); };
}

async function finishAdventure() {
  adventure = null;
  const { status, body } = await api("/api/adventure/done", { method: "POST" });
  if (status !== 200) return mapScreen();
  await loadProgress();
  const stickers = body.new_stickers.map(stickerById).filter(Boolean);
  const nodes = [el("h1", { class: "title" }, "🏆 " + t("adventure.done")), el("div", { class: "big-emoji" }, "🦋"),
    el("div", { class: "bubble" }, t("adventure.doneSay"))];
  for (const s of stickers) nodes.push(el("div", { class: "sticker-pop" }, el("span", { class: "sticker-emoji" }, s.emoji), el("span", {}, stickerName(s))));
  nodes.push(el("button", { class: "big-btn play-btn", onclick: () => { sfx("play"); mapScreen(); } }, "▶"));
  setScreen("adventure-done", ...nodes);
  $("#screen").append(confetti());
  sfx("sparkle");
  speak(t("adventure.doneSay"));
}
