// Draco Cord V8 - Popup Script
// All UI interactions and state management

class DracoCordV8UI {
    constructor() {
        this.state = {
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

        this.analyzerRunning = false;
        this.canvasContext = null;
        this.animationFrameId = null;

        this.initElements();
        this.attachEventListeners();
        this.loadSettings();
        this.setupAnalyzer();
    }

    initElements() {
        // Master Gain
        this.masterGainSlider = document.getElementById('masterGain');
        this.masterGainValue = document.getElementById('masterGainValue');
        this.masterGainToggle = document.getElementById('masterGainToggle');

        // Voice Clarity
        this.voiceClaritySlider = document.getElementById('voiceClarity');
        this.voiceClarityValue = document.getElementById('voiceClarityValue');

        // Equalizer
        this.eqSliders = document.querySelectorAll('.eq-slider');
        this.eqToggle = document.getElementById('eqToggle');
        this.eqPanel = document.getElementById('eqPanel');

        // Other Controls
        this.compressorSlider = document.getElementById('compressor');
        this.compressorValue = document.getElementById('compressorValue');

        this.distortionSlider = document.getElementById('distortion');
        this.distortionValue = document.getElementById('distortionValue');

        this.reverbSlider = document.getElementById('reverb');
        this.reverbValue = document.getElementById('reverbValue');

        this.delaySlider = document.getElementById('delay');
        this.delayValue = document.getElementById('delayValue');

        this.speedSlider = document.getElementById('speed');
        this.speedValue = document.getElementById('speedValue');

        // Canvas & Status
        this.spectrumCanvas = document.getElementById('spectrumCanvas');
        this.analyzerToggle = document.getElementById('analyzerToggle');
        this.statusDisplay = document.getElementById('statusDisplay');
        this.peakLevelDisplay = document.getElementById('peakLevel');

        // Buttons
        this.enableBtn = document.getElementById('enableBtn');
        this.disableBtn = document.getElementById('disableBtn');
        this.resetBtn = document.getElementById('resetBtn');

        // Setup canvas
        if (this.spectrumCanvas) {
            this.canvasContext = this.spectrumCanvas.getContext('2d');
            this.spectrumCanvas.width = this.spectrumCanvas.offsetWidth;
            this.spectrumCanvas.height = this.spectrumCanvas.offsetHeight;
        }
    }

    attachEventListeners() {
        // Master Gain
        this.masterGainSlider.addEventListener('input', (e) => this.handleMasterGain(e));
        this.masterGainToggle.addEventListener('change', (e) => this.handleMasterGainToggle(e));

        // Voice Clarity
        this.voiceClaritySlider.addEventListener('input', (e) => this.handleVoiceClarity(e));

        // Equalizer
        this.eqToggle.addEventListener('click', () => this.toggleEQPanel());
        this.eqSliders.forEach(slider => {
            slider.addEventListener('input', (e) => this.handleEQChange(e));
        });

        // Other Sliders
        this.compressorSlider.addEventListener('input', (e) => this.handleCompressor(e));
        this.distortionSlider.addEventListener('input', (e) => this.handleDistortion(e));
        this.reverbSlider.addEventListener('input', (e) => this.handleReverb(e));
        this.delaySlider.addEventListener('input', (e) => this.handleDelay(e));
        this.speedSlider.addEventListener('input', (e) => this.handleSpeed(e));

        // Analyzer Toggle
        this.analyzerToggle.addEventListener('click', () => this.toggleAnalyzer());

        // Buttons
        this.enableBtn.addEventListener('click', () => this.enableDSP());
        this.disableBtn.addEventListener('click', () => this.disableDSP());
        this.resetBtn.addEventListener('click', () => this.resetAll());

        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'updatePeakLevel') {
                this.state.peakLevel = request.value;
                this.peakLevelDisplay.textContent = request.value.toFixed(1) + 'dB';
            }
        });
    }

    handleMasterGain(e) {
        this.state.masterGain = parseInt(e.target.value);
        this.masterGainValue.textContent = this.state.masterGain + 'dB';
        this.syncToContent();
    }

    handleMasterGainToggle(e) {
        this.state.masterGainEnabled = e.target.checked;
        if (this.state.masterGainEnabled) {
            this.masterGainSlider.style.opacity = '1';
            this.statusDisplay.textContent = 'MASTER GAIN ACTIVE';
            this.statusDisplay.style.color = '#ff6b6b';
        } else {
            this.masterGainSlider.style.opacity = '0.5';
            this.statusDisplay.textContent = 'MASTER GAIN DISABLED';
            this.statusDisplay.style.color = '#00ff88';
        }
        this.syncToContent();
    }

    handleVoiceClarity(e) {
        this.state.voiceClarity = parseInt(e.target.value);
        this.voiceClarityValue.textContent = this.state.voiceClarity + '%';
        this.syncToContent();
    }

    handleEQChange(e) {
        const band = e.target.dataset.band;
        const value = parseFloat(e.target.value);
        this.state.eq[band] = value;
        e.target.nextElementSibling.textContent = value.toFixed(1) + 'dB';
        this.syncToContent();
    }

    handleCompressor(e) {
        this.state.compressor = parseFloat(e.target.value);
        this.compressorValue.textContent = this.state.compressor.toFixed(1);
        this.syncToContent();
    }

    handleDistortion(e) {
        this.state.distortion = parseInt(e.target.value);
        this.distortionValue.textContent = this.state.distortion + '%';
        this.syncToContent();
    }

    handleReverb(e) {
        this.state.reverb = parseInt(e.target.value);
        this.reverbValue.textContent = this.state.reverb + '%';
        this.syncToContent();
    }

    handleDelay(e) {
        this.state.delay = parseInt(e.target.value);
        this.delayValue.textContent = this.state.delay + '%';
        this.syncToContent();
    }

    handleSpeed(e) {
        this.state.speed = parseFloat(e.target.value);
        this.speedValue.textContent = this.state.speed.toFixed(1) + 'x';
        this.syncToContent();
    }

    toggleEQPanel() {
        this.eqPanel.classList.toggle('hidden');
        this.eqToggle.textContent = this.eqPanel.classList.contains('hidden') ? 'SHOW' : 'HIDE';
    }

    toggleAnalyzer() {
        this.analyzerRunning = !this.analyzerRunning;
        this.analyzerToggle.textContent = this.analyzerRunning ? 'HIDE' : 'SHOW';
        this.spectrumCanvas.classList.toggle('hidden');
        
        if (this.analyzerRunning) {
            this.drawAnalyzer();
        } else {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }
        }
    }

    setupAnalyzer() {
        // Request analyzer data from content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'getAnalyzerData' }, (response) => {
                    // Response handler
                });
            }
        });
    }

    drawAnalyzer() {
        if (!this.canvasContext) return;

        const width = this.spectrumCanvas.width;
        const height = this.spectrumCanvas.height;

        // Clear canvas
        this.canvasContext.fillStyle = '#000000';
        this.canvasContext.fillRect(0, 0, width, height);

        // Draw grid
        this.canvasContext.strokeStyle = 'rgba(0, 255, 136, 0.2)';
        this.canvasContext.lineWidth = 0.5;
        
        for (let i = 0; i <= 10; i++) {
            const y = (height / 10) * i;
            this.canvasContext.beginPath();
            this.canvasContext.moveTo(0, y);
            this.canvasContext.lineTo(width, y);
            this.canvasContext.stroke();
        }

        // Draw bars (simulated)
        const barCount = 32;
        const barWidth = width / barCount;
        
        this.canvasContext.fillStyle = 'rgba(0, 255, 136, 0.8)';
        for (let i = 0; i < barCount; i++) {
            const randomHeight = Math.random() * height * 0.8;
            this.canvasContext.fillRect(i * barWidth, height - randomHeight, barWidth - 2, randomHeight);
        }

        // Draw glow effect
        this.canvasContext.strokeStyle = 'rgba(0, 255, 136, 0.4)';
        this.canvasContext.lineWidth = 2;
        this.canvasContext.strokeRect(0, 0, width, height);

        if (this.analyzerRunning) {
            this.animationFrameId = requestAnimationFrame(() => this.drawAnalyzer());
        }
    }

    enableDSP() {
        this.state.enabled = true;
        this.statusDisplay.textContent = 'DSP ACTIVE';
        this.statusDisplay.style.color = '#00ff88';
        this.enableBtn.disabled = true;
        this.disableBtn.disabled = false;
        this.syncToContent();
        this.showNotification('DSP Enabled', 'success');
    }

    disableDSP() {
        this.state.enabled = false;
        this.statusDisplay.textContent = 'DSP INACTIVE';
        this.statusDisplay.style.color = '#ff6b6b';
        this.enableBtn.disabled = false;
        this.disableBtn.disabled = true;
        this.syncToContent();
        this.showNotification('DSP Disabled', 'info');
    }

    resetAll() {
        this.state = {
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

        // Update UI
        this.masterGainSlider.value = 0;
        this.masterGainValue.textContent = '0dB';
        this.masterGainToggle.checked = false;

        this.voiceClaritySlider.value = 0;
        this.voiceClarityValue.textContent = '0%';

        this.eqSliders.forEach(slider => {
            slider.value = 0;
            slider.nextElementSibling.textContent = '0.0dB';
        });

        this.compressorSlider.value = 1;
        this.compressorValue.textContent = '1.0';

        this.distortionSlider.value = 0;
        this.distortionValue.textContent = '0%';

        this.reverbSlider.value = 0;
        this.reverbValue.textContent = '0%';

        this.delaySlider.value = 0;
        this.delayValue.textContent = '0%';

        this.speedSlider.value = 1;
        this.speedValue.textContent = '1.0x';

        this.statusDisplay.textContent = 'Reset Complete';
        this.showNotification('All Settings Reset', 'info');
        this.saveSettings();
        this.syncToContent();
    }

    syncToContent() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'updateDSP',
                    state: this.state
                }, (response) => {
                    // Handle response if needed
                });
            }
        });

        this.saveSettings();
    }

    saveSettings() {
        chrome.storage.local.set({ 'dracoCordSettings': this.state }, () => {
            console.log('Settings saved');
        });
    }

    loadSettings() {
        chrome.storage.local.get(['dracoCordSettings'], (result) => {
            if (result.dracoCordSettings) {
                this.state = result.dracoCordSettings;
                this.updateUIFromState();
            }
        });
    }

    updateUIFromState() {
        this.masterGainSlider.value = this.state.masterGain;
        this.masterGainValue.textContent = this.state.masterGain + 'dB';
        this.masterGainToggle.checked = this.state.masterGainEnabled;

        this.voiceClaritySlider.value = this.state.voiceClarity;
        this.voiceClarityValue.textContent = this.state.voiceClarity + '%';

        this.eqSliders.forEach(slider => {
            const band = slider.dataset.band;
            slider.value = this.state.eq[band];
            slider.nextElementSibling.textContent = this.state.eq[band].toFixed(1) + 'dB';
        });

        this.compressorSlider.value = this.state.compressor;
        this.compressorValue.textContent = this.state.compressor.toFixed(1);

        this.distortionSlider.value = this.state.distortion;
        this.distortionValue.textContent = this.state.distortion + '%';

        this.reverbSlider.value = this.state.reverb;
        this.reverbValue.textContent = this.state.reverb + '%';

        this.delaySlider.value = this.state.delay;
        this.delayValue.textContent = this.state.delay + '%';

        this.speedSlider.value = this.state.speed;
        this.speedValue.textContent = this.state.speed.toFixed(1) + 'x';
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#00ff88' : '#00ccff'};
            color: #000;
            border-radius: 6px;
            font-weight: bold;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DracoCordV8UI();
});
