// Keybo's recorded voice: known sentences are played from the recordings, a line with the child's name is played in pieces,
// and anything without a recording falls back to the computer's voice. (Audio is replaced by a spy: no sound in tests.)
T.run(async () => {
  await T.wait(1500);
  const H = await T.parentLogin();
  await T.post("/api/parent/settings", { language: "en", voice_on: true, child_name: "Mia", daily_limit_minutes: 0, session_minutes: 0 }, H);
  settings = { ...settings, language: "en", voice_on: true, child_name: "Mia" }; applyLook(); await voice.loading;
  T.check("the English recordings are loaded", voice.clips.size > 500, voice.clips.size + " clips");

  const played = [], clips = [];
  // The recording that is playing finishes (the app reads its "ended" state, as with a real recording).
  const finishPlaying = () => { clips[clips.length - 1].ended = true; };
  window.Audio = function (src) {
    this.src = src; this.paused = false; this.ended = false; this.pause = () => { this.paused = true; };
    this.addEventListener = () => {};
    clips.push(this);
    this.play = () => { played.push(src); return Promise.resolve(); };
  };
  const said = [], realSpeak = window.speechSynthesis && speechSynthesis.speak;
  window.speakWithSystemVoice = (text) => said.push(text);          // what the computer's voice would have said
  const reset = () => { played.length = 0; said.length = 0; };

  reset(); speak(t("play"));
  T.check("a known text is played from its recording", played.length === 1 && played[0] === `voice/en/${voiceKey(t("play"))}.ogg` && said.length === 0, JSON.stringify({ played, said }));

  reset(); speak("Zebra crossing quokka");
  T.check("an unknown text uses the computer's voice", played.length === 0 && said[0] === "Zebra crossing quokka", JSON.stringify({ played, said }));

  // The child's name is never spoken (owner's feedback: the computer's voice for just the name sounded odd). A line
  // with the name is played whole, from the recording made with the neutral word ("superstar") in its place.
  reset(); speak("Hi Mia! Let's play!");
  T.check("a line with the name is played from one recording with the neutral word", played.length === 1
    && played[0] === `voice/en/${voiceKey("Hi " + t("friend") + "! Let's play!")}.ogg` && said.length === 0, JSON.stringify({ played, said }));
  reset(); speak("Mia");
  T.check("the name alone is never said by the computer's voice", !said.includes("Mia") && !played.some((p) => p.includes(voiceKey("Mia"))), JSON.stringify({ played, said }));
  T.check("a name inside another word stays as it is", withoutName("Miami") === "Miami" && withoutName("mia!") === t("friend") + "!");
  reset(); muted = true; speak(t("play"));
  T.check("muted: nothing is said", played.length === 0 && said.length === 0);
  muted = false;

  reset(); speak(t("play")); setScreen("x", el("div", {}, "x"));
  T.check("a new screen stops the old recording (nothing follows it)", played.length === 1 && said.length === 0);

  // Owner's bug report: after a typed sentence the round must wait until the whole sentence has been read aloud.
  // (later() waits for Keybo in every world; the typing round is the case that was seen.)
  reset(); let finished = false;
  typingRound({ screen: "t", icon: "", text: "", items: [{ text: "A", speak: t("play") }], onDone: () => { finished = true; } });
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA" }));
  await T.wait(2500);
  T.check("a typing round waits while the sentence is still being read", played.length === 1 && !finished, JSON.stringify({ played, finished }));
  finishPlaying(); await T.wait(600);
  T.check("and moves on once it has been read", finished);

  // The same holds for every world: a timed step waits for Keybo, but runs at once when Keybo is quiet.
  reset(); setScreen("x", el("div", {}, "x")); let stepped = 0;
  speak(t("play")); later(() => stepped++, 100); await T.wait(700);
  T.check("a timed step waits while Keybo is talking", stepped === 0);
  finishPlaying(); await T.wait(600);
  T.check("and runs once Keybo has finished", stepped === 1);
  later(() => stepped++, 100); await T.wait(250);
  T.check("with Keybo quiet it runs on time", stepped === 2);

  reset(); settings.language = "de"; speak(t("play"));
  T.check("a language without recordings uses the computer's voice", played.length === 0, JSON.stringify(played));
});
