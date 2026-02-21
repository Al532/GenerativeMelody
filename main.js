import { instruments } from "./assets.js";

const STORAGE_KEY = "melody-prototype-settings-v2";
const RHYTHM_PRESETS_KEY = "melody-prototype-rhythm-presets-v1";
const MAX_CONSECUTIVE_LEAP_SEMITONES = 12;
const FORBIDDEN_DESCENDING_LEAP_SEMITONES = new Set([-10]);
const FORBIDDEN_BIDIRECTIONAL_LEAP_SEMITONES = new Set([11]);
const MAX_B_TO_A_LEAP_SEMITONES = 2;
const MAX_E_TO_AB_LEAP_SEMITONES = 1;
const MAX_SEQUENCE_RANGE_SEMITONES = 14;
const DEFAULT_REPETITION_PROBABILITY_FACTOR = 0.25;
const BACKING_TRACK_URL = "music.mp3";
const BACKING_TRACK_OFFSET_SECONDS = 0.92;

const RHYTHM_GRID_SIZE = 16;
const JUMP_VALUES = [1, 2, 3, 4, 5];
const TRIPLET_BEAT_START_INDICES = [4, 8, 12];
const AFTER_TRIPLET_VALUES = [0, 1, 2, 3];

const DEFAULT_RHYTHM_SETTINGS = {
  bpm: 92,
  jumpOddWeights: [3, 6, 8, 3, 2],
  jumpEvenWeights: [2, 4, 7, 5, 2],
  tripletChance: [3, 3, 3],
  afterTripletWeights: [10, 0, 0, 0],
  repetitionProbabilityFactor: DEFAULT_REPETITION_PROBABILITY_FACTOR,
};

const DEFAULT_SETTINGS = {
  primaryTones: "e, g, b",
  secondaryTones: "f#, a, c, d",
  forbiddenTones: "g#, c#",
  ambitusMin: "50",
  ambitusMax: "72",
  instrument: "Piano",
  ornaments: {
    long: false,
    vibrato: false,
    bend: false,
    fall: false,
    portamento: false,
  },
};

const primaryTonesInput = document.querySelector("#primary-tones");
const secondaryTonesInput = document.querySelector("#secondary-tones");
const forbiddenTonesInput = document.querySelector("#forbidden-tones");
const ambitusMinInput = document.querySelector("#ambitus-min");
const ambitusMaxInput = document.querySelector("#ambitus-max");
const instrumentSelect = document.querySelector("#instrument-select");
const bpmSlider = document.querySelector("#bpm-slider");
const bpmValue = document.querySelector("#bpm-value");
const repetitionPenaltySlider = document.querySelector("#repetition-penalty-slider");
const repetitionPenaltyValue = document.querySelector("#repetition-penalty-value");
const jumpSlidersContainer = document.querySelector("#jump-sliders");
const tripletSlidersContainer = document.querySelector("#triplet-sliders");
const afterTripletSlidersContainer = document.querySelector("#after-triplet-sliders");
const presetNameInput = document.querySelector("#preset-name");
const presetSelect = document.querySelector("#preset-select");
const savePresetButton = document.querySelector("#save-preset-btn");
const loadPresetButton = document.querySelector("#load-preset-btn");
const deletePresetButton = document.querySelector("#delete-preset-btn");
const exportPresetValuesButton = document.querySelector("#export-preset-values-btn");
const importPresetValuesButton = document.querySelector("#import-preset-values-btn");
const importPresetValuesFileInput = document.querySelector("#import-preset-values-file");
const ornamentLongInput = document.querySelector("#ornament-long");
const ornamentVibratoInput = document.querySelector("#ornament-vibrato");
const ornamentBendInput = document.querySelector("#ornament-bend");
const ornamentFallInput = document.querySelector("#ornament-fall");
const ornamentPortamentoInput = document.querySelector("#ornament-portamento");
const generateButton = document.querySelector("#generate-btn");
const replayButton = document.querySelector("#replay-btn");
const statusLabel = document.querySelector("#status");
const resultInstrument = document.querySelector("#result-instrument");
const resultPattern = document.querySelector("#result-pattern");
const resultSequence = document.querySelector("#result-sequence");

let ornaments = structuredClone(DEFAULT_SETTINGS.ornaments);
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

