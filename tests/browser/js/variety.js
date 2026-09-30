// Coming back to a level brings new things (freshPick in app.js): what was seen is kept per child on the server,
// the next visit picks what was not seen for the longest time, and everything comes round before anything repeats.
T.run(async () => {
  await T.wait(1200);
  const H = await T.parentLogin();
  await T.post("/api/parent/unlock", { world: "all" }, H);
  await loadProgress();

  const pool = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id }));
  const ids = async () => (await freshPick("test:1", pool, 3)).map((item) => item.id).sort().join("");
  const first = await ids(), second = await ids(), third = await ids();
  T.check("the second visit brings three new ones", [...second].every((id) => !first.includes(id)), first + " / " + second);
  T.check("then the ones seen longest ago come back", third === first, third + " vs " + first);
  const other = (await freshPick("test:2", pool, 6)).length;
  T.check("each level keeps its own memory", other === 6);

  // A real lesson: Quiz Corner's flags remember what they asked, and the next visit asks other flags.
  const asked = async () => {
    openWorld("quiz"); await T.wait(500);
    document.querySelectorAll(".world.level")[0].click(); await T.wait(800);
    return (await fetch("/api/seen?key=quiz:1").then((r) => r.json())).ids;
  };
  const once = await asked(), twice = await asked();
  T.check("a lesson remembers three questions", once.length === 3, once.join());
  T.check("coming back asks three different ones", twice.length === 6 && twice.slice(3).every((id) => !once.includes(id)), twice.join());
});
