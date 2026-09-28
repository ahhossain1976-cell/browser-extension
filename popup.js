const DEFAULT_STATE = {
  enabled: false,
  masterGain: 0,
  masterGainEnabled: false,
  voiceClarity: 0,
  eq: { 60: 0, 250: 0, 1000: 0, 4000: 0, 12000: 0 },
  compressor: 1,
  distortion: 0,
  reverb: 0,
  delay: 0,
  speed: 1,
  peakLevel: 0
};

const elements = {
  masterGain: document.getElementById('masterGain'),
  masterGainToggle: document.getElementById('masterGainToggle'),
  masterGainValue: document.getElementById('masterGainValue'),
  voiceClarity: document.getElementById('voiceClarity'),
  voiceClarityValue: document.getElementById('voiceClarityValue'),
  compressor: document.getElementById('compressor'),
  compressorValue: document.getElementById('compressorValue'),
  distortion: document.getElementById('distortion'),
  distortionValue: document.getElementById('distortionValue'),
  reverb: document.getElementById('reverb'),
  reverbValue: document.getElementById('reverbValue'),
  delay: document.getElementById('delay'),
  delayValue: document.getElementById('delayValue'),
  speed: document.getElementById('speed'),
  speedValue: document.getElementById('speedValue'),
  enableBtn: document.getElementById('enableBtn'),
  disableBtn: document.getElementById('disableBtn'),
  resetBtn: document.getElementById('resetBtn'),
  status: document.getElementById('statusDisplay'),
  eqToggle: document.getElementById('eqToggle'),
  eqPanel: document.getElementById('eqPanel')
};

let state = { ...DEFAULT_STATE };

function updateUI() {
  elements.masterGain.value = state.masterGain;
  elements.masterGainValue.textContent = `${state.masterGain}dB`;
  elements.masterGainToggle.checked = state.masterGainEnabled;

  elements.voiceClarity.value = state.voiceClarity;
  elements.voiceClarityValue.textContent = `${state.voiceClarity}%`;

  elements.compressor.value = state.compressor;
  elements.compressorValue.textContent = state.compressor.toFixed(1);

  elements.distortion.value = state.distortion;
  elements.distortionValue.textContent = `${state.distortion}%`;

  elements.reverb.value = state.reverb;
  elements.reverbValue.textContent = `${state.reverb}%`;

  elements.delay.value = state.delay;
  elements.delayValue.textContent = `${state.delay}%`;

  elements.speed.value = state.speed;
  elements.speedValue.textContent = `${state.speed.toFixed(1)}x`;

  Array.from(document.querySelectorAll('.eq-slider')).forEach((slider) => {
    const band = slider.dataset.band;
    const value = state.eq[band];
    slider.value = value;
    slider.nextElementSibling.textContent = `${value.toFixed(1)}dB`;
  });

  elements.status.textContent = state.enabled ? 'Active' : 'Inactive';
}

function sendStateToPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'updateDSP', state }, () => {
      chrome.storage.local.set({ dracoCordSettings: state }, () => {});
    });
  });
}

function saveState() {
  chrome.storage.local.set({ dracoCordSettings: state }, () => {});
}

function loadState() {
  chrome.storage.local.get(['dracoCordSettings'], (result) => {
    if (result.dracoCordSettings) {
      state = { ...DEFAULT_STATE, ...result.dracoCordSettings, eq: { ...DEFAULT_STATE.eq, ...(result.dracoCordSettings.eq || {}) } };
    }
    updateUI();
  });
}

function bindEvents() {
  elements.masterGain.addEventListener('input', (event) => {
    state.masterGain = Number(event.target.value);
    elements.masterGainValue.textContent = `${state.masterGain}dB`;
    sendStateToPage();
  });

  elements.masterGainToggle.addEventListener('change', (event) => {
    state.masterGainEnabled = event.target.checked;
    sendStateToPage();
  });

  elements.voiceClarity.addEventListener('input', (event) => {
    state.voiceClarity = Number(event.target.value);
    elements.voiceClarityValue.textContent = `${state.voiceClarity}%`;
    sendStateToPage();
  });

  Array.from(document.querySelectorAll('.eq-slider')).forEach((slider) => {
    slider.addEventListener('input', (event) => {
      const band = event.target.dataset.band;
      state.eq[band] = Number(event.target.value);
      event.target.nextElementSibling.textContent = `${state.eq[band].toFixed(1)}dB`;
      sendStateToPage();
    });
  });

  elements.compressor.addEventListener('input', (event) => {
    state.compressor = Number(event.target.value);
    elements.compressorValue.textContent = state.compressor.toFixed(1);
    sendStateToPage();
  });

  elements.distortion.addEventListener('input', (event) => {
    state.distortion = Number(event.target.value);
    elements.distortionValue.textContent = `${state.distortion}%`;
    sendStateToPage();
  });

  elements.reverb.addEventListener('input', (event) => {
    state.reverb = Number(event.target.value);
    elements.reverbValue.textContent = `${state.reverb}%`;
    sendStateToPage();
  });

  elements.delay.addEventListener('input', (event) => {
    state.delay = Number(event.target.value);
    elements.delayValue.textContent = `${state.delay}%`;
    sendStateToPage();
  });

  elements.speed.addEventListener('input', (event) => {
    state.speed = Number(event.target.value);
    elements.speedValue.textContent = `${state.speed.toFixed(1)}x`;
    sendStateToPage();
  });

  elements.enableBtn.addEventListener('click', () => {
    state.enabled = true;
    updateUI();
    sendStateToPage();
  });

  elements.disableBtn.addEventListener('click', () => {
    state.enabled = false;
    updateUI();
    sendStateToPage();
  });

  elements.resetBtn.addEventListener('click', () => {
    state = { ...DEFAULT_STATE };
    updateUI();
    sendStateToPage();
  });

  elements.eqToggle.addEventListener('click', () => {
    elements.eqPanel.classList.toggle('hidden');
    elements.eqToggle.textContent = elements.eqPanel.classList.contains('hidden') ? 'SHOW' : 'HIDE';
  });
}

bindEvents();
loadState();
updateUI();
