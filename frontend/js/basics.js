// Computer Cove, Safety Harbour and Quiz Corner: tiny lessons, each pictures plus a spoken sentence. Nothing can be
// failed: a wrong choice just wobbles, the right answer pulses, and Keybo says "try another one".
// Computer Cove teaches the computer itself, Safety Harbour staying safe, Quiz Corner is general knowledge for fun.
// (They were all one world, Computer Cove, before the worlds were regrouped: backend/world_moves.py.)

const BASICS_ICONS = ["🖥️", "🪟", "📁", "🌐", "💾", "⏰"];
const SAFETY_ICONS = ["🙋", "🤐", "💛", "🕵️", "🎉", "🔑"];
const QUIZ_ICONS = ["🚩", "🪺", "🍎", "☔"];

function computerCove() {
  levelPicker("basics", "🐚", BASICS_ICONS, (n) => {
    [lessonParts, lessonWindow, lessonFolders, lessonInternet, lessonSave, lessonBreak, lessonPad][n - 1](
      () => completeLevel("basics", n, computerCove));
  });
}

function safetyHarbour() {
  levelPicker("safety", "⚓", SAFETY_ICONS, (n) => {
    [lessonAsk, lessonSecrets, lessonKind, lessonStranger, lessonPrizePopup, lessonPasswordAsk,
      lessonEmergency, lessonTraffic][n - 1](
      () => completeLevel("safety", n, safetyHarbour));
  });
}

function quizCorner() {
  levelPicker("quiz", "🧩", QUIZ_ICONS, (n) => {
    [lessonFlags, lessonAnimalHomes, lessonFood, lessonWeather][n - 1](() => completeLevel("quiz", n, quizCorner));
  });
}

// A speech bubble whose words can change during a lesson (tap it to hear it again).
function liveInstruction(icon, text) {
  let spoken = text;
  const node = el("button", { class: "bubble instruction", onclick: () => speak(spoken) }, `${icon} ${text} 🔊`);
  queueMicrotask(() => speak(text));   // after the screen is set: setScreen() silences the previous screen
  return { node, set(newIcon, newText) { spoken = newText; node.textContent = `${newIcon} ${newText} 🔊`; speak(newText); } };
}

// The engine behind most lessons: show a picture and a few big choices.
// steps: [{ icon, prompt, scene, options: [{ emoji }], answer: index, fact }]
function chooseSteps(screen, steps, done) {
  let index = 0;
  const dots = progressDots(0, steps.length);
  const bubble = liveInstruction(steps[0].icon, steps[0].prompt);
  const sceneBox = el("div", { class: "scene-card" });
  const choices = el("div", { class: "choices" });
  setScreen(screen, bubble.node, sceneBox, choices, dots);

  function show() {
    const step = steps[index];
    if (index > 0) bubble.set(step.icon, step.prompt); // the first prompt is already spoken
    sceneBox.textContent = step.scene || "";
    sceneBox.hidden = !step.scene;
    const order = shuffled(step.options.map((option, i) => ({ ...option, right: i === step.answer })));
    choices.replaceChildren(...order.map((option) => {
      const card = el("button", { class: "choice" }, option.emoji);
      card.addEventListener("click", () => pick(card, option));
      return card;
    }));
  }

  function pick(card, option) {
    const step = steps[index];
    if (!option.right) {
      // Wrong choice: no buzzer, no red. Wobble, then point at the right one.
      replayAnimation(card, "wobble");
      sfx("key");
      const right = [...choices.children].find((c) => c.textContent === step.options[step.answer].emoji);
      replayAnimation(right, "attention");
      speak(t("basics.tryAgain"));
      return;
    }
    [...choices.children].forEach((c) => (c.disabled = true));
    card.classList.add("chosen");
    replayAnimation(card, "jump-up");
    sfx("success");
    dots.textContent = progressDots(index + 1, steps.length).textContent;
    if (step.fact) speak(step.fact);
    later(() => {
      index++;
      if (index === steps.length) done(); else show();
    }, step.fact ? 2600 : 1200);
  }
  show();
}