const JUMP_KEYS = [
  { key: "jump1", label: "Jump +1" },
  { key: "jump2", label: "Jump +2" },
  { key: "jump3", label: "Jump +3" },
  { key: "jump4", label: "Jump +4" },
  { key: "jump5", label: "Jump +5" },
];

const TRIPLET_KEYS = [
  { key: "triplet2", label: "Triolet temps 2" },
  { key: "triplet3", label: "Triolet temps 3" },
  { key: "triplet4", label: "Triolet temps 4" },
];

const AFTER_TRIPLET_KEYS = [
  { key: "after0", label: "Temps suivant: subdivision 1" },
  { key: "after1", label: "Temps suivant: subdivision 2" },
  { key: "after2", label: "Temps suivant: subdivision 3" },
  { key: "after3", label: "Temps suivant: subdivision 4" },
];

const sliderBindings = new Map();
let rhythmSettings = structuredClone(DEFAULT_RHYTHM_SETTINGS);

// IMPORTANT: toute nouvelle valeur ajoutée dans l’interface doit aussi être ajoutée
// aux presets (sanitize/save/load) en conservant la compatibilité avec les presets existants.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const centsToRatio = (cents) => 2 ** (cents / 1200);

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

const shuffledWithRepeatPenalty = (values, previousMidi, repetitionProbabilityFactor) => {
  if (previousMidi === null) {
    return shuffled(values);
  }

  return [...values]
    .map((value) => {
      const penalty = value.midi === previousMidi ? repetitionProbabilityFactor : 1;
      const score = penalty <= 0 ? Number.POSITIVE_INFINITY : Math.random() / penalty;
      return { value, score };
    })
    .sort((left, right) => left.score - right.score)
    .map(({ value }) => value);
};

