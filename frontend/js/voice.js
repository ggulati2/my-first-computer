// Keybo's own recorded voice.
//
// The voices that come with Mac, Windows and Chrome often sound robotic. So the app carries recordings of every
// sentence it can say (made with scripts/make_voice.py, kept in frontend/voice/<language>/). speak() in app.js asks
// this file first; whatever has no recording (the child's own name, a line written by the online helper, an unusual
// word typed in Free Play) is still said by the computer's voice, exactly as before.
//
// A recording is found by its text: tidy the text, turn it into a number with cyrb53 below, and the file is
// named after that number. index.json (one small file per language) lists which numbers exist.

const voice = { lang: null, clips: new Set(), templates: [], audio: null, token: 0 };

// A small, fast text hash (public domain, by bryc). scripts/make_voice.py has the same one; tests/test_voice.py
// checks that both give the same number.
function cyrb53(text) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
// Soft hyphens (\u00AD, where a long German world name may break on the map) are invisible and never spoken.
const voiceKey = (text) => cyrb53(text.replace(/\u00AD/g, "").split(/\s+/).filter(Boolean).join(" ").toLowerCase()).toString(36);

// Load the list of recordings for a language (a language without recordings simply has none).
async function loadVoice(lang) {
  voice.lang = lang; voice.clips = new Set();
  try {
    const res = await fetch(`voice/${lang}/index.json`);
    if (!res.ok) return;
    const data = await res.json();
    if (voice.lang === lang) voice.clips = new Set(data.clips);
  } catch (e) { /* no recordings: the computer's voice is used */ }
}

// Silence everything Keybo is saying (the recording and the computer's voice). Anything queued is dropped.
function stopSpeaking() {
  voice.token++;
  if (voice.audio) { voice.audio.pause(); voice.audio = null; }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

// Say `text` with the recordings if there are any. Returns false if this text has none (the caller then uses the
// computer's voice).
function speakRecorded(text) {
  if (voice.lang !== settings.language) return false;
  const clip = voiceKey(text);
  if (!voice.clips.has(clip)) return false;
  stopSpeaking();
  const token = voice.token;
  const serial = screenSerial;
  const useComputerVoice = () => { if (token === voice.token && serial === screenSerial) speakWithSystemVoice(text); };
  const audio = new Audio(`voice/${voice.lang}/${clip}.ogg`);
  voice.audio = audio;
  audio.addEventListener("error", useComputerVoice);
  audio.play().catch(useComputerVoice);                                  // for example the browser does not allow sound yet
  return true;
}
