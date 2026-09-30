// The things that make a child come back: Keybo's wardrobe, the garden, the stage party and today's adventure.
T.run(async () => {
  await T.wait(1200);
  const H = await T.parentLogin();
  const finish = async (world, levels) => { for (const level of levels) await T.post("/api/progress/complete", { world, level, stars: 3 }); };

  // Wardrobe: nothing to wear without stars; the bow opens at 5 stars and Keybo wears it everywhere.
  await wardrobeScreen(); await T.wait(300);
  T.check("without stars everything in the wardrobe is locked", document.querySelectorAll(".wardrobe-item.locked").length === WARDROBE.length);
  await finish("mouse", [1, 2]);                                         // 6 stars
  await wardrobeScreen(); await T.wait(300);
  document.querySelector('.wardrobe-item[data-item="bow"]').click(); await T.wait(500);
  T.check("the bow can be worn once there are enough stars", settings.outfit === "bow", settings.outfit);
  T.check("Keybo wears it", !!document.querySelector(".mascot .outfit.head"));
  document.querySelector('.wardrobe-item[data-item="crown"]').click(); await T.wait(300);
  T.check("a locked item cannot be worn", settings.outfit === "bow", settings.outfit);
  document.querySelector('.wardrobe-item[data-item="bow"]').click(); await T.wait(500);
  T.check("tapping it again takes it off", settings.outfit === "", settings.outfit);

  // Garden: a flower for each finished level, a tree once the world is done.
  await finish("mouse", [3, 4]);
  await gardenScreen(); await T.wait(300);
  const garden = document.querySelector(".mascot-garden").textContent;
  T.check("four levels planted four flowers and Mouse Meadow a tree", [...garden].filter((c) => FLOWERS.includes(c)).length >= 4 && TREES.some((tree) => garden.includes(tree)), garden);

  // Stage party: finishing the last level of stage 1 (Mouse Meadow and Paint Place) throws a party.
  await finish("paint", [1, 2, 3, 4]);
  await loadProgress();
  await completeLevel("paint", 5, mapScreen); await T.wait(500);
  T.check("finishing a whole stage throws a party", T.name() === "party", T.name());
  T.check("the child's name is in lights", document.querySelector(".lights")?.textContent.length > 0);
  await completeLevel("paint", 5, mapScreen); await T.wait(500);
  T.check("playing it again is a normal celebration", T.name() === "celebrate", T.name());

  // Today's adventure: three levels from opened worlds, then a sticker, and it counts once a day.
  await T.post("/api/parent/unlock", { world: "all" }, H);
  await loadProgress(); mapScreen(); await T.wait(500);
  document.querySelector(".adventure-chip").click(); await T.wait(400);
  const tasks = adventure.tasks.map((task) => task.world + task.level).join();
  for (let stop = 0; stop < 3; stop++) {
    T.check(`adventure stop ${stop + 1} is shown`, T.name() === "adventure", T.name());
    document.querySelector("#screen .play-btn").click(); await T.wait(800);
    for (let tick = 0; tick < 3000 && !["celebrate", "party"].includes(T.name()); tick++) { await T.act(); await T.wait(60); }
    T.check(`adventure level ${stop + 1} can be finished`, ["celebrate", "party"].includes(T.name()), T.name());
    document.querySelector("#screen .play-btn").click(); await T.wait(900);
  }
  T.check("the adventure ends with its own screen", T.name() === "adventure-done", T.name());
  const p = await fetch("/api/progress").then((r) => r.json());
  T.check("the first adventure earns the explorer sticker", p.stickers.includes("compass") && p.adventure_today, JSON.stringify(p.stickers));
  mapScreen(); await T.wait(500);
  T.check("the map shows today's adventure as done", !document.querySelector(".adventure-chip"));
  T.check("the same adventure all day", adventureTasks().map((task) => task.world + task.level).join() === tasks);
});