const midiToLabel = (midi) => {
  const chroma = NOTE_LABELS[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${chroma}${octave}`;
};

const midiToHz = (midi) => Number(Tone.Frequency(midi, "midi").toFrequency());

const sanitizeOrnaments = (source) => ({
  long: Boolean(source?.long),
  vibrato: Boolean(source?.vibrato),
  bend: Boolean(source?.bend),
  fall: Boolean(source?.fall),
  portamento: Boolean(source?.portamento),
});

const applyOrnamentsToInputs = () => {
  ornamentLongInput.checked = ornaments.long;
  ornamentVibratoInput.checked = ornaments.vibrato;
  ornamentBendInput.checked = ornaments.bend;
  ornamentFallInput.checked = ornaments.fall;
  ornamentPortamentoInput.checked = ornaments.portamento;
};

const syncOrnamentsFromInputs = () => {
  ornaments = {
    long: ornamentLongInput.checked,
    vibrato: ornamentVibratoInput.checked,
    bend: ornamentBendInput.checked,
    fall: ornamentFallInput.checked,
    portamento: ornamentPortamentoInput.checked,
  };
};

const createSliderRow = (container, key, label) => {
  const row = document.createElement("div");
  row.className = "slider-row";

  const sliderLabel = document.createElement("span");
  sliderLabel.className = "slider-label";
  sliderLabel.textContent = label;

  const wrap = document.createElement("div");
  wrap.className = "slider-input-wrap";

  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "10";
  input.step = "1";

  const value = document.createElement("span");
  value.className = "slider-value";

  wrap.append(input, value);
  row.append(sliderLabel, wrap);
  container.append(row);

  sliderBindings.set(key, { input, value });
  input.addEventListener("input", () => {
    value.textContent = input.value;
    syncRhythmSettingsFromSliders();
    persistSettings();
  });
};

const initializeRhythmSliders = () => {
  jumpSlidersContainer.innerHTML = "";
  const labelHead = document.createElement("div");
  labelHead.className = "rhythm-head";
  labelHead.textContent = "Type de jump";
  const oddHead = document.createElement("div");
  oddHead.className = "rhythm-head";
  oddHead.textContent = "Impair";
  const evenHead = document.createElement("div");
  evenHead.className = "rhythm-head";
  evenHead.textContent = "Pair";
  jumpSlidersContainer.append(labelHead, oddHead, evenHead);

  JUMP_KEYS.forEach(({ key, label }) => {
    const jumpLabel = document.createElement("span");
    jumpLabel.className = "slider-label";
    jumpLabel.textContent = label;

    const oddWrap = document.createElement("div");
    oddWrap.className = "slider-input-wrap";
    const oddInput = document.createElement("input");
    oddInput.type = "range";
    oddInput.min = "0";
    oddInput.max = "10";
    oddInput.step = "1";
    const oddValue = document.createElement("span");
    oddValue.className = "slider-value";
    oddWrap.append(oddInput, oddValue);

    const evenWrap = document.createElement("div");
    evenWrap.className = "slider-input-wrap";
    const evenInput = document.createElement("input");
    evenInput.type = "range";
    evenInput.min = "0";
    evenInput.max = "10";
    evenInput.step = "1";
    const evenValue = document.createElement("span");
    evenValue.className = "slider-value";
    evenWrap.append(evenInput, evenValue);

    jumpSlidersContainer.append(jumpLabel, oddWrap, evenWrap);

    sliderBindings.set(`odd-${key}`, { input: oddInput, value: oddValue });
    sliderBindings.set(`even-${key}`, { input: evenInput, value: evenValue });

    [oddInput, evenInput].forEach((input) =>
      input.addEventListener("input", () => {
        oddValue.textContent = oddInput.value;
        evenValue.textContent = evenInput.value;
        syncRhythmSettingsFromSliders();
        persistSettings();
      })
    );
  });

  TRIPLET_KEYS.forEach(({ key, label }) => createSliderRow(tripletSlidersContainer, key, label));
  AFTER_TRIPLET_KEYS.forEach(({ key, label }) =>
    createSliderRow(afterTripletSlidersContainer, `after-${key}`, label)
  );
};

const sanitizeWeightArray = (values, length) =>
  Array.from({ length }, (_, index) => clamp(Number(values?.[index] ?? 0), 0, 10));

const sanitizeRhythmSettings = (source) => ({
  bpm: clamp(Number(source?.bpm ?? DEFAULT_RHYTHM_SETTINGS.bpm), 30, 140),
  jumpOddWeights: sanitizeWeightArray(source?.jumpOddWeights, 5),
  jumpEvenWeights: sanitizeWeightArray(source?.jumpEvenWeights, 5),
  tripletChance: sanitizeWeightArray(source?.tripletChance, 3),
  afterTripletWeights: sanitizeWeightArray(source?.afterTripletWeights ?? source?.afterTriplet2Weights, 4),
  repetitionProbabilityFactor: clamp(
    Number(source?.repetitionProbabilityFactor ?? DEFAULT_REPETITION_PROBABILITY_FACTOR),
    0,
    1
  ),
});

const sanitizeRhythmPreset = (source) => ({
  jumpOddWeights: sanitizeWeightArray(source?.jumpOddWeights, 5),
  jumpEvenWeights: sanitizeWeightArray(source?.jumpEvenWeights, 5),
  tripletChance: sanitizeWeightArray(source?.tripletChance, 3),
  afterTripletWeights: sanitizeWeightArray(source?.afterTripletWeights ?? source?.afterTriplet2Weights, 4),
  repetitionProbabilityFactor: clamp(
    Number(source?.repetitionProbabilityFactor ?? DEFAULT_REPETITION_PROBABILITY_FACTOR),
    0,
    1
  ),
});

const applyRhythmSettingsToSliders = () => {
  bpmSlider.value = String(rhythmSettings.bpm);
  bpmValue.textContent = String(rhythmSettings.bpm);

  JUMP_KEYS.forEach(({ key }, index) => {
    const oddBinding = sliderBindings.get(`odd-${key}`);
    const evenBinding = sliderBindings.get(`even-${key}`);
    oddBinding.input.value = String(rhythmSettings.jumpOddWeights[index]);
    oddBinding.value.textContent = String(rhythmSettings.jumpOddWeights[index]);
    evenBinding.input.value = String(rhythmSettings.jumpEvenWeights[index]);
    evenBinding.value.textContent = String(rhythmSettings.jumpEvenWeights[index]);
  });

  TRIPLET_KEYS.forEach(({ key }, index) => {
    const binding = sliderBindings.get(key);
    binding.input.value = String(rhythmSettings.tripletChance[index]);
    binding.value.textContent = String(rhythmSettings.tripletChance[index]);
  });

  AFTER_TRIPLET_KEYS.forEach(({ key }, index) => {
    const binding = sliderBindings.get(`after-${key}`);
    binding.input.value = String(rhythmSettings.afterTripletWeights[index]);
    binding.value.textContent = String(rhythmSettings.afterTripletWeights[index]);
  });

  repetitionPenaltySlider.value = String(rhythmSettings.repetitionProbabilityFactor);
  repetitionPenaltyValue.textContent = rhythmSettings.repetitionProbabilityFactor.toFixed(2);
};

const syncRhythmSettingsFromSliders = () => {
  rhythmSettings.bpm = Number(bpmSlider.value);
  rhythmSettings.jumpOddWeights = JUMP_KEYS.map(({ key }) => Number(sliderBindings.get(`odd-${key}`).input.value));
  rhythmSettings.jumpEvenWeights = JUMP_KEYS.map(({ key }) =>
    Number(sliderBindings.get(`even-${key}`).input.value)
  );
  rhythmSettings.tripletChance = TRIPLET_KEYS.map(({ key }) => Number(sliderBindings.get(key).input.value));
  rhythmSettings.afterTripletWeights = AFTER_TRIPLET_KEYS.map(({ key }) =>
    Number(sliderBindings.get(`after-${key}`).input.value)
  );
  rhythmSettings.repetitionProbabilityFactor = Number(repetitionPenaltySlider.value);
};

const setStatus = (message, isError = false) => {
  statusLabel.textContent = message;
  statusLabel.classList.toggle("error", isError);
};

const persistSettings = () => {
  syncOrnamentsFromInputs();
  const data = {
    primaryTones: primaryTonesInput.value,
    secondaryTones: secondaryTonesInput.value,
    forbiddenTones: forbiddenTonesInput.value,
    ambitusMin: ambitusMinInput.value,
    ambitusMax: ambitusMaxInput.value,
    instrument: instrumentSelect.value,
    rhythmSettings,
    ornaments,
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
    rhythmSettings = structuredClone(DEFAULT_RHYTHM_SETTINGS);
    ornaments = structuredClone(DEFAULT_SETTINGS.ornaments);
    applyRhythmSettingsToSliders();
    applyOrnamentsToInputs();
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
    rhythmSettings = sanitizeRhythmSettings(data.rhythmSettings ?? DEFAULT_RHYTHM_SETTINGS);
    ornaments = sanitizeOrnaments(data.ornaments ?? DEFAULT_SETTINGS.ornaments);
    applyRhythmSettingsToSliders();
    applyOrnamentsToInputs();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    rhythmSettings = structuredClone(DEFAULT_RHYTHM_SETTINGS);
    ornaments = structuredClone(DEFAULT_SETTINGS.ornaments);
    applyRhythmSettingsToSliders();
    applyOrnamentsToInputs();
  }
};

const getRhythmPresets = () => {
  const raw = localStorage.getItem(RHYTHM_PRESETS_KEY);
  if (!raw) {
    return {};
  }

  try {
    const data = JSON.parse(raw);
    return typeof data === "object" && data ? data : {};
  } catch {
    localStorage.removeItem(RHYTHM_PRESETS_KEY);
    return {};
  }
};

const saveRhythmPresets = (presets) => {
  localStorage.setItem(RHYTHM_PRESETS_KEY, JSON.stringify(presets));
};

const refreshPresetSelect = () => {
  const presets = getRhythmPresets();
  const names = Object.keys(presets).sort((a, b) => a.localeCompare(b, "fr"));

  presetSelect.innerHTML = '<option value="">Preset…</option>';
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    presetSelect.append(option);
  });
};

const populateInstrumentSelect = () => {
  const options = instruments
    .map((instrument) => `<option value="${instrument}">${instrument}</option>`)
    .join("");
  instrumentSelect.innerHTML = options;
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

const isOddSubdivision = (index) => {
  const modulo = index % 4;
  return modulo === 0 || modulo === 2;
};

const createRhythmPattern = (settings) => {
  const params = sanitizeRhythmSettings(settings);
  const grid = Array(RHYTHM_GRID_SIZE).fill(0);
  const tripletStarts = new Set();

  let position = weightedChoice(JUMP_VALUES, params.jumpOddWeights);
  while (position < 15) {
    grid[position] = 1;
    const jumpWeights = isOddSubdivision(position) ? params.jumpOddWeights : params.jumpEvenWeights;
    const jump = weightedChoice(JUMP_VALUES, jumpWeights);
    position += jump;
  }

  grid[15] = 0;

  TRIPLET_BEAT_START_INDICES.forEach((beatStart, index) => {
    if (grid[beatStart] !== 1) {
      return;
    }

    const chance = params.tripletChance[index] / 10;
    if (Math.random() > chance) {
      return;
    }

    for (let idx = beatStart; idx < beatStart + 4; idx += 1) {
      grid[idx] = 0;
    }
    grid[beatStart] = 1;
    tripletStarts.add(beatStart);

    if (beatStart === 4 || beatStart === 8) {
      applyAfterTripletConstraint(grid, beatStart, params.afterTripletWeights);
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

const buildMelody = (minMidi, maxMidi, noteCount, toneGroups, repetitionProbabilityFactor) => {
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
    const movement = currentMidi - prevMidi;
    const leap = Math.abs(movement);
    if (leap > MAX_CONSECUTIVE_LEAP_SEMITONES) {
      return false;
    }

    if (
      FORBIDDEN_BIDIRECTIONAL_LEAP_SEMITONES.has(leap) ||
      FORBIDDEN_DESCENDING_LEAP_SEMITONES.has(movement)
    ) {
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

    for (const candidate of shuffledWithRepeatPenalty(playable, prevMidi, repetitionProbabilityFactor)) {
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
let backingTrackPlayerPromise = null;

const getBackingTrackPlayer = async () => {
  if (!backingTrackPlayerPromise) {
    backingTrackPlayerPromise = (async () => {
      const player = new Tone.Player({
        url: BACKING_TRACK_URL,
      }).toDestination();
      await Tone.loaded();
      return player;
    })();
  }

  return backingTrackPlayerPromise;
};

const scheduleDrumsWithTone = (startAt, rhythm, totalSubdivisions, introSubdivisions = 0) => {
  const subdivDur = (60 / rhythm.bpm) / 4;
  const introDuration = introSubdivisions * subdivDur;
  const hiHat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: {
      attack: 0.001,
      decay: 0.05,
      sustain: 0,
      release: 0.02,
    },
  }).toDestination();
  const hiHatFilter = new Tone.Filter(9800, "bandpass").toDestination();
  hiHat.disconnect();
  hiHat.connect(hiHatFilter);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.045,
    octaves: 4,
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.001,
      decay: 0.22,
      sustain: 0,
      release: 0.02,
    },
  }).toDestination();

  for (let hitIndex = 0; hitIndex < 4; hitIndex += 1) {
    const hiHatStart = startAt + hitIndex * 2 * subdivDur;
    hiHat.triggerAttackRelease("32n", hiHatStart, 0.32);
  }

  const totalBeats = totalSubdivisions / 4;
  for (let beatIndex = 0; beatIndex < totalBeats; beatIndex += 1) {
    kick.triggerAttackRelease("C1", "8n", startAt + introDuration + beatIndex * 4 * subdivDur, 0.85);
  }

  return { hiHat, hiHatFilter, kick };
};

const createPlayableTimeline = (midiSequence, rhythm, activeOrnaments) => {
  const subdivDur = (60 / rhythm.bpm) / 4;
  return midiSequence.map((midi, index) => {
    const event = rhythm.noteEvents[index];
    const nextEvent = rhythm.noteEvents[index + 1] ?? null;
    const nextMidi = midiSequence[index + 1] ?? null;
    const start = event.subdivisionOffset * subdivDur;

    let duration = subdivDur;
    if (activeOrnaments.long) {
      duration = nextEvent
        ? Math.max(0.06, (nextEvent.subdivisionOffset - event.subdivisionOffset) * subdivDur)
        : 2 * subdivDur;
    }

    return {
      midi,
      nextMidi,
      start,
      duration,
    };
  });
};

const scheduleToneNote = (synth, timelineItem, activeOrnaments) => {
  const { midi, nextMidi, start, duration } = timelineItem;
  const baseFreq = midiToHz(midi);
  const end = start + duration;

  synth.frequency.setValueAtTime(baseFreq, start);

  if (activeOrnaments.bend) {
    synth.frequency.setValueAtTime(baseFreq * centsToRatio(-100), start);
    synth.frequency.linearRampToValueAtTime(baseFreq, start + duration / 2);
  }

  if (activeOrnaments.portamento && nextMidi !== null) {
    const glideStart = Math.max(start, end - 0.15);
    synth.frequency.setValueAtTime(baseFreq, glideStart);
    synth.frequency.linearRampToValueAtTime(midiToHz(nextMidi), end);
  } else if (activeOrnaments.fall) {
    const fallStart = Math.max(start, end - 0.15);
    synth.frequency.setValueAtTime(baseFreq, fallStart);
    synth.frequency.linearRampToValueAtTime(baseFreq / 2, end);
  }

  if (activeOrnaments.vibrato) {
    const vibratoDelay = 0.15;
    const vibratoStart = Math.min(start + vibratoDelay, end);
    const vibratoDepth = baseFreq * (centsToRatio(50) - 1);
    const vibratoLfo = new Tone.Oscillator(8, "sine").start(vibratoStart);
    const vibratoGain = new Tone.Gain(vibratoDepth).connect(synth.frequency);
    vibratoLfo.connect(vibratoGain);
    vibratoLfo.stop(end);
  }

  synth.triggerAttackRelease(baseFreq, duration, start, 0.8);
};

const playSequenceWithTone = async (midiSequence, rhythm, activeOrnaments) => {
  await Tone.start();
  const startAt = Tone.now() + 0.05;
  const introSubdivisions = 8;
  const sequenceRepeats = 2;
  const sequenceLengthSubdivisions = RHYTHM_GRID_SIZE;
  const totalSequenceSubdivisions = sequenceLengthSubdivisions * sequenceRepeats;
  const melodyStartAt = startAt + introSubdivisions * (60 / rhythm.bpm) / 4;
  const backingTrackStartAt = Math.max(startAt, melodyStartAt - BACKING_TRACK_OFFSET_SECONDS);

  const synth = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    filter: {
      type: "allpass",
      frequency: 20000,
      Q: 0,
    },
    filterEnvelope: {
      baseFrequency: 20000,
      octaves: 0,
    },
    envelope: {
      attack: 0.005,
      decay: 0.04,
      sustain: 0.85,
      release: 0.08,
    },
  }).toDestination();

  const timeline = createPlayableTimeline(midiSequence, rhythm, activeOrnaments);
  const backingTrackPlayer = await getBackingTrackPlayer();
  backingTrackPlayer.stop(startAt);
  backingTrackPlayer.start(backingTrackStartAt);
  const drumNodes = scheduleDrumsWithTone(startAt, rhythm, totalSequenceSubdivisions, introSubdivisions);
  for (let repeatIndex = 0; repeatIndex < sequenceRepeats; repeatIndex += 1) {
    const repeatOffset = (repeatIndex * sequenceLengthSubdivisions * 60) / (rhythm.bpm * 4);
    timeline.forEach((item) => {
      scheduleToneNote(
        synth,
        { ...item, start: melodyStartAt + repeatOffset + item.start },
        activeOrnaments
      );
    });
  }

  const totalDuration =
    introSubdivisions * (60 / rhythm.bpm) / 4 +
    totalSequenceSubdivisions * (60 / rhythm.bpm) / 4 +
    0.3;
  window.setTimeout(() => {
    backingTrackPlayer.stop();
    synth.dispose();
    drumNodes.hiHat.dispose();
    drumNodes.hiHatFilter.dispose();
    drumNodes.kick.dispose();
  }, totalDuration * 1000);
};

const handleExportPresetValues = () => {
  syncRhythmSettingsFromSliders();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    rhythmSettings: sanitizeRhythmPreset(rhythmSettings),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `preset-probas-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Export des probas terminé.");
};

const handleImportPresetValuesClick = () => {
  importPresetValuesFileInput.value = "";
  importPresetValuesFileInput.click();
};

const handleImportPresetValuesFile = async (event) => {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  try {
    const data = JSON.parse(await file.text());
    rhythmSettings = {
      ...rhythmSettings,
      ...sanitizeRhythmPreset(data?.rhythmSettings ?? data),
    };
    applyRhythmSettingsToSliders();
    persistSettings();
    setStatus("Import des probas terminé.");
  } catch {
    setStatus("Fichier JSON invalide pour l'import des probas.", true);
  }
};

const formatPatternForDisplay = (grid, tripletStarts) => {
  const beats = [];

  for (let beat = 0; beat < 4; beat += 1) {
    const beatStart = beat * 4;
    if (tripletStarts.has(beatStart)) {
      beats.push("T");
      continue;
    }

    let beatText = "";
    for (let idx = beatStart; idx < beatStart + 4; idx += 1) {
      beatText += grid[idx] === 1 ? "!" : "'";
    }
    beats.push(beatText);
  }

  return beats.join(" ");
};

const handleSavePreset = () => {
  const name = presetNameInput.value.trim();
  if (!name) {
    setStatus("Donnez un nom de preset.", true);
    return;
  }

  syncRhythmSettingsFromSliders();
  const presets = getRhythmPresets();
  presets[name] = sanitizeRhythmPreset(rhythmSettings);
  saveRhythmPresets(presets);
  refreshPresetSelect();
  presetSelect.value = name;
  setStatus(`Preset "${name}" sauvegardé.`);
};

const handleLoadPreset = () => {
  const name = presetSelect.value;
  if (!name) {
    setStatus("Choisissez un preset à charger.", true);
    return;
  }

  const presets = getRhythmPresets();
  const selected = presets[name];
  if (!selected) {
    setStatus("Preset introuvable.", true);
    refreshPresetSelect();
    return;
  }

  rhythmSettings = {
    ...rhythmSettings,
    ...sanitizeRhythmPreset(selected),
  };
  applyRhythmSettingsToSliders();
  presetNameInput.value = name;
  persistSettings();
  setStatus(`Preset "${name}" chargé.`);
};

const handleDeletePreset = () => {
  const name = presetSelect.value;
  if (!name) {
    setStatus("Choisissez un preset à effacer.", true);
    return;
  }

  const presets = getRhythmPresets();
  if (!presets[name]) {
    setStatus("Preset introuvable.", true);
    refreshPresetSelect();
    return;
  }

  delete presets[name];
  saveRhythmPresets(presets);
  refreshPresetSelect();
  setStatus(`Preset "${name}" effacé.`);
};

const handleGenerate = async () => {
  generateButton.disabled = true;
  setStatus("Génération…");

  try {
    const { minMidi, maxMidi } = parseInputs();
    const toneGroups = createToneGroups();
    syncRhythmSettingsFromSliders();
    syncOrnamentsFromInputs();
    const rhythm = createRhythmPattern(rhythmSettings);
    const noteCount = rhythm.noteEvents.length;
    const midiSequence = buildMelody(
      minMidi,
      maxMidi,
      noteCount,
      toneGroups,
      rhythmSettings.repetitionProbabilityFactor
    );
    const labels = midiSequence.map(midiToLabel);

    resultInstrument.textContent = "Sawtooth (Tone.js)";
    resultPattern.textContent = formatPatternForDisplay(rhythm.grid, rhythm.tripletStarts);
    resultSequence.textContent = labels.join(", ");

    persistSettings();
    await playSequenceWithTone(midiSequence, rhythm, ornaments);

    lastGeneratedSequence = { midiSequence, rhythm };
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
    syncOrnamentsFromInputs();
    await playSequenceWithTone(
      lastGeneratedSequence.midiSequence,
      lastGeneratedSequence.rhythm,
      ornaments
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
initializeRhythmSliders();
restoreSettings();
refreshPresetSelect();
persistSettings();

bpmSlider.addEventListener("input", () => {
  bpmValue.textContent = bpmSlider.value;
  syncRhythmSettingsFromSliders();
  persistSettings();
});

repetitionPenaltySlider.addEventListener("input", () => {
  repetitionPenaltyValue.textContent = Number(repetitionPenaltySlider.value).toFixed(2);
  syncRhythmSettingsFromSliders();
  persistSettings();
});

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

savePresetButton.addEventListener("click", handleSavePreset);
loadPresetButton.addEventListener("click", handleLoadPreset);
deletePresetButton.addEventListener("click", handleDeletePreset);
exportPresetValuesButton.addEventListener("click", handleExportPresetValues);
importPresetValuesButton.addEventListener("click", handleImportPresetValuesClick);
importPresetValuesFileInput.addEventListener("change", handleImportPresetValuesFile);
generateButton.addEventListener("click", handleGenerate);
replayButton.addEventListener("click", handleReplay);

[
  ornamentLongInput,
  ornamentVibratoInput,
  ornamentBendInput,
  ornamentFallInput,
  ornamentPortamentoInput,
].forEach((input) => {
  input.addEventListener("change", () => {
    syncOrnamentsFromInputs();
    persistSettings();
  });
});
