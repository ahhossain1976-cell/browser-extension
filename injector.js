(() => {
  if (window.__dracoCordInjected) return;
  window.__dracoCordInjected = true;

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

  const state = { ...DEFAULT_STATE };
  const elements = new WeakMap();
  let analyserArray = new Uint8Array(128);
  let lastPeak = -100;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createImpulseResponse(duration, decay, reverse) {
    const sampleRate = 44100;
    const length = sampleRate * duration;
    const impulse = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      impulse[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    return impulse;
  }

  function ensureAudioGraph(mediaEl) {
    if (!mediaEl || elements.has(mediaEl)) return;
    if (!(mediaEl instanceof HTMLMediaElement)) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(mediaEl);

    const preGain = ctx.createGain();
    const finalGain = ctx.createGain();
    const masterGain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85;

    const eqNodes = [
      ctx.createBiquadFilter(),
      ctx.createBiquadFilter(),
      ctx.createBiquadFilter(),
      ctx.createBiquadFilter(),
      ctx.createBiquadFilter()
    ];

    const eqConfig = [
      { type: 'lowshelf', frequency: 60, gain: 0, Q: 1 },
      { type: 'peaking', frequency: 250, gain: 0, Q: 1 },
      { type: 'peaking', frequency: 1000, gain: 0, Q: 1 },
      { type: 'peaking', frequency: 4000, gain: 0, Q: 1 },
      { type: 'highshelf', frequency: 12000, gain: 0, Q: 1 }
    ];

    eqConfig.forEach((config, index) => {
      const node = eqNodes[index];
      node.type = config.type;
      node.frequency.value = config.frequency;
      node.gain.value = config.gain;
      node.Q.value = config.Q;
    });

    const voiceGain = ctx.createGain();
    const compression = ctx.createDynamicsCompressor();
    compression.threshold.value = -24;
    compression.knee.value = 8;
    compression.ratio.value = 12;
    compression.attack.value = 0.005;
    compression.release.value = 0.25;

    const dist = ctx.createWaveShaper();
    const delay = ctx.createDelay(2.0);
    const delayGain = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = ctx.createBuffer(2, ctx.sampleRate * 1.5, ctx.sampleRate);
    const left = convolver.buffer.getChannelData(0);
    const right = convolver.buffer.getChannelData(1);
    for (let i = 0; i < convolver.buffer.length; i++) {
      left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / convolver.buffer.length, 2);
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / convolver.buffer.length, 2);
    }

    const reverbGain = ctx.createGain();
    const postGain = ctx.createGain();

    const distortionCurve = (value) => {
      const amount = clamp(value, 0, 1) * 100;
      const k = amount;
      const x = value * 2 - 1;
      return (Math.sign(x) * (1 - Math.exp(-Math.abs(x) * (k + 1)))) / 1.2;
    };
    dist.curve = new Float32Array(8192);
    for (let i = 0; i < 8192; i++) {
      const x = (i / 8192) * 2 - 1;
      dist.curve[i] = distortionCurve(x);
    }
    dist.oversample = '4x';

    delay.delayTime.value = 0.18;
    delayGain.gain.value = 0.12;
    reverbGain.gain.value = 0.07;
    preGain.gain.value = 1;
    finalGain.gain.value = 1;
    masterGain.gain.value = 1;
    voiceGain.gain.value = 1;
    postGain.gain.value = 1;

    source.connect(preGain);
    preGain.connect(eqNodes[0]);
    eqNodes[0].connect(eqNodes[1]);
    eqNodes[1].connect(eqNodes[2]);
    eqNodes[2].connect(eqNodes[3]);
    eqNodes[3].connect(eqNodes[4]);
    eqNodes[4].connect(voiceGain);
    voiceGain.connect(compression);
    compression.connect(dist);
    dist.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(finalGain);
    dist.connect(convolver);
    convolver.connect(reverbGain);
    reverbGain.connect(finalGain);
    dist.connect(postGain);
    postGain.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    finalGain.connect(masterGain);

    elements.set(mediaEl, {
      context: ctx,
      source,
      preGain,
      finalGain,
      masterGain,
      analyser,
      eqNodes,
      voiceGain,
      compression,
      dist,
      delay,
      delayGain,
      convolver,
      reverbGain,
      postGain
    });
  }

  function applySettingsToMedia(mediaEl) {
    const graph = elements.get(mediaEl);
    if (!graph) return;

    const eqSettings = state.eq || DEFAULT_STATE.eq;
    graph.eqNodes.forEach((node, index) => {
      const freqMap = [60, 250, 1000, 4000, 12000];
      node.frequency.value = freqMap[index];
      node.gain.value = eqSettings[String(freqMap[index])] || 0;
    });

    graph.voiceGain.gain.value = 1 + (state.voiceClarity / 100) * 2.5;
    graph.compression.ratio.value = clamp(1 + state.compressor * 1.1, 1, 20);
    graph.dist.curve = new Float32Array(8192);
    const distortionAmount = clamp(state.distortion / 100, 0, 1);
    for (let i = 0; i < 8192; i++) {
      const x = (i / 8192) * 2 - 1;
      const curveAmount = 1 + distortionAmount * 16;
      graph.dist.curve[i] = Math.tanh(x * curveAmount) / Math.tanh(1 * curveAmount);
    }
    graph.delayGain.gain.value = (state.delay / 100) * 0.7;
    graph.reverbGain.gain.value = (state.reverb / 100) * 0.6;
    graph.masterGain.gain.value = state.masterGainEnabled ? Math.pow(10, (state.masterGain + 10) / 20) : 1;
    graph.finalGain.gain.value = 1;

    const playbackRate = clamp(state.speed || 1, 0.5, 2);
    mediaEl.playbackRate = playbackRate;
    mediaEl.volume = clamp(1 + state.voiceClarity / 100, 0.1, 2);
  }

  function applyGlobalSettings() {
    document.querySelectorAll('audio, video').forEach((mediaEl) => {
      ensureAudioGraph(mediaEl);
      applySettingsToMedia(mediaEl);
    });
  }

  function ensureUi() {
    if (document.getElementById('draco-cord-ui')) return;

    const ui = document.createElement('div');
    ui.id = 'draco-cord-ui';
    ui.style.position = 'fixed';
    ui.style.right = '20px';
    ui.style.top = '20px';
    ui.style.width = '260px';
    ui.style.minHeight = '120px';
    ui.style.background = 'rgba(10,10,10,0.75)';
    ui.style.border = '1px solid rgba(255,255,255,0.2)';
    ui.style.borderRadius = '12px';
    ui.style.backdropFilter = 'blur(10px)';
    ui.style.boxShadow = '0 0 32px rgba(255,255,255,0.15)';
    ui.style.color = '#fff';
    ui.style.zIndex = '2147483647';
    ui.style.fontFamily = 'Arial, sans-serif';
    ui.style.userSelect = 'none';
    ui.style.padding = '12px';
    ui.style.cursor = 'move';
    ui.style.transform = 'translateZ(0)';

    const title = document.createElement('div');
    title.textContent = 'DRACO CORD V8';
    title.style.fontSize = '14px';
    title.style.fontWeight = '700';
    title.style.letterSpacing = '2px';
    title.style.textTransform = 'uppercase';
    title.style.color = '#fff';
    title.style.marginBottom = '10px';
    title.style.textShadow = '0 0 12px rgba(255,255,255,0.55)';
    ui.appendChild(title);

    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 80;
    canvas.style.width = '100%';
    canvas.style.height = '80px';
    canvas.style.background = 'rgba(0,0,0,0.9)';
    canvas.style.borderRadius = '8px';
    canvas.style.border = '1px solid rgba(255,255,255,0.12)';
    canvas.style.display = 'block';
    canvas.style.marginBottom = '8px';
    ui.appendChild(canvas);

    const status = document.createElement('div');
    status.textContent = 'STATUS: INACTIVE';
    status.style.fontSize = '11px';
    status.style.letterSpacing = '1px';
    status.style.color = '#9be7ff';
    status.style.marginBottom = '8px';
    status.id = 'draco-status';
    ui.appendChild(status);

    const peak = document.createElement('div');
    peak.textContent = 'PEAK: --dB';
    peak.style.fontSize = '11px';
    peak.style.letterSpacing = '1px';
    peak.style.color = '#fff';
    peak.id = 'draco-peak';
    ui.appendChild(peak);

    const move = (event) => {
      const rect = ui.getBoundingClientRect();
      const x = clamp(event.clientX - dragOffset.x, 10, window.innerWidth - rect.width - 10);
      const y = clamp(event.clientY - dragOffset.y, 10, window.innerHeight - rect.height - 10);
      ui.style.left = `${x}px`;
      ui.style.top = `${y}px`;
      ui.style.right = 'auto';
    };

    let dragOffset = { x: 0, y: 0 };
    ui.addEventListener('pointerdown', (event) => {
      const rect = ui.getBoundingClientRect();
      dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      ui.setPointerCapture(event.pointerId);
    });
    ui.addEventListener('pointermove', (event) => {
      if (event.buttons === 1) move(event);
    });
    ui.addEventListener('pointerup', () => ui.releasePointerCapture());

    document.body.appendChild(ui);

    const ctx = canvas.getContext('2d');
    function animate() {
      if (!document.getElementById('draco-cord-ui')) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i <= 10; i++) {
        const y = (canvas.height / 10) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      const bars = 32;
      for (let i = 0; i < bars; i++) {
        const h = 15 + (Math.random() * 45) + (state.enabled ? 25 : 5);
        const x = i * (canvas.width / bars) + 2;
        const w = (canvas.width / bars) - 4;
        ctx.fillStyle = state.enabled ? 'rgba(255,255,255,0.8)' : 'rgba(160,160,160,0.8)';
        ctx.fillRect(x, canvas.height - h, w, h);
      }

      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  function updateStatus() {
    const statusNode = document.getElementById('draco-status');
    const peakNode = document.getElementById('draco-peak');
    if (statusNode) {
      statusNode.textContent = state.enabled ? 'STATUS: ACTIVE' : 'STATUS: INACTIVE';
      statusNode.style.color = state.enabled ? '#00ff88' : '#9be7ff';
    }
    if (peakNode) {
      peakNode.textContent = `PEAK: ${state.peakLevel.toFixed(1)}dB`;
    }
  }

  function updateAnalyzer() {
    const mediaElements = document.querySelectorAll('audio, video');
    if (!mediaElements.length) return;

    mediaElements.forEach((mediaEl) => {
      const graph = elements.get(mediaEl);
      if (!graph) return;
      const analyser = graph.analyser;
      if (!analyser) return;
      analyser.getByteFrequencyData(analyserArray);
      let peak = -Infinity;
      for (let i = 0; i < analyserArray.length; i++) {
        if (analyserArray[i] > peak) peak = analyserArray[i];
      }
      const db = peak > 0 ? (peak / 255) * 60 - 30 : -100;
      lastPeak = db;
      state.peakLevel = lastPeak;
      updateStatus();
    });
  }

  function syncStateFromPopup(newState) {
    Object.assign(state, newState);
    applyGlobalSettings();
    updateStatus();
    document.querySelectorAll('audio, video').forEach((el) => {
      ensureAudioGraph(el);
      applySettingsToMedia(el);
    });
  }

  function onMessage(event) {
    if (!event.data || event.data.type !== 'draco-cord-state') return;
    syncStateFromPopup(event.data.state || DEFAULT_STATE);
  }

  function observeMedia() {
    const mediaList = document.querySelectorAll('audio, video');
    mediaList.forEach((mediaEl) => ensureAudioGraph(mediaEl));
    applyGlobalSettings();
    updateAnalyzer();
  }

  function init() {
    ensureUi();
    observeMedia();
    updateStatus();

    const observer = new MutationObserver(() => {
      observeMedia();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('message', onMessage, false);
    setInterval(updateAnalyzer, 120);
  }

  init();
})();
