import { instruments, instrumentRanges } from "./assets.js";

const STORAGE_KEY = "melody-prototype-settings-v1";
const NOTE_DURATION_MS = 250;
const FADE_OUT_MS = 50;

const primaryTonesInput = document.querySelector("#primary-tones");
const secondaryTonesInput = document.querySelector("#secondary-tones");
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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

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

const generateRandomSequence = (minMidi, maxMidi, noteCount) =>
  Array.from({ length: noteCount }, () => randomInt(minMidi, maxMidi));

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
    const noteEnd = noteStart + NOTE_DURATION_MS / 1000;
    const fadeStart = noteEnd - FADE_OUT_MS / 1000;

    gainNode.gain.setValueAtTime(1, noteStart);
    gainNode.gain.setValueAtTime(1, fadeStart);
    gainNode.gain.linearRampToValueAtTime(0.0001, noteEnd);

    source.start(noteStart, 0);
    source.stop(noteEnd);
  });
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

const handleGenerate = async () => {
  generateButton.disabled = true;
  setStatus("Génération…");

  try {
    const instrument = instrumentSelect.value;
    const { minMidi, maxMidi, noteCount } = parseInputs();
    const range = instrumentRanges[instrument];

    const playableMin = Math.max(minMidi, range.min);
    const playableMax = Math.min(maxMidi, range.max);

    if (playableMin > playableMax) {
      throw new Error(
        `Aucune note jouable pour ${instrument} dans l’ambitus ${minMidi}-${maxMidi}.`
      );
    }

    const midiSequence = generateRandomSequence(playableMin, playableMax, noteCount);
    const labels = midiSequence.map(midiToLabel);

    resultInstrument.textContent = instrument;
    resultSequence.textContent = labels.join(", ");

    persistSettings();
    await playSequence(instrument, midiSequence);

    setStatus(
      `Séquence générée (${noteCount} notes, ${NOTE_DURATION_MS}ms/note, fade out ${FADE_OUT_MS}ms).`
    );
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
  ambitusMinInput,
  ambitusMaxInput,
  noteCountInput,
  instrumentSelect,
].forEach((element) => {
  element.addEventListener("input", persistSettings);
  element.addEventListener("change", persistSettings);
});

generateButton.addEventListener("click", handleGenerate);