// ---------- Pools of questions ----------
// Most lessons are a pool of questions. Each visit asks `n` of them, the ones this child has not seen for the longest
// time (freshPick in app.js), so coming back to a lesson brings new questions. A question with its own `fact` says
// it after the right answer; `lastFact` is said after the last question only (saying it three times would bore).
async function poolLesson(screen, key, pool, done, { n = 3, lastFact = null } = {}) {
  const steps = (await freshPick(key, pool, n)).map((step) => ({ ...step }));
  if (lastFact) steps[steps.length - 1].fact = steps[steps.length - 1].fact || lastFact;
  chooseSteps(screen, steps, done);
}

// The right emoji and `count - 1` others from the same family, as choices (chooseSteps shuffles them; answer 0).
const withOthers = (right, family, count = 3) =>
  [right, ...shuffled(family.filter((e) => e !== right)).slice(0, count - 1)].map((emoji) => ({ emoji }));

// A question "which one is ...?" with its answer among others of the same family, and a fact after it.
const quizStep = (id, key, right, family, extra = {}) =>
  ({ id, icon: right, prompt: t(key), options: withOthers(right, family), answer: 0, fact: t(key + ".fact"), ...extra });

// ---------- Computer Cove 1. The parts of a computer ----------
const PARTS = { screen: "🖥️", mouse: "🖱️", keyboard: "⌨️", speaker: "🔊", printer: "🖨️", headphones: "🎧", mic: "🎤", camera: "📷" };
function lessonParts(done) {
  const all = Object.values(PARTS);
  poolLesson("basics-1", "basics:1", Object.entries(PARTS).map(([id, emoji]) => quizStep(id, `b1.${id}`, emoji, all)), done);
}

// ---------- Computer Cove 2. Open and close a window ----------
function lessonWindow(done) {
  const total = 2;
  let count = 0;
  const bubble = liveInstruction("🪟", t("b2.open"));
  const desk = el("div", { class: "desktop" });
  const dots = progressDots(0, total);
  setScreen("basics-2", bubble.node, desk, dots);

  let app = "🎨";
  function showIcon() {
    if (count > 0) bubble.set("🪟", t("b2.open")); // the first time it is already spoken
    app = ["🎨", "🎵", "📷", "🎮", "📚", "🧮"][Math.floor(Math.random() * 6)];   // a different program each time
    const icon = el("button", { class: "app-icon", onclick: openWindow }, el("span", { class: "app-emoji" }, app));
    desk.replaceChildren(icon);
  }

  function openWindow() {
    sfx("boing");
    bubble.set("❌", t("b2.close"));
    const close = el("button", { class: "close-x", "aria-label": "close", onclick: () => closeWindow(win) }, "✖");
    const win = el("div", { class: "fake-window opening" },
      el("div", { class: "title-bar" }, el("span", {}, app), close), el("div", { class: "win-body" }, "😀"));
    desk.replaceChildren(win);
  }

  function closeWindow(win) {
    if (win.classList.contains("closing")) return; // a double-click on ✖ must count once
    win.classList.add("closing");
    sfx("tap");
    count++;
    dots.textContent = progressDots(count, total).textContent;
    if (count === total) { speak(t("b2.fact")); return later(done, 2200); }
    later(showIcon, 500);
  }
  showIcon();
}

// ---------- Computer Cove 3. Files and folders ----------
// Which folder a file belongs in: pictures, music or writing. Only the file changes, so no new words are needed.
const FOLDER_FILES = { "📁🖼️": ["📷", "🌄", "🖼️", "🐶"], "📁🎵": ["🎵", "🎸", "🥁", "🎤"], "📁📝": ["📝", "✏️", "📖", "✉️"] };
function lessonFolders(done) {
  const folders = Object.keys(FOLDER_FILES).map((emoji) => ({ emoji }));
  const pool = Object.values(FOLDER_FILES).flatMap((files, f) =>
    files.map((file, i) => ({ id: `f${f}${i}`, icon: "📁", prompt: t("b3.ask"), scene: file, options: folders, answer: f })));
  poolLesson("basics-3", "basics:3", pool, done, { lastFact: t("b3.fact") });
}

