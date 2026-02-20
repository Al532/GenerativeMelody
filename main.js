import { instruments, instrumentRanges } from "./assets.js";

const STORAGE_KEY = "melody-prototype-settings-v1";
const NOTE_DURATION_MS = 250;
const FADE_OUT_MS = 50;

const primaryTonesInput = document.querySelector("#primary-tones");
const secondaryTonesInput = document.querySelector("#secondary-tones");
const forbiddenTonesInput = document.querySelector("#forbidden-tones");
const ambitusMinInput = document.querySelector("#ambitus-min");
const ambitusMaxInput = document.querySelector("#ambitus-max");
const noteCountInput = document.querySelector("#note-count");
const instrumentSelect = document.querySelector("#instrument-select");
const generateButton = document.querySelector("#generate-btn");
const statusLabel = document.querySelector("#status");
const resultInstrument = document.querySelector("#result-instrument");
const resultSequence = document.querySelector("#result-sequence");

const sampleCache = new Map();
const NOTE_LABELS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const TONE_TO_PITCH_CLASS = {
  c: 0,
  "b#": 0,
  "c#": 1,
  db: 1,
  d: 2,
  "d#": 3,
  eb: 3,
  e: 4,
  fb: 4,
  "e#": 5,
  f: 5,
  "f#": 6,
  gb: 6,
  g: 7,
  "g#": 8,
  ab: 8,
  a: 9,
  "a#": 10,
  bb: 10,
  b: 11,
  cb: 11,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const shuffled = (values) => {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
};

const midiToLabel = (midi) => {
  const chroma = NOTE_LABELS[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${chroma}${octave}`;
};

const createAudioContext = () => new (window.AudioContext || window.webkitAudioContext)();
let audioContext = null;

const ensureAudioContext = async () => {
  if (!audioContext) {
    audioContext = createAudioContext();
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return audioContext;
};

const setStatus = (message, isError = false) => {
  statusLabel.textContent = message;
  statusLabel.classList.toggle("error", isError);
};

const persistSettings = () => {
  const data = {
    primaryTones: primaryTonesInput.value,
    secondaryTones: secondaryTonesInput.value,
    forbiddenTones: forbiddenTonesInput.value,
    ambitusMin: ambitusMinInput.value,
    ambitusMax: ambitusMaxInput.value,
    noteCount: noteCountInput.value,
    instrument: instrumentSelect.value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const restoreSettings = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const data = JSON.parse(raw);
    primaryTonesInput.value = data.primaryTones ?? "";
    secondaryTonesInput.value = data.secondaryTones ?? "";
    forbiddenTonesInput.value = data.forbiddenTones ?? "";
    ambitusMinInput.value = data.ambitusMin ?? ambitusMinInput.value;
    ambitusMaxInput.value = data.ambitusMax ?? ambitusMaxInput.value;
    noteCountInput.value = data.noteCount ?? noteCountInput.value;
    if (data.instrument && instruments.includes(data.instrument)) {
      instrumentSelect.value = data.instrument;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
};

const populateInstrumentSelect = () => {
  const options = instruments
    .map((instrument) => `<option value="${instrument}">${instrument}</option>`)
    .join("");
  instrumentSelect.innerHTML = options;
};

const getBufferKey = (instrument, midi) => `${instrument}:${midi}`;

const loadSampleBuffer = async (instrument, midi, context) => {
  const key = getBufferKey(instrument, midi);
  if (sampleCache.has(key)) {
    return sampleCache.get(key);
  }

  const response = await fetch(`assets/MP3/${instrument}/${midi}.mp3`);
  if (!response.ok) {
    throw new Error(`Sample introuvable: ${instrument} ${midi}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await context.decodeAudioData(arrayBuffer);
  sampleCache.set(key, audioBuffer);
  return audioBuffer;
};

const parseToneClasses = (raw, label) => {
  const result = new Set();
  const tokens = raw
    .split(/[\s,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  for (const token of tokens) {
    const normalized = token.replace(/♯/g, "#").replace(/♭/g, "b");
    const pitchClass = TONE_TO_PITCH_CLASS[normalized];
    if (pitchClass === undefined) {
      throw new Error(`Note invalide dans ${label}: "${token}".`);
    }
    result.add(pitchClass);
  }

  return result;
};

const createToneGroups = () => {
  const primary = parseToneClasses(primaryTonesInput.value, "Primary tones");
  const secondary = parseToneClasses(secondaryTonesInput.value, "Secondary tones");
  const forbidden = parseToneClasses(forbiddenTonesInput.value, "Forbidden tones");

  for (const pitchClass of primary) {
    if (secondary.has(pitchClass) || forbidden.has(pitchClass)) {
      throw new Error("Une note ne peut pas être à la fois primary et secondary/forbidden.");
    }
  }

  for (const pitchClass of secondary) {
    if (forbidden.has(pitchClass)) {
      throw new Error("Une note ne peut pas être à la fois secondary et forbidden.");
    }
  }

  return { primary, secondary, forbidden };
};

const parseInputs = () => {
  const minInput = Number.parseInt(ambitusMinInput.value, 10);
  const maxInput = Number.parseInt(ambitusMaxInput.value, 10);
  const countInput = Number.parseInt(noteCountInput.value, 10);

  const sanitizedMin = Number.isNaN(minInput) ? 0 : clamp(minInput, 0, 127);
  const sanitizedMax = Number.isNaN(maxInput) ? 127 : clamp(maxInput, 0, 127);

  const minMidi = Math.min(sanitizedMin, sanitizedMax);
  const maxMidi = Math.max(sanitizedMin, sanitizedMax);
  const noteCount = Number.isNaN(countInput) ? 8 : clamp(countInput, 1, 128);

  ambitusMinInput.value = String(minMidi);
  ambitusMaxInput.value = String(maxMidi);
  noteCountInput.value = String(noteCount);

  return { minMidi, maxMidi, noteCount };
};

const buildMelody = (minMidi, maxMidi, noteCount, toneGroups) => {
  const pitchClassCategory = (midi) => {
    const pitchClass = midi % 12;
    if (toneGroups.primary.has(pitchClass)) {
      return "A";
    }
    if (toneGroups.secondary.has(pitchClass)) {
      return "B";
    }
    if (toneGroups.forbidden.has(pitchClass)) {
      return "C";
    }
    return "E";
  };

  // Règles de génération:
  // - A = primary notes, B = secondary notes, C = forbidden notes, E = toutes les autres notes.
  // - Après A, la note suivante peut être A, B ou E.
  // - Après B, la note suivante doit être A avec un mouvement conjoint (2 demi-tons max),
  //   sauf répétition exacte d'une note B.
  // - Après E, la note suivante doit être A ou B avec un mouvement conjoint serré (1 demi-ton max).
  // - La dernière note doit être A ou B.
  // - Intervalle max entre deux notes consécutives: 12 demi-tons.
  // - Intervalle max entre n et n+2: 14 demi-tons.
  const isTransitionAllowed = (prevMidi, prevCategory, currentMidi, currentCategory) => {
    const leap = Math.abs(currentMidi - prevMidi);
    if (leap > 12) {
      return false;
    }

    if (prevCategory === "A") {
      return currentCategory === "A" || currentCategory === "B" || currentCategory === "E";
    }

    if (prevCategory === "B") {
      if (currentCategory === "B") {
        return leap === 0;
      }
      return currentCategory === "A" && leap <= 2;
    }

    if (prevCategory === "E") {
      return (currentCategory === "A" || currentCategory === "B") && leap <= 1;
    }

    return false;
  };

  const playable = [];
  for (let midi = minMidi; midi <= maxMidi; midi += 1) {
    const category = pitchClassCategory(midi);
    if (category !== "C") {
      playable.push({ midi, category });
    }
  }

  if (playable.length === 0) {
    throw new Error("Aucune note disponible après exclusion des forbidden tones.");
  }

  const failureMemo = new Set();
  const sequence = [];
  const categories = [];

  const search = (index) => {
    if (index === noteCount) {
      const finalCategory = categories[categories.length - 1];
      return finalCategory === "A" || finalCategory === "B";
    }

    const prevMidi = index > 0 ? sequence[index - 1] : null;
    const prevCategory = index > 0 ? categories[index - 1] : null;
    const prev2Midi = index > 1 ? sequence[index - 2] : null;

    const stateKey = `${index}|${prevMidi ?? "_"}|${prevCategory ?? "_"}|${prev2Midi ?? "_"}`;
    if (failureMemo.has(stateKey)) {
      return false;
    }

    for (const candidate of shuffled(playable)) {
      const { midi, category } = candidate;

      if (index === 0 && category !== "A" && category !== "B") {
        continue;
      }

      if (index === noteCount - 1 && category !== "A" && category !== "B") {
        continue;
      }

      if (index > 0 && !isTransitionAllowed(prevMidi, prevCategory, midi, category)) {
        continue;
      }

      if (index > 1 && Math.abs(midi - prev2Midi) > 14) {
        continue;
      }

      sequence.push(midi);
      categories.push(category);

      if (search(index + 1)) {
        return true;
      }

      sequence.pop();
      categories.pop();
    }

    failureMemo.add(stateKey);
    return false;
  };

  if (!search(0)) {
    throw new Error("Impossible de générer une mélodie valide avec ces contraintes.");
  }

  return sequence;
};

const playSequence = async (instrument, midiSequence) => {
  const context = await ensureAudioContext();
  const startAt = context.currentTime + 0.03;

  const buffers = await Promise.all(
    midiSequence.map((midi) => loadSampleBuffer(instrument, midi, context))
  );

  buffers.forEach((buffer, index) => {
    const source = context.createBufferSource();
    const gainNode = context.createGain();
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(context.destination);

    const noteStart = startAt + (index * NOTE_DURATION_MS) / 1000;
    const fadeStart = noteStart + NOTE_DURATION_MS / 1000;
    const noteStop = fadeStart + FADE_OUT_MS / 1000;

    gainNode.gain.setValueAtTime(1, noteStart);
    gainNode.gain.setValueAtTime(1, fadeStart);
    gainNode.gain.linearRampToValueAtTime(0.0001, noteStop);

    source.start(noteStart, 0);
    source.stop(noteStop);
  });
};

const handleGenerate = async () => {
  generateButton.disabled = true;
  setStatus("Génération…");

  try {
    const instrument = instrumentSelect.value;
    const { minMidi, maxMidi, noteCount } = parseInputs();
    const toneGroups = createToneGroups();
    const range = instrumentRanges[instrument];

    const playableMin = Math.max(minMidi, range.min);
    const playableMax = Math.min(maxMidi, range.max);

    if (playableMin > playableMax) {
      throw new Error(
        `Aucune note jouable pour ${instrument} dans l’ambitus ${minMidi}-${maxMidi}.`
      );
    }

    const midiSequence = buildMelody(playableMin, playableMax, noteCount, toneGroups);
    const labels = midiSequence.map(midiToLabel);

    resultInstrument.textContent = instrument;
    resultSequence.textContent = labels.join(", ");

    persistSettings();
    await playSequence(instrument, midiSequence);

    setStatus(`Séquence générée selon les contraintes (${noteCount} notes).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    setStatus(message, true);
  } finally {
    generateButton.disabled = false;
  }
};

populateInstrumentSelect();
restoreSettings();
persistSettings();

[
  primaryTonesInput,
  secondaryTonesInput,
  forbiddenTonesInput,
  ambitusMinInput,
  ambitusMaxInput,
  noteCountInput,
  instrumentSelect,
].forEach((element) => {
  element.addEventListener("input", persistSettings);
  element.addEventListener("change", persistSettings);
});

generateButton.addEventListener("click", handleGenerate);
