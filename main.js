import { instruments, instrumentRanges } from "./assets.js";

const STORAGE_KEY = "melody-prototype-settings-v1";
const FADE_OUT_MS = 50;
const MAX_CONSECUTIVE_LEAP_SEMITONES = 12;
const MAX_B_TO_A_LEAP_SEMITONES = 2;
const MAX_E_TO_AB_LEAP_SEMITONES = 1;
const MAX_SEQUENCE_RANGE_SEMITONES = 14;
const REPETITION_PROBABILITY_FACTOR = 0.25;

const RHYTHM_LEVEL = 4;
const RHYTHM_GRID_SIZE = 16;
const FIRST_HIT_INDICES = [1, 2, 3];
const JUMP_VALUES = [1, 2, 3, 4, 5];
const TRIPLET_BEAT_START_INDICES = [4, 8, 12];
const AFTER_TRIPLET_VALUES = [0, 1, 2, 3];

const RHYTHM_ENDPOINTS = {
  bpm: [60, 120],
  firstHitWeights: [[0, 10, 0], [10, 5, 10]],
  jumpWeights: [[0, 10, 0, 10, 0], [1, 5, 10, 2, 4]],
  tripletChance: [[0, 0, 0], [0.3, 0.3, 0.3]],
  afterTriplet2Weights: [[10, 0, 0, 0], [10, 0, 0, 0]],
  afterTriplet3Weights: [[10, 0, 0, 0], [10, 0, 0, 0]],
};

const DEFAULT_SETTINGS = {
  primaryTones: "e, g, b",
  secondaryTones: "f#, a, c, d",
  forbiddenTones: "g#, c#",
  ambitusMin: "50",
  ambitusMax: "72",
  instrument: "Piano",
};

const primaryTonesInput = document.querySelector("#primary-tones");
const secondaryTonesInput = document.querySelector("#secondary-tones");
const forbiddenTonesInput = document.querySelector("#forbidden-tones");
const ambitusMinInput = document.querySelector("#ambitus-min");
const ambitusMaxInput = document.querySelector("#ambitus-max");
const instrumentSelect = document.querySelector("#instrument-select");
const generateButton = document.querySelector("#generate-btn");
const replayButton = document.querySelector("#replay-btn");
const statusLabel = document.querySelector("#status");
const resultInstrument = document.querySelector("#result-instrument");
const resultPattern = document.querySelector("#result-pattern");
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
const lerp = (start, end, factor) => start + (end - start) * factor;

const weightedChoice = (values, weights) => {
  const valid = values.map((value, index) => ({ value, weight: Math.max(0, Number(weights[index] ?? 0)) }));
  const total = valid.reduce((sum, entry) => sum + entry.weight, 0);

  if (total <= 0) {
    return values[Math.floor(Math.random() * values.length)];
  }

  let cursor = Math.random() * total;
  for (const entry of valid) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.value;
    }
  }

  return valid[valid.length - 1].value;
};

const shuffled = (values) => {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
};

