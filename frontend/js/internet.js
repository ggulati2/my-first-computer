// Internet Island: what using the internet feels like, in a pretend browser that loads nothing real.
// The child clicks links, uses the Back button, searches by typing, learns what to do with pop-ups and
// strangers, and keeps a favourite page. Every "web page" here is a picture drawn by the app itself.

const INTERNET_ICONS = ["🔗", "⬅️", "🔍", "🎁", "⭐"];

function internetIsland() {
  levelPicker("internet", "🌐", INTERNET_ICONS, (n) => {
    [netLinks, netBack, netSearch, netPopups, netFavourites][n - 1](() => completeLevel("internet", n, internetIsland));
  });
}

const netNeeds = (what) => { $("#screen").dataset.need = what; };

// The pages of the pretend web: a name (for the fake address) and a big picture.
const NET_PAGES = { dog: "🐶", rocket: "🚀", apple: "🍎", cat: "🐱", dino: "🦖", car: "🚗", fish: "🐟", train: "🚂" };
// Coming back brings other pages, search words and pop-ups (freshPick in app.js). The home page shows three links.
const netGoText = (name) => ({ rocket: "net.link", dog: "net.dog" })[name] || `net.go.${name}`;
const netMineText = (name) => name === "dog" ? "net.fav3" : `net.mine.${name}`;
async function netPages(key) {
  const shown = (await freshPick(key, Object.keys(NET_PAGES).map((id) => ({ id })), 3)).map((page) => page.id);
  return { shown, wanted: shown[Math.floor(Math.random() * shown.length)] };
}
// Search words that every keyboard shape can type, with the right picture among the results.
const NET_SEARCHES = [{ id: "dog", en: "dog", de: "hund", es: "perro", emoji: "🐶", result: "net.result" },
  { id: "cat", en: "cat", de: "katze", es: "gato", emoji: "🐱", result: "net.result.cat" },
  { id: "fish", en: "fish", de: "fisch", es: "pez", emoji: "🐟", result: "net.result.fish" },
  { id: "sun", en: "sun", de: "sonne", es: "sol", emoji: "☀️", result: "net.result.sun" },
  { id: "car", en: "car", de: "auto", es: "coche", emoji: "🚗", result: "net.result.car" }];

// A browser window: Back, Home, the address, a star for favourites and a page area.
function netBrowser() {
  const back = el("button", { class: "br-btn br-back", "aria-label": "back" }, "⬅️");
  const home = el("button", { class: "br-btn br-home", "aria-label": "home" }, "🏠");
  const address = el("div", { class: "br-address" }, "🔒 kids.example");
  const star = el("button", { class: "br-btn br-star", "aria-label": "favourite" }, "☆");
  const favs = el("button", { class: "br-btn br-favs", "aria-label": "favourites", hidden: "" }, "⭐📚");
  const page = el("div", { class: "br-page" });
  return { node: el("div", { class: "browser" }, el("div", { class: "br-bar" }, back, home, address, star, favs), page), back, home, star, favs, page, address };
}

// The start page: a big card for each link. `onOpen(name)` is called when the right link is clicked.
function netHomePage(browser, { wanted, onOpen, shown }) {
  browser.address.textContent = "🔒 kids.example";
  browser.page.replaceChildren(el("div", { class: "link-row" }, ...shown.map((name) => {
    const card = el("button", { class: "link-card", "data-page": name, "aria-label": name }, NET_PAGES[name]);
    card.addEventListener("click", () => {
      if (wanted && name !== wanted()) {              // another link: it wobbles and the right one pulses (nothing bad happens)
        replayAnimation(card, "wobble"); sfx("key");
        const right = browser.page.querySelector(`[data-page="${wanted()}"]`);
        if (right) replayAnimation(right, "attention");
        speak(t("basics.tryAgain"));
        return;
      }
      sfx("tap");
      onOpen(name);
    });
    return card;
  })));
}

function netArticlePage(browser, name) {
  browser.address.textContent = `🔒 kids.example/${name}`;
  browser.page.replaceChildren(el("div", { class: "article", "data-page": name }, NET_PAGES[name]));
}

// ---------- Level 1: click a link ----------
async function netLinks(done) {
  const { shown, wanted } = await netPages("internet:1");
  const browser = netBrowser();
  browser.back.disabled = true;
  const bubble = liveInstruction(NET_PAGES[wanted], t(netGoText(wanted)));
  setScreen("internet-1", bubble.node, browser.node);
  netNeeds("link:" + wanted);
  netHomePage(browser, {
    shown, wanted: () => wanted,
    onOpen: (name) => { netArticlePage(browser, name); sfx("success"); netNeeds(""); later(done, 1200); },
  });
}

