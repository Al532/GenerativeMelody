import { chromas, instruments, instrumentRanges } from "./assets.js";

const playRandomButton = document.querySelector("#play-random");
const playFeedbackButton = document.querySelector("#play-feedback");
const chromaLabel = document.querySelector("#sample-chroma");
const midiLabel = document.querySelector("#sample-midi");
const instrumentLabel = document.querySelector("#sample-instrument");

let activeAudio = null;

const stopActiveAudio = () => {
  if (!activeAudio) {
    return;
  }

  activeAudio.pause();
  activeAudio.currentTime = 0;
};

const playAudio = (src) => {
  stopActiveAudio();
  activeAudio = new Audio(src);
  activeAudio.play();
};

const randomFromArray = (items) =>
  items[Math.floor(Math.random() * items.length)];

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const updateSampleMeta = (midi, instrument) => {
  const chroma = chromas[midi % 12];
  chromaLabel.textContent = chroma.label;
  midiLabel.textContent = midi.toString();
  instrumentLabel.textContent = instrument;
};

playRandomButton.addEventListener("click", () => {
  const instrument = randomFromArray(instruments);
  const range = instrumentRanges[instrument];
  const midi = randomInt(range.min, range.max);
  updateSampleMeta(midi, instrument);
  playAudio(`assets/MP3/${instrument}/${midi}.mp3`);
});

playFeedbackButton.addEventListener("click", () => {
  playAudio("assets/feedback.mp3");
});