const shuffledWithRepeatPenalty = (values, previousMidi) => {
  if (previousMidi === null) {
    return shuffled(values);
  }

  return [...values]
    .map((value) => {
      const penalty = value.midi === previousMidi ? REPETITION_PROBABILITY_FACTOR : 1;
      return { value, score: Math.random() / penalty };
    })
    .sort((left, right) => left.score - right.score)
    .map(({ value }) => value);
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
    instrument: instrumentSelect.value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const restoreSettings = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    primaryTonesInput.value = DEFAULT_SETTINGS.primaryTones;
    secondaryTonesInput.value = DEFAULT_SETTINGS.secondaryTones;
    forbiddenTonesInput.value = DEFAULT_SETTINGS.forbiddenTones;
    ambitusMinInput.value = DEFAULT_SETTINGS.ambitusMin;
    ambitusMaxInput.value = DEFAULT_SETTINGS.ambitusMax;
    instrumentSelect.value = DEFAULT_SETTINGS.instrument;
    return;
  }

  try {
    const data = JSON.parse(raw);
    primaryTonesInput.value = data.primaryTones ?? DEFAULT_SETTINGS.primaryTones;
    secondaryTonesInput.value = data.secondaryTones ?? DEFAULT_SETTINGS.secondaryTones;
    forbiddenTonesInput.value = data.forbiddenTones ?? DEFAULT_SETTINGS.forbiddenTones;
    ambitusMinInput.value = data.ambitusMin ?? DEFAULT_SETTINGS.ambitusMin;
    ambitusMaxInput.value = data.ambitusMax ?? DEFAULT_SETTINGS.ambitusMax;
    if (data.instrument && instruments.includes(data.instrument)) {
      instrumentSelect.value = data.instrument;
    } else {
      instrumentSelect.value = DEFAULT_SETTINGS.instrument;
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

  const sanitizedMin = Number.isNaN(minInput) ? 0 : clamp(minInput, 0, 127);
  const sanitizedMax = Number.isNaN(maxInput) ? 127 : clamp(maxInput, 0, 127);

  const minMidi = Math.min(sanitizedMin, sanitizedMax);
  const maxMidi = Math.max(sanitizedMin, sanitizedMax);

  ambitusMinInput.value = String(minMidi);
  ambitusMaxInput.value = String(maxMidi);

  return { minMidi, maxMidi };
};

const getRhythmParamsForLevel = (level) => {
  const clampedLevel = clamp(level, 1, 10);
  const factor = (clampedLevel - 1) / 9;

  const firstHitWeights = RHYTHM_ENDPOINTS.firstHitWeights[0].map((start, index) =>
    lerp(start, RHYTHM_ENDPOINTS.firstHitWeights[1][index], factor)
  );
  const jumpWeights = RHYTHM_ENDPOINTS.jumpWeights[0].map((start, index) =>
    lerp(start, RHYTHM_ENDPOINTS.jumpWeights[1][index], factor)
  );
  const tripletChance = RHYTHM_ENDPOINTS.tripletChance[0].map((start, index) =>
    lerp(start, RHYTHM_ENDPOINTS.tripletChance[1][index], factor)
  );
  const afterTriplet2Weights = RHYTHM_ENDPOINTS.afterTriplet2Weights[0].map((start, index) =>
    lerp(start, RHYTHM_ENDPOINTS.afterTriplet2Weights[1][index], factor)
  );
  const afterTriplet3Weights = RHYTHM_ENDPOINTS.afterTriplet3Weights[0].map((start, index) =>
    lerp(start, RHYTHM_ENDPOINTS.afterTriplet3Weights[1][index], factor)
  );
  afterTriplet3Weights[3] = 0;

  return {
    bpm: Math.round(lerp(RHYTHM_ENDPOINTS.bpm[0], RHYTHM_ENDPOINTS.bpm[1], factor)),
    firstHitWeights,
    jumpWeights,
    tripletChance,
    afterTriplet2Weights,
    afterTriplet3Weights,
  };
};

const applyAfterTripletConstraint = (grid, beatStart, weights) => {
  const nextBeatStart = beatStart + 4;
  if (nextBeatStart > 12) {
    return;
  }

  for (let idx = nextBeatStart; idx < nextBeatStart + 4; idx += 1) {
    grid[idx] = 0;
  }

  const chosenOffset = weightedChoice(AFTER_TRIPLET_VALUES, weights);
  grid[nextBeatStart + chosenOffset] = 1;
};

const createRhythmPattern = (level) => {
  const params = getRhythmParamsForLevel(level);
  const grid = Array(RHYTHM_GRID_SIZE).fill(0);
  const tripletStarts = new Set();

  let position = weightedChoice(FIRST_HIT_INDICES, params.firstHitWeights);
  while (position < 15) {
    grid[position] = 1;
    const jump = weightedChoice(JUMP_VALUES, params.jumpWeights);
    position += jump;
  }

  grid[15] = 0;

  TRIPLET_BEAT_START_INDICES.forEach((beatStart, index) => {
    if (grid[beatStart] !== 1) {
      return;
    }

    if (Math.random() > params.tripletChance[index]) {
      return;
    }

    for (let idx = beatStart; idx < beatStart + 4; idx += 1) {
      grid[idx] = 0;
    }
    grid[beatStart] = 1;
    tripletStarts.add(beatStart);

    if (beatStart === 4) {
      applyAfterTripletConstraint(grid, beatStart, params.afterTriplet2Weights);
    }

    if (beatStart === 8) {
      applyAfterTripletConstraint(grid, beatStart, params.afterTriplet3Weights);
    }
  });

  const noteEvents = [];
  for (let idx = 0; idx < RHYTHM_GRID_SIZE; idx += 1) {
    if (tripletStarts.has(idx)) {
      noteEvents.push({ subdivisionOffset: idx, kind: "triplet" });
      noteEvents.push({ subdivisionOffset: idx + 4 / 3, kind: "triplet" });
      noteEvents.push({ subdivisionOffset: idx + 8 / 3, kind: "triplet" });
      continue;
    }

    if (grid[idx] === 1) {
      noteEvents.push({ subdivisionOffset: idx, kind: "hit" });
    }
  }

  return { grid, tripletStarts, noteEvents, bpm: params.bpm };
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

  const isTransitionAllowed = (
    prevPrevMidi,
    prevMidi,
    prevCategory,
    currentMidi,
    currentCategory
  ) => {
    const leap = Math.abs(currentMidi - prevMidi);
    if (leap > MAX_CONSECUTIVE_LEAP_SEMITONES) {
      return false;
    }

    if (prevPrevMidi !== null) {
      const previousDirection = prevMidi - prevPrevMidi;
      const currentDirection = currentMidi - prevMidi;
      const hasSemitoneMove = Math.abs(previousDirection) === 1;
      const reversedDirection = previousDirection * currentDirection < 0;
      const reverseStepOrTone = Math.abs(currentDirection) <= 2;
      if (hasSemitoneMove && reversedDirection && reverseStepOrTone) {
        return false;
      }
    }

    if (prevCategory === "A") {
      return currentCategory === "A" || currentCategory === "B" || currentCategory === "E";
    }

    if (prevCategory === "B") {
      if (currentCategory === "B") {
        return leap === 0;
      }
      return currentCategory === "A" && leap <= MAX_B_TO_A_LEAP_SEMITONES;
    }

    if (prevCategory === "E") {
      return (currentCategory === "A" || currentCategory === "B") && leap <= MAX_E_TO_AB_LEAP_SEMITONES;
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
  let sequenceMin = Infinity;
  let sequenceMax = -Infinity;

  const search = (index) => {
    if (index === noteCount) {
      const finalCategory = categories[categories.length - 1];
      return finalCategory === "A";
    }

    const prevPrevMidi = index > 1 ? sequence[index - 2] : null;
    const prevMidi = index > 0 ? sequence[index - 1] : null;
    const prevCategory = index > 0 ? categories[index - 1] : null;

    const stateKey = `${index}|${prevMidi ?? "_"}|${prevCategory ?? "_"}|${sequenceMin}|${sequenceMax}`;
    if (failureMemo.has(stateKey)) {
      return false;
    }

    for (const candidate of shuffledWithRepeatPenalty(playable, prevMidi)) {
      const { midi, category } = candidate;

      if (index === 0 && category !== "A" && category !== "B") {
        continue;
      }

      if (index === noteCount - 1 && category !== "A") {
        continue;
      }

      if (index > 0 && !isTransitionAllowed(prevPrevMidi, prevMidi, prevCategory, midi, category)) {
        continue;
      }

      const nextMin = Math.min(sequenceMin, midi);
      const nextMax = Math.max(sequenceMax, midi);
      if (nextMax - nextMin > MAX_SEQUENCE_RANGE_SEMITONES) {
        continue;
      }

      const previousMin = sequenceMin;
      const previousMax = sequenceMax;

      sequence.push(midi);
      categories.push(category);
      sequenceMin = nextMin;
      sequenceMax = nextMax;

      if (search(index + 1)) {
        return true;
      }

      sequence.pop();
      categories.pop();
      sequenceMin = previousMin;
      sequenceMax = previousMax;
    }

    failureMemo.add(stateKey);
    return false;
  };

  if (!search(0)) {
    throw new Error("Impossible de générer une mélodie valide avec ces contraintes.");
  }

  return sequence;
};

let lastGeneratedSequence = null;

const scheduleKick = (context, whenSeconds) => {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(140, whenSeconds);
  oscillator.frequency.exponentialRampToValueAtTime(42, whenSeconds + 0.12);

  gainNode.gain.setValueAtTime(0.0001, whenSeconds);
  gainNode.gain.exponentialRampToValueAtTime(0.8, whenSeconds + 0.005);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, whenSeconds + 0.14);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(whenSeconds);
  oscillator.stop(whenSeconds + 0.16);
};

const scheduleHiHat = (context, whenSeconds) => {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const highPass = context.createBiquadFilter();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(7800, whenSeconds);

  highPass.type = "highpass";
  highPass.frequency.setValueAtTime(6500, whenSeconds);
  highPass.Q.setValueAtTime(0.8, whenSeconds);

  gainNode.gain.setValueAtTime(0.0001, whenSeconds);
  gainNode.gain.exponentialRampToValueAtTime(0.22, whenSeconds + 0.002);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, whenSeconds + 0.055);

  oscillator.connect(highPass);
  highPass.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(whenSeconds);
  oscillator.stop(whenSeconds + 0.06);
};

const playSequence = async (instrument, midiSequence, rhythm) => {
  const context = await ensureAudioContext();
  const buffers = await Promise.all(midiSequence.map((midi) => loadSampleBuffer(instrument, midi, context)));

  const subdivDur = (60 / rhythm.bpm) / 4;
  const noteDurationSeconds = Math.max(0.11, subdivDur * 0.9);
  const startAt = context.currentTime + 0.03;
  const introSubdivisions = 8;
  const sequenceRepeats = 2;
  const sequenceLengthSubdivisions = RHYTHM_GRID_SIZE;
  const totalSequenceSubdivisions = sequenceLengthSubdivisions * sequenceRepeats;
  const melodyStartAt = startAt + introSubdivisions * subdivDur;

  for (let hitIndex = 0; hitIndex < 4; hitIndex += 1) {
    const hiHatStart = startAt + hitIndex * 2 * subdivDur;
    scheduleHiHat(context, hiHatStart);
  }

  for (let beatIndex = 0; beatIndex < totalSequenceSubdivisions / 4; beatIndex += 1) {
    scheduleKick(context, melodyStartAt + beatIndex * 4 * subdivDur);
  }

  for (let repeatIndex = 0; repeatIndex < sequenceRepeats; repeatIndex += 1) {
    const repeatOffsetSubdivisions = repeatIndex * sequenceLengthSubdivisions;
    buffers.forEach((buffer, index) => {
      const event = rhythm.noteEvents[index];
      const source = context.createBufferSource();
      const gainNode = context.createGain();
      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(context.destination);

      const noteStart = melodyStartAt + (repeatOffsetSubdivisions + event.subdivisionOffset) * subdivDur;
      const fadeStart = noteStart + noteDurationSeconds;
      const noteStop = fadeStart + FADE_OUT_MS / 1000;

      gainNode.gain.setValueAtTime(1, noteStart);
      gainNode.gain.setValueAtTime(1, fadeStart);
      gainNode.gain.linearRampToValueAtTime(0.0001, noteStop);

      source.start(noteStart, 0);
      source.stop(noteStop);
    });
  }
};

const formatPatternForDisplay = (grid, tripletStarts) =>
  grid
    .map((hit, index) => {
      if (tripletStarts.has(index)) {
        return "T";
      }
      return hit === 1 ? "1" : "0";
    })
    .join(" ");

const handleGenerate = async () => {
  generateButton.disabled = true;
  setStatus("Génération…");

  try {
    const instrument = instrumentSelect.value;
    const { minMidi, maxMidi } = parseInputs();
    const toneGroups = createToneGroups();
    const range = instrumentRanges[instrument];

    const playableMin = Math.max(minMidi, range.min);
    const playableMax = Math.min(maxMidi, range.max);

    if (playableMin > playableMax) {
      throw new Error(
        `Aucune note jouable pour ${instrument} dans l’ambitus ${minMidi}-${maxMidi}.`
      );
    }

    const rhythm = createRhythmPattern(RHYTHM_LEVEL);
    const noteCount = rhythm.noteEvents.length;
    const midiSequence = buildMelody(playableMin, playableMax, noteCount, toneGroups);
    const labels = midiSequence.map(midiToLabel);

    resultInstrument.textContent = instrument;
    resultPattern.textContent = formatPatternForDisplay(rhythm.grid, rhythm.tripletStarts);
    resultSequence.textContent = labels.join(", ");

    persistSettings();
    await playSequence(instrument, midiSequence, rhythm);

    lastGeneratedSequence = { instrument, midiSequence, rhythm };
    replayButton.disabled = false;

    setStatus(`Séquence générée (${noteCount} notes / hits, ${rhythm.bpm} BPM).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    setStatus(message, true);
  } finally {
    generateButton.disabled = false;
  }
};

const handleReplay = async () => {
  if (!lastGeneratedSequence) {
    setStatus("Aucune séquence à rejouer.", true);
    return;
  }

  replayButton.disabled = true;
  generateButton.disabled = true;
  setStatus("Replay de la dernière séquence…");

  try {
    await playSequence(
      lastGeneratedSequence.instrument,
      lastGeneratedSequence.midiSequence,
      lastGeneratedSequence.rhythm
    );
    setStatus("Dernière séquence rejouée.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    setStatus(message, true);
  } finally {
    replayButton.disabled = false;
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
  instrumentSelect,
].forEach((element) => {
  element.addEventListener("input", persistSettings);
  element.addEventListener("change", persistSettings);
});

generateButton.addEventListener("click", handleGenerate);
replayButton.addEventListener("click", handleReplay);
