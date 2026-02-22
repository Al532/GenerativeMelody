import { instruments } from "./assets.js";

const STORAGE_KEY = "melody-prototype-settings-v3";
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
};
const DEFAULT_MONOSYNTH_SETTINGS = {
  envelopeAttack: 0.005,
  envelopeDecay: 0.04,
  envelopeSustain: 0.85,
  envelopeRelease: 0.08,
  filterFrequency: 20000,
  filterQ: 0,
  filterEnvelopeBaseFrequency: 20000,
  filterEnvelopeOctaves: 0,
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
const monoEnvelopeAttackInput = document.querySelector("#mono-envelope-attack");
const monoEnvelopeAttackValue = document.querySelector("#mono-envelope-attack-value");
const monoEnvelopeDecayInput = document.querySelector("#mono-envelope-decay");
const monoEnvelopeDecayValue = document.querySelector("#mono-envelope-decay-value");
const monoEnvelopeSustainInput = document.querySelector("#mono-envelope-sustain");
const monoEnvelopeSustainValue = document.querySelector("#mono-envelope-sustain-value");
const monoEnvelopeReleaseInput = document.querySelector("#mono-envelope-release");
const monoEnvelopeReleaseValue = document.querySelector("#mono-envelope-release-value");
const monoFilterFrequencyInput = document.querySelector("#mono-filter-frequency");
const monoFilterFrequencyValue = document.querySelector("#mono-filter-frequency-value");
const monoFilterQInput = document.querySelector("#mono-filter-q");
const monoFilterQValue = document.querySelector("#mono-filter-q-value");
const monoFilterEnvelopeBaseFrequencyInput = document.querySelector("#mono-filter-env-base-frequency");
const monoFilterEnvelopeBaseFrequencyValue = document.querySelector("#mono-filter-env-base-frequency-value");
const monoFilterEnvelopeOctavesInput = document.querySelector("#mono-filter-env-octaves");
const monoFilterEnvelopeOctavesValue = document.querySelector("#mono-filter-env-octaves-value");
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
const ruleLongNoteEInput = document.querySelector("#rule-long-note-e");
const ruleLongNoteBInput = document.querySelector("#rule-long-note-b");
const ruleLongLastPresetMelodiqueInput = document.querySelector("#rule-long-last-preset-melodique");
const ruleNoLongLastPresetSyncopeInput = document.querySelector("#rule-no-long-last-preset-syncope");
const ruleFallLastNoteInput = document.querySelector("#rule-fall-last-note");
const ruleFallInterval3Input = document.querySelector("#rule-fall-interval-3");
const ruleBendFirstIf3Input = document.querySelector("#rule-bend-first-if-3");
const ruleVibratoLongestInput = document.querySelector("#rule-vibrato-longest");
const rulePortamentoBeforeLargestIntervalInput = document.querySelector("#rule-portamento-before-largest-interval");
const generateButton = document.querySelector("#generate-btn");
const replayButton = document.querySelector("#replay-btn");
const statusLabel = document.querySelector("#status");
const resultInstrument = document.querySelector("#result-instrument");
const resultPattern = document.querySelector("#result-pattern");
const resultSequence = document.querySelector("#result-sequence");
const resultVibratoConditions = document.querySelector("#result-vibrato-conditions");

const DEFAULT_ORNAMENT_RULES = {
  longNoteE: false,
  longNoteB: false,
  longLastPresetMelodique: false,
  noLongLastPresetSyncope: false,
  fallLastNote: false,
  fallInterval3: false,
  bendFirstIf3: false,
  vibratoLongest: false,
  portamentoBeforeLargestInterval: false,
};

let ornamentRules = structuredClone(DEFAULT_ORNAMENT_RULES);
let lastLoadedPresetName = null;
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
let monosynthSettings = structuredClone(DEFAULT_MONOSYNTH_SETTINGS);

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

const getPitchClassCategory = (toneGroups, midi) => {
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

const sanitizeOrnamentRules = (source) => ({
  longNoteE: Boolean(source?.longNoteE),
  longNoteB: Boolean(source?.longNoteB),
  longLastPresetMelodique: Boolean(source?.longLastPresetMelodique),
  noLongLastPresetSyncope: Boolean(source?.noLongLastPresetSyncope),
  fallLastNote: Boolean(source?.fallLastNote),
  fallInterval3: Boolean(source?.fallInterval3),
  bendFirstIf3: Boolean(source?.bendFirstIf3),
  vibratoLongest: Boolean(source?.vibratoLongest),
  portamentoBeforeLargestInterval: Boolean(source?.portamentoBeforeLargestInterval),
});

const applyOrnamentRulesToInputs = () => {
  ruleLongNoteEInput.checked = ornamentRules.longNoteE;
  ruleLongNoteBInput.checked = ornamentRules.longNoteB;
  ruleLongLastPresetMelodiqueInput.checked = ornamentRules.longLastPresetMelodique;
  ruleNoLongLastPresetSyncopeInput.checked = ornamentRules.noLongLastPresetSyncope;
  ruleFallLastNoteInput.checked = ornamentRules.fallLastNote;
  ruleFallInterval3Input.checked = ornamentRules.fallInterval3;
  ruleBendFirstIf3Input.checked = ornamentRules.bendFirstIf3;
  ruleVibratoLongestInput.checked = ornamentRules.vibratoLongest;
  rulePortamentoBeforeLargestIntervalInput.checked = ornamentRules.portamentoBeforeLargestInterval;
};

const syncOrnamentRulesFromInputs = () => {
  ornamentRules = {
    longNoteE: ruleLongNoteEInput.checked,
    longNoteB: ruleLongNoteBInput.checked,
    longLastPresetMelodique: ruleLongLastPresetMelodiqueInput.checked,
    noLongLastPresetSyncope: ruleNoLongLastPresetSyncopeInput.checked,
    fallLastNote: ruleFallLastNoteInput.checked,
    fallInterval3: ruleFallInterval3Input.checked,
    bendFirstIf3: ruleBendFirstIf3Input.checked,
    vibratoLongest: ruleVibratoLongestInput.checked,
    portamentoBeforeLargestInterval: rulePortamentoBeforeLargestIntervalInput.checked,
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

const sanitizeMonosynthSettings = (source) => ({
  envelopeAttack: clamp(Number(source?.envelopeAttack ?? DEFAULT_MONOSYNTH_SETTINGS.envelopeAttack), 0.001, 0.1),
  envelopeDecay: clamp(Number(source?.envelopeDecay ?? DEFAULT_MONOSYNTH_SETTINGS.envelopeDecay), 0.01, 0.5),
  envelopeSustain: clamp(Number(source?.envelopeSustain ?? DEFAULT_MONOSYNTH_SETTINGS.envelopeSustain), 0, 1),
  envelopeRelease: clamp(Number(source?.envelopeRelease ?? DEFAULT_MONOSYNTH_SETTINGS.envelopeRelease), 0.01, 1),
  filterFrequency: clamp(Number(source?.filterFrequency ?? DEFAULT_MONOSYNTH_SETTINGS.filterFrequency), 60, 20000),
  filterQ: clamp(Number(source?.filterQ ?? DEFAULT_MONOSYNTH_SETTINGS.filterQ), 0, 20),
  filterEnvelopeBaseFrequency: clamp(
    Number(source?.filterEnvelopeBaseFrequency ?? DEFAULT_MONOSYNTH_SETTINGS.filterEnvelopeBaseFrequency),
    60,
    20000
  ),
  filterEnvelopeOctaves: clamp(
    Number(source?.filterEnvelopeOctaves ?? DEFAULT_MONOSYNTH_SETTINGS.filterEnvelopeOctaves),
    0,
    6
  ),
});

const applyMonosynthSettingsToInputs = () => {
  monoEnvelopeAttackInput.value = String(monosynthSettings.envelopeAttack);
  monoEnvelopeAttackValue.textContent = monosynthSettings.envelopeAttack.toFixed(3);
  monoEnvelopeDecayInput.value = String(monosynthSettings.envelopeDecay);
  monoEnvelopeDecayValue.textContent = monosynthSettings.envelopeDecay.toFixed(2);
  monoEnvelopeSustainInput.value = String(monosynthSettings.envelopeSustain);
  monoEnvelopeSustainValue.textContent = monosynthSettings.envelopeSustain.toFixed(2);
  monoEnvelopeReleaseInput.value = String(monosynthSettings.envelopeRelease);
  monoEnvelopeReleaseValue.textContent = monosynthSettings.envelopeRelease.toFixed(2);
  monoFilterFrequencyInput.value = String(monosynthSettings.filterFrequency);
  monoFilterFrequencyValue.textContent = String(Math.round(monosynthSettings.filterFrequency));
  monoFilterQInput.value = String(monosynthSettings.filterQ);
  monoFilterQValue.textContent = monosynthSettings.filterQ.toFixed(1);
  monoFilterEnvelopeBaseFrequencyInput.value = String(monosynthSettings.filterEnvelopeBaseFrequency);
  monoFilterEnvelopeBaseFrequencyValue.textContent = String(Math.round(monosynthSettings.filterEnvelopeBaseFrequency));
  monoFilterEnvelopeOctavesInput.value = String(monosynthSettings.filterEnvelopeOctaves);
  monoFilterEnvelopeOctavesValue.textContent = monosynthSettings.filterEnvelopeOctaves.toFixed(1);
};

const syncMonosynthSettingsFromInputs = () => {
  monosynthSettings = sanitizeMonosynthSettings({
    envelopeAttack: monoEnvelopeAttackInput.value,
    envelopeDecay: monoEnvelopeDecayInput.value,
    envelopeSustain: monoEnvelopeSustainInput.value,
    envelopeRelease: monoEnvelopeReleaseInput.value,
    filterFrequency: monoFilterFrequencyInput.value,
    filterQ: monoFilterQInput.value,
    filterEnvelopeBaseFrequency: monoFilterEnvelopeBaseFrequencyInput.value,
    filterEnvelopeOctaves: monoFilterEnvelopeOctavesInput.value,
  });
};

const getVibratoConditionsDescription = (rules) => {
  if (!rules.vibratoLongest) {
    return "Désactivé (règle vibrato non cochée).";
  }
  return "Activé uniquement sur la note la plus longue, si elle est marquée « long » et sans bend.";
};

const setStatus = (message, isError = false) => {
  statusLabel.textContent = message;
  statusLabel.classList.toggle("error", isError);
};

const persistSettings = () => {
  syncOrnamentRulesFromInputs();
  const data = {
    primaryTones: primaryTonesInput.value,
    secondaryTones: secondaryTonesInput.value,
    forbiddenTones: forbiddenTonesInput.value,
    ambitusMin: ambitusMinInput.value,
    ambitusMax: ambitusMaxInput.value,
    instrument: instrumentSelect.value,
    rhythmSettings,
    monosynthSettings,
    ornamentRules,
    lastLoadedPresetName,
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
    monosynthSettings = structuredClone(DEFAULT_MONOSYNTH_SETTINGS);
    ornamentRules = structuredClone(DEFAULT_ORNAMENT_RULES);
    lastLoadedPresetName = null;
    applyRhythmSettingsToSliders();
    applyMonosynthSettingsToInputs();
    applyOrnamentRulesToInputs();
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
    monosynthSettings = sanitizeMonosynthSettings(data.monosynthSettings ?? DEFAULT_MONOSYNTH_SETTINGS);
    ornamentRules = sanitizeOrnamentRules(data.ornamentRules ?? DEFAULT_ORNAMENT_RULES);
    lastLoadedPresetName = typeof data.lastLoadedPresetName === "string" ? data.lastLoadedPresetName : null;
    applyRhythmSettingsToSliders();
    applyMonosynthSettingsToInputs();
    applyOrnamentRulesToInputs();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    rhythmSettings = structuredClone(DEFAULT_RHYTHM_SETTINGS);
    monosynthSettings = structuredClone(DEFAULT_MONOSYNTH_SETTINGS);
    ornamentRules = structuredClone(DEFAULT_ORNAMENT_RULES);
    lastLoadedPresetName = null;
    applyRhythmSettingsToSliders();
    applyMonosynthSettingsToInputs();
    applyOrnamentRulesToInputs();
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
      const isDescendingReturnedChromatic = previousDirection === -1 && currentDirection === 2;
      if (isDescendingReturnedChromatic) {
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
    const category = getPitchClassCategory(toneGroups, midi);
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
  let requiresNextDescendingMotion = false;

  const search = (index) => {
    if (index === noteCount) {
      const finalCategory = categories[categories.length - 1];
      return finalCategory === "A";
    }

    const prevPrevMidi = index > 1 ? sequence[index - 2] : null;
    const prevMidi = index > 0 ? sequence[index - 1] : null;
    const prevCategory = index > 0 ? categories[index - 1] : null;

    const stateKey = `${index}|${prevMidi ?? "_"}|${prevCategory ?? "_"}|${sequenceMin}|${sequenceMax}|${requiresNextDescendingMotion}`;
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

      if (requiresNextDescendingMotion && index > 0 && midi >= prevMidi) {
        continue;
      }

      const nextMin = Math.min(sequenceMin, midi);
      const nextMax = Math.max(sequenceMax, midi);
      if (nextMax - nextMin > MAX_SEQUENCE_RANGE_SEMITONES) {
        continue;
      }

      const previousMin = sequenceMin;
      const previousMax = sequenceMax;
      const previousRequiresNextDescendingMotion = requiresNextDescendingMotion;
      if (index > 1) {
        const previousDirection = prevMidi - prevPrevMidi;
        const currentDirection = midi - prevMidi;
        const isAscendingReturnedChromatic = previousDirection === 1 && currentDirection === -2;
        requiresNextDescendingMotion = isAscendingReturnedChromatic;
      } else {
        requiresNextDescendingMotion = false;
      }

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
      requiresNextDescendingMotion = previousRequiresNextDescendingMotion;
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

const createPlayableTimeline = (midiSequence, rhythm, activeOrnaments, toneGroups) => {
  const subdivDur = (60 / rhythm.bpm) / 4;
  return midiSequence.map((midi, index) => {
    const event = rhythm.noteEvents[index];
    const nextEvent = rhythm.noteEvents[index + 1] ?? null;
    const nextMidi = midiSequence[index + 1] ?? null;
    const start = event.subdivisionOffset * subdivDur;

    const naturalDuration = nextEvent
      ? Math.max(0.06, (nextEvent.subdivisionOffset - event.subdivisionOffset) * subdivDur)
      : 2 * subdivDur;
    const duration = activeOrnaments.long ? naturalDuration : subdivDur;

    return {
      midi,
      nextMidi,
      category: getPitchClassCategory(toneGroups, midi),
      start,
      duration,
      naturalDuration,
      subdivisionOffset: event.subdivisionOffset,
    };
  });
};

const resolveOrnamentsPerNote = (timeline, midiSequence, rules) => {
  const perNote = timeline.map(() => ({ long: false, vibrato: false, bend: false, fall: false, portamento: false }));
  const longestDuration = timeline.reduce((max, item) => Math.max(max, item.naturalDuration), 0);
  const fallIntervalCandidates = [];

  let largestInterval = -1;
  let largestIntervalIndex = -1;
  for (let index = 0; index < midiSequence.length - 1; index += 1) {
    const interval = Math.abs(midiSequence[index + 1] - midiSequence[index]);
    if (interval > largestInterval) {
      largestInterval = interval;
      largestIntervalIndex = index;
    }
  }

  const repeatedRunIndices = new Set();
  for (let index = 1; index < midiSequence.length; index += 1) {
    if (midiSequence[index] === midiSequence[index - 1]) {
      repeatedRunIndices.add(index - 1);
      repeatedRunIndices.add(index);
    }
  }

  timeline.forEach((item, index) => {
    const midi = midiSequence[index];
    const category = item.category;
    const nextMidi = midiSequence[index + 1] ?? null;
    const nextSubdivisionOffset = timeline[index + 1]?.subdivisionOffset ?? null;
    const distanceToNextSixteenth = nextSubdivisionOffset === null
      ? null
      : nextSubdivisionOffset - item.subdivisionOffset;
    const isRepeatedWithNeighbor = repeatedRunIndices.has(index);

    if (!isRepeatedWithNeighbor && rules.longNoteE && category === "E") {
      perNote[index].long = true;
    }
    if (!isRepeatedWithNeighbor && rules.longNoteB && category === "B") {
      perNote[index].long = true;
    }
    if (rules.longLastPresetMelodique && lastLoadedPresetName === "Mélodique") {
      perNote[index].long = true;
    }
    if (rules.noLongLastPresetSyncope && lastLoadedPresetName === "Syncopé") {
      perNote[index].long = false;
    }
    if (rules.bendFirstIf3 && index === 0 && distanceToNextSixteenth !== null && distanceToNextSixteenth >= 3) {
      perNote[index].bend = true;
    }
    if (
      rules.fallInterval3 &&
      item.category === "A" &&
      !perNote[index].long &&
      !perNote[index].bend &&
      distanceToNextSixteenth !== null &&
      distanceToNextSixteenth >= 3
    ) {
      fallIntervalCandidates.push(index);
    }
    if (
      rules.vibratoLongest &&
      item.naturalDuration === longestDuration &&
      longestDuration > 0 &&
      perNote[index].long &&
      !perNote[index].bend
    ) {
      perNote[index].vibrato = true;
    }
    if (
      rules.portamentoBeforeLargestInterval &&
      index === largestIntervalIndex &&
      largestIntervalIndex >= 0 &&
      nextMidi !== null
    ) {
      const isAdjacentSixteenth = distanceToNextSixteenth === 1;
      const isLongNote = perNote[index].long;
      if (isAdjacentSixteenth || isLongNote) {
        perNote[index].portamento = true;
      }
    }
  });

  if (fallIntervalCandidates.length > 0) {
    const randomCandidateIndex = Math.floor(Math.random() * fallIntervalCandidates.length);
    const selectedIndex = fallIntervalCandidates[randomCandidateIndex];
    if (!perNote[selectedIndex].bend) {
      perNote[selectedIndex].fall = true;
    }
  } else if (rules.fallLastNote && timeline.length > 0) {
    const lastNoteIndex = timeline.length - 1;
    if (!perNote[lastNoteIndex].bend) {
      perNote[lastNoteIndex].fall = true;
    }
  }

  return perNote;
};

const scheduleToneNote = (synth, timelineItem, noteOrnaments) => {
  const { midi, nextMidi, start, duration } = timelineItem;
  const baseFreq = midiToHz(midi);
  const end = start + duration;
  const bendStartFreq = baseFreq * centsToRatio(-200);
  const noteStartFreq = noteOrnaments.bend ? bendStartFreq : baseFreq;

  synth.frequency.setValueAtTime(noteStartFreq, start);

  if (noteOrnaments.bend) {
    const bendRiseEnd = Math.min(end, start + Math.max(0.08, duration * 0.45));
    synth.frequency.linearRampToValueAtTime(baseFreq, bendRiseEnd);
  }

  if (noteOrnaments.portamento && nextMidi !== null) {
    const glideStart = Math.max(start + duration / 2, end - 0.15);
    synth.frequency.setValueAtTime(baseFreq, glideStart);
    synth.frequency.linearRampToValueAtTime(midiToHz(nextMidi), end);
  } else if (noteOrnaments.fall) {
    const fallStart = start + duration / 2;
    synth.frequency.setValueAtTime(baseFreq, fallStart);
    synth.frequency.linearRampToValueAtTime(baseFreq / 2, end);
  }

  if (noteOrnaments.vibrato) {
    const vibratoDelay = 0.15;
    const vibratoStart = Math.min(start + vibratoDelay, end);
    const vibratoDepth = baseFreq * (centsToRatio(100) - 1);
    const vibratoLfo = new Tone.Oscillator(8, "sine").start(vibratoStart);
    const vibratoGain = new Tone.Gain(vibratoDepth).connect(synth.frequency);
    vibratoLfo.connect(vibratoGain);
    vibratoLfo.stop(end);
  }

  if (noteOrnaments.bend) {
    synth.triggerAttack(noteStartFreq, start, 0.8);
    synth.triggerRelease(end);
    return;
  }

  synth.triggerAttackRelease(baseFreq, duration, start, 0.8);
};

const playSequenceWithTone = async (midiSequence, rhythm, rules, monoSettings) => {
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
      frequency: monoSettings.filterFrequency,
      Q: monoSettings.filterQ,
    },
    filterEnvelope: {
      baseFrequency: monoSettings.filterEnvelopeBaseFrequency,
      octaves: monoSettings.filterEnvelopeOctaves,
    },
    envelope: {
      attack: monoSettings.envelopeAttack,
      decay: monoSettings.envelopeDecay,
      sustain: monoSettings.envelopeSustain,
      release: monoSettings.envelopeRelease,
    },
  }).toDestination();

  const toneGroups = createToneGroups();
  const timeline = createPlayableTimeline(midiSequence, rhythm, { long: false }, toneGroups);
  const noteOrnaments = resolveOrnamentsPerNote(timeline, midiSequence, rules);
  const backingTrackPlayer = await getBackingTrackPlayer();
  backingTrackPlayer.stop(startAt);
  backingTrackPlayer.start(backingTrackStartAt);
  const drumNodes = scheduleDrumsWithTone(startAt, rhythm, totalSequenceSubdivisions, introSubdivisions);
  for (let repeatIndex = 0; repeatIndex < sequenceRepeats; repeatIndex += 1) {
    const repeatOffset = (repeatIndex * sequenceLengthSubdivisions * 60) / (rhythm.bpm * 4);
    timeline.forEach((item, index) => {
      const mergedItem = { ...item, start: melodyStartAt + repeatOffset + item.start };
      if (noteOrnaments[index].long) {
        mergedItem.duration = item.naturalDuration;
      }
      scheduleToneNote(synth, mergedItem, noteOrnaments[index]);
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
  lastLoadedPresetName = name;
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
    syncOrnamentRulesFromInputs();
    syncMonosynthSettingsFromInputs();
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
    resultVibratoConditions.textContent = getVibratoConditionsDescription(ornamentRules);

    persistSettings();
    await playSequenceWithTone(midiSequence, rhythm, ornamentRules, monosynthSettings);

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
    syncOrnamentRulesFromInputs();
    syncMonosynthSettingsFromInputs();
    await playSequenceWithTone(
      lastGeneratedSequence.midiSequence,
      lastGeneratedSequence.rhythm,
      ornamentRules,
      monosynthSettings
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
resultVibratoConditions.textContent = getVibratoConditionsDescription(ornamentRules);

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

[
  monoEnvelopeAttackInput,
  monoEnvelopeDecayInput,
  monoEnvelopeSustainInput,
  monoEnvelopeReleaseInput,
  monoFilterFrequencyInput,
  monoFilterQInput,
  monoFilterEnvelopeBaseFrequencyInput,
  monoFilterEnvelopeOctavesInput,
].forEach((input) => {
  input.addEventListener("input", () => {
    syncMonosynthSettingsFromInputs();
    applyMonosynthSettingsToInputs();
    persistSettings();
  });
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
  ruleLongNoteEInput,
  ruleLongNoteBInput,
  ruleLongLastPresetMelodiqueInput,
  ruleNoLongLastPresetSyncopeInput,
  ruleFallLastNoteInput,
  ruleFallInterval3Input,
  ruleBendFirstIf3Input,
  ruleVibratoLongestInput,
  rulePortamentoBeforeLargestIntervalInput,
].forEach((input) => {
  input.addEventListener("change", () => {
    syncOrnamentRulesFromInputs();
    persistSettings();
  });
});