// ---------- Computer Cove 6. Screen breaks ----------
const BREAKS = [["look", "🌳⛰️☁️", "👀"], ["stretch", "🙆", "🤸"], ["drink", "💧", "🥤"], ["blink", "👁️", "😉"],
  ["shake", "🐕💦", "🙌"], ["jump", "⬆️", "🦘"], ["eyes", "5️⃣", "🙈"]];
function lessonBreak(done) {
  const pool = BREAKS.map(([id, scene, emoji]) => ({ id, icon: "⏰", prompt: t(`b4.${id}`), scene, options: [{ emoji }], answer: 0 }));
  poolLesson("basics-4", "basics:6", pool, done, { lastFact: t("b4.fact") });
}

// ---------- Safety Harbour 1. Ask a grown-up first ----------
// Something new on the screen: a prize, a link, a download, a shop, a photo upload, a message. Ask first.
const ASK_SCENES = ["🎁 ✨ 🎉", "🔗 ❓", "📦 ⬇️ ❓", "🎮 💰 ❓", "📷 ⬆️ ❓", "💬 🔔 ❓", "🛒 ❓"];
function lessonAsk(done) {
  const options = [{ emoji: "🙋" }, { emoji: "🖱️" }];   // 🙋 = ask a grown-up, 🖱️ = just click
  const pool = ASK_SCENES.map((scene, i) => ({ id: `a${i}`, icon: "🙋", prompt: t("b5.ask"), scene, options, answer: 0 }));
  poolLesson("basics-5", "safety:1", pool, done, { lastFact: t("b5.fact") });
}

// ---------- Safety Harbour 2. Keep private things secret online ----------
// Mostly things to keep secret, and one that is fine to tell (a favourite colour), so the child really has to think.
const SECRETS = [["address", "🏠 ❓"], ["name", "🧒 ❓"], ["password", "🔑 ❓"], ["school", "🏫 ❓"], ["phone", "📞 ❓"], ["photo", "📸 ❓"]];
function lessonSecrets(done) {
  const options = [{ emoji: "🤐" }, { emoji: "💬" }];   // 🤐 = keep it secret, 💬 = tell
  const pool = SECRETS.map(([id, scene]) => ({ id, icon: "🤐", prompt: t(`b6.${id}`), scene, options, answer: 0 }));
  pool.push({ id: "colour", icon: "🎨", prompt: t("b6.colour"), scene: "🎨 ❓", options, answer: 1, fact: t("b6.colour.fact") });
  poolLesson("basics-6", "safety:2", pool, done, { lastFact: t("b6.fact") });
}

// ---------- Computer Cove 4. What is the internet? ----------
function lessonInternet(done) {
  const step = (id, emoji, others, scene) => ({ id, icon: "🌐", prompt: t(`b7.${id}`), scene,
    options: [emoji, ...others].map((e) => ({ emoji: e })), answer: 0, fact: t(`b7.${id}.fact`) });
  poolLesson("basics-7", "basics:4", [
    step("wifi", "📶", ["📺", "🔦"]), step("ask", "🌍🔍", ["🍎", "⚽"], "🦒 ❓"), step("call", "💻", ["📻", "🧸"], "👵 ❓"),
    step("map", "🗺️", ["🍕", "🎈"], "🦁 ❓"), step("mail", "📧", ["📦", "🥫"], "✉️ ❓"),
  ], done);
}

// ---------- Computer Cove 5. Saving a picture ----------
function lessonSave(done) {
  const step = (id, icon, scene, emoji, others) => ({ id, icon, prompt: t(`b8.${id}`), scene,
    options: [emoji, ...others].map((e) => ({ emoji: e })), answer: 0, fact: t(`b8.${id}.fact`) });
  poolLesson("basics-8", "basics:5", [
    step("save", "💾", "🖼️", "💾", ["🗑️", "🔦"]), step("where", "📁", "💾 ➡️", "📁", ["🍽️", "🪣"]),
    step("name", "🏷️", "🖼️ ❓", "🏷️", ["🥄", "🧦"]), step("open", "📂", "🖼️ 🔍", "📂", ["🗑️", "🔦"]),
  ], done);
}