// ---------- Level 2: the Back button ----------
async function netBack(done) {
  const { shown, wanted } = await netPages("internet:2");
  const browser = netBrowser();
  let phase = "link";
  const bubble = liveInstruction(NET_PAGES[wanted], t(netGoText(wanted)));
  setScreen("internet-2", bubble.node, browser.node);
  browser.back.disabled = true;
  netNeeds("link:" + wanted);
  const showHome = () => netHomePage(browser, {
    shown, wanted: () => wanted,
    onOpen: (name) => {
      netArticlePage(browser, name);
      phase = "back";
      browser.back.disabled = false;
      browser.back.classList.add("attention-btn");
      bubble.set("⬅️", t("net.back"));
      netNeeds("back");
    },
  });
  showHome();
  browser.back.addEventListener("click", () => {
    if (phase !== "back") return;
    phase = "done";
    sfx("home");
    browser.back.classList.remove("attention-btn");
    showHome();
    netNeeds("");
    later(done, 900);
  });
}

// ---------- Level 3: search by typing ----------
async function netSearch(done) {
  const [search] = await freshPick("internet:3", NET_SEARCHES);
  const word = search[settings.language] || search.en;
  const others = shuffled(NET_SEARCHES.filter((s) => s !== search)).slice(0, 2).map((s) => ({ emoji: s.emoji }));
  typingRound({
    screen: "internet-3", icon: "🔍", text: t("net.search"),
    items: [{ text: shout(word), speak: word, picture: "🔍" }],
    onDone: () => chooseSteps("internet-choose", [
      { icon: search.emoji, prompt: t(search.result), scene: "🔍", options: [{ emoji: search.emoji }, ...others], answer: 0 },
    ], done),
  });
}

// ---------- Level 4: pop-ups, downloads and strangers ----------
async function netPopups(done) {
  const help = [{ emoji: "🙋" }];
  const pool = [
    { id: "prize", icon: "🎁", prompt: t("net.pop1"), scene: "🎉🎁🎉", options: [...help, { emoji: "🎁" }, { emoji: "👆" }], answer: 0 },
    { id: "download", icon: "⬇️", prompt: t("net.pop2"), scene: "⬇️🎮", options: [...help, { emoji: "⬇️" }, { emoji: "✅" }], answer: 0 },
    { id: "stranger", icon: "🕵️", prompt: t("net.pop3"), scene: "🕵️❓", options: [...help, { emoji: "⌨️" }, { emoji: "🏠" }], answer: 0 },
    { id: "photo", icon: "📸", prompt: t("net.pop4"), scene: "💬📸", options: [...help, { emoji: "📤" }, { emoji: "👍" }], answer: 0 },
    { id: "lives", icon: "💰", prompt: t("net.pop5"), scene: "🎮💰", options: [...help, { emoji: "💳" }, { emoji: "👆" }], answer: 0 },
  ];
  const steps = await freshPick("internet:4", pool, 3);
  chooseSteps("internet-4", steps.map((step, i) => (i === steps.length - 1 ? { ...step, fact: t("net.pop.fact") } : step)), done);
}

// ---------- Level 5: keep a favourite page ----------
async function netFavourites(done) {
  const { shown, wanted } = await netPages("internet:5");
  const browser = netBrowser();
  let phase = "link";                                  // link -> star -> home -> favs -> item
  const bubble = liveInstruction(NET_PAGES[wanted], t(netGoText(wanted)));
  setScreen("internet-5", bubble.node, browser.node);
  browser.back.disabled = true;
  let kept = false;

  const showHome = () => netHomePage(browser, {
    shown, wanted: () => wanted,
    onOpen: (name) => {
      netArticlePage(browser, name);
      if (phase === "link") {
        phase = "star";
        browser.star.classList.add("attention-btn");
        bubble.set("⭐", t("net.fav"));
        netNeeds("star");
      }
    },
  });
  showHome();
  netNeeds("link:" + wanted);

  browser.star.addEventListener("click", () => {
    if (phase !== "star") return;
    phase = "home";
    kept = true;
    browser.star.textContent = "★";
    browser.star.classList.remove("attention-btn");
    sfx("sparkle");
    browser.home.classList.add("attention-btn");
    bubble.set("🏠", t("net.fav2"));
    netNeeds("home");
  });
  browser.home.addEventListener("click", () => {
    sfx("tap");
    if (phase !== "home") return showHome();
    phase = "favs";
    browser.home.classList.remove("attention-btn");
    showHome();
    browser.star.textContent = "☆";
    browser.favs.hidden = false;
    browser.favs.classList.add("attention-btn");
    netNeeds("favs");
  });
  browser.favs.addEventListener("click", () => {
    if (phase !== "favs" || !kept) return;
    phase = "item";
    sfx("tap");
    browser.favs.classList.remove("attention-btn");
    const item = el("button", { class: "link-card fav-item attention-btn", "aria-label": "favourite page" }, NET_PAGES[wanted]);
    browser.address.textContent = "🔒 kids.example/⭐";
    browser.page.replaceChildren(el("div", { class: "link-row" }, item));
    bubble.set(NET_PAGES[wanted], t(netMineText(wanted)));
    netNeeds("favitem");
    item.addEventListener("click", () => {
      if (phase !== "item") return;
      phase = "done";
      netArticlePage(browser, wanted);
      sfx("success");
      netNeeds("");
      later(done, 1200);
    });
  });
}