// ---------- Safety Harbour 3. Being kind online ----------
function lessonKind(done) {
  const step = (id, icon, scene, emoji, other, fact = null) => ({ id, icon, prompt: t(`b9.${id}`), scene,
    options: [{ emoji }, { emoji: other }], answer: 0, fact });
  poolLesson("basics-9", "safety:3", [
    step("sad", "💛", "😢", "💛", "😠"), step("mean", "🙋", "😠 💬", "🙋", "😠", t("b9.fact")),
    step("picture", "👏", "🖼️", "👏", "😝", t("b9.picture.fact")), step("game", "💛", "🎮 😢", "💛", "😝", t("b9.picture.fact")),
    step("photo", "🙋", "📸 🧒", "🙋", "📤", t("b9.photo.fact")),
  ], done);
}

// ---------- Computer Cove bonus 7. The touchpad ----------
function lessonPad(done) {
  chooseSteps("basics-10", [
    { icon: "☝️", prompt: t("b10.move"), scene: "➡️ 🖱️", options: [{ emoji: "☝️" }, { emoji: "🖐️" }, { emoji: "🦶" }], answer: 0, fact: t("b10.move.fact") },
    { icon: "👇", prompt: t("b10.click"), options: [{ emoji: "👇" }, { emoji: "🖐️" }], answer: 0 },
    { icon: "✌️", prompt: t("b10.scroll"), scene: "⬆️ ⬇️", options: [{ emoji: "✌️" }, { emoji: "☝️" }, { emoji: "🖐️" }], answer: 0, fact: t("b10.fact") },
  ], done);
}

// ---------- Safety Harbour bonus 7 (German). The emergency number ----------
// In Germany the fire brigade and the ambulance are reached on 112, the police on 110. A grown-up calls.
function lessonEmergency(done) {
  const services = [{ emoji: "🚒" }, { emoji: "🚑" }, { emoji: "🚓" }];
  chooseSteps("basics-11", [
    { icon: "🚒", prompt: t("de.b11.fire"), scene: "🔥", options: services, answer: 0, fact: t("de.b11.fire.fact") },
    { icon: "🚑", prompt: t("de.b11.hurt"), scene: "🤕", options: services, answer: 1, fact: t("de.b11.hurt.fact") },
    { icon: "🚓", prompt: t("de.b11.thief"), scene: "🦹", options: services, answer: 2, fact: t("de.b11.thief.fact") },
  ], done);
}

// ---------- Safety Harbour bonus 8 (German). Traffic lights and the zebra crossing ----------
function lessonTraffic(done) {
  chooseSteps("basics-12", [
    { icon: "🔴", prompt: t("de.b12.red"), scene: "🚦 🔴", options: [{ emoji: "✋" }, { emoji: "🚶" }], answer: 0, fact: t("de.b12.red.fact") },
    { icon: "🟢", prompt: t("de.b12.green"), scene: "🚦 🟢", options: [{ emoji: "👀" }, { emoji: "🏃" }], answer: 0, fact: t("de.b12.green.fact") },
    { icon: "🦓", prompt: t("de.b12.cross"), scene: "🛣️", options: [{ emoji: "🦓" }, { emoji: "🏃" }, { emoji: "🚗" }], answer: 0, fact: t("de.b12.cross.fact") },
  ], done);
}

// ---------- Quiz Corner 1. Flags of the world ----------
const FLAGS = { japan: "🇯🇵", brazil: "🇧🇷", germany: "🇩🇪", france: "🇫🇷", italy: "🇮🇹", spain: "🇪🇸", canada: "🇨🇦",
  india: "🇮🇳", mexico: "🇲🇽", sweden: "🇸🇪", greece: "🇬🇷", kenya: "🇰🇪" };
function lessonFlags(done) {
  const all = Object.values(FLAGS);
  poolLesson("basics-13", "quiz:1", Object.entries(FLAGS).map(([id, flag]) => quizStep(id, `b13.${id}`, flag, all)), done);
}

// ---------- Quiz Corner 2. Where animals live ----------
const HABITATS = { sea: "🌊", desert: "🏜️", ice: "❄️", nest: "🪺", jungle: "🌴", farm: "🚜" };
const ANIMAL_HOMES = [["fish", "🐟", "sea"], ["bird", "🐦", "nest"], ["camel", "🐪", "desert"], ["penguin", "🐧", "ice"],
  ["whale", "🐳", "sea"], ["monkey", "🐒", "jungle"], ["parrot", "🦜", "jungle"], ["cow", "🐄", "farm"], ["pig", "🐖", "farm"],
  ["lizard", "🦎", "desert"], ["seal", "🦭", "ice"]];
function lessonAnimalHomes(done) {
  const all = Object.values(HABITATS);
  poolLesson("basics-14", "quiz:2", ANIMAL_HOMES.map(([id, animal, home]) =>
    quizStep(id, `b14.${id}`, HABITATS[home], all, { icon: animal, scene: animal })), done);
}

// ---------- Quiz Corner 3. Good food ----------
const FOODS = [["fruit", "🍎", ["🍰", "🍟"]], ["banana", "🍌", ["🍫", "🧁"]], ["veg", "🥕", ["🍭", "🍩"]], ["broccoli", "🥦", ["🍪", "🍬"]],
  ["water", "💧", ["🥤", "🍬"]], ["teeth", "🥛", ["🍭", "🍬"]], ["breakfast", "🥣", ["🍰", "🍫"]]];
function lessonFood(done) {
  poolLesson("basics-15", "quiz:3", FOODS.map(([id, right, others]) =>
    ({ id, icon: right, prompt: t(`b15.${id}`), options: [right, ...others].map((e) => ({ emoji: e })), answer: 0, fact: t(`b15.${id}.fact`) })), done);
}

// ---------- Quiz Corner 4. Weather ----------
const WEATHER = [["rain", "🌧️", "☔"], ["sun", "☀️", "🕶️"], ["snow", "❄️", "🧤"], ["wind", "🌬️", "🪁"], ["cold", "🥶", "🧣"], ["puddle", "💦", "👢"]];
function lessonWeather(done) {
  const gear = WEATHER.map(([, , item]) => item);
  poolLesson("basics-16", "quiz:4", WEATHER.map(([id, sky, item]) => quizStep(id, `b16.${id}`, item, gear, { icon: sky, scene: sky })), done);
}

// ---------- Safety Harbour 4-6: the Safe & Smart stories (docs/DESIGN.md section 6.3) ----------
// Short, warm, two-choice scenarios. The correct choice is always "tell/ask a grown-up" or "keep it secret", never a
// dead end: a wrong tap only wobbles, exactly like every other lesson, so nothing here can scare or punish a child.
// Each story has a few versions; a visit tells two the child has not heard for the longest time.
const story = (id, icon, scene, options) => ({ id, icon, prompt: t(`ss.${id}`), scene, options, answer: 0, fact: t(`ss.${id}.fact`) });

function lessonStranger(done) {
  const options = [{ emoji: "🙋" }, { emoji: "💬" }];   // 🙋 = tell a grown-up, 💬 = answer them
  poolLesson("basics-17", "safety:4", [story("stranger", "🕵️", "💬 🕵️ ❓", options), story("meet", "🛝", "💬 🛝 ❓", options),
    story("gift", "🪙", "🪙 🏠 ❓", options)], done, { n: 2 });
}

function lessonPrizePopup(done) {
  const options = [{ emoji: "🙋" }, { emoji: "👆" }];   // 🙋 = tell a grown-up, 👆 = tap it
  poolLesson("basics-18", "safety:5", [story("prize", "🎉", "🎉 🎁 ❓", options), story("virus", "🤒", "💻 🤒 ❓", options),
    story("coins", "💎", "💎 💰 ❓", options)], done, { n: 2 });
}

function lessonPasswordAsk(done) {
  const options = [{ emoji: "🤐" }, { emoji: "💬" }];   // 🤐 = keep it secret, 💬 = tell them
  poolLesson("basics-19", "safety:6", [story("password", "🔑", "🔑 💬 ❓", options), story("friendpw", "🧒", "🧒 🔑 ❓", options),
    story("chatpw", "🎮", "🎮 🔑 ❓", options)], done, { n: 2 });
}
