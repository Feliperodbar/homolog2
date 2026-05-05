/**
 * Tutorial Generator - Frontend Application
 * Versão compilada do TypeScript para JavaScript
 */

// ============================================================================
// Screenshot Utility
// ============================================================================

class ScreenshotCapture {
    static async capture() {
        try {
            if (typeof html2canvas === 'undefined') {
                console.warn('html2canvas not available');
                return null;
            }
            
            const canvas = await html2canvas(document.documentElement, {
                allowTaint: true,
                useCORS: true,
                scale: 0.5, // Reduce size for performance
                logging: false,
            });
            
            return canvas.toDataURL('image/jpeg', 0.7);
        } catch (error) {
            console.error('Screenshot error:', error);
            return null;
        }
    }
}

// ============================================================================
// Event Recorder Module
// ============================================================================

const ActionType = {
    CLICK: "click",
    TYPE: "type",
    SPECIAL_KEY: "special_key",
    NAVIGATION: "navigation",
    SCROLL: "scroll",
    DRAG: "drag",
    UNKNOWN: "unknown",
};

class EventRecorder {
    constructor() {
        this.events = [];
        this.isRecording = false;
        this.startTime = 0;
        this.currentTypingText = "";
        this.typingTimeout = null;
        this.dragStart = null;
        this.onEventAdded = null;
        this.captureScreenshots = true;

        this.specialKeys = new Set([
            "enter", "tab", "escape", "backspace", "delete",
            "home", "end", "pageup", "pagedown",
            "arrowup", "arrowdown", "arrowleft", "arrowright",
            "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
        ]);

        this.modifierKeys = new Set([
            "shift", "ctrl", "control", "alt", "meta", "super", "capslock",
        ]);
    }

    enableScreenshots(enable = true) {
        this.captureScreenshots = enable;
    }

    startRecording() {
        if (this.isRecording) return;

        this.isRecording = true;
        this.startTime = Date.now();
        this.events = [];
        this.currentTypingText = "";

        document.addEventListener("click", this.onClickEvent.bind(this));
        document.addEventListener("keydown", this.onKeyDownEvent.bind(this));
        document.addEventListener("scroll", this.onScrollEvent.bind(this));
        document.addEventListener("mousedown", this.onMouseDownEvent.bind(this));
        document.addEventListener("mouseup", this.onMouseUpEvent.bind(this));
    }

    stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;

        if (this.currentTypingText) {
            this.addTypeEvent(this.currentTypingText);
        }

        document.removeEventListener("click", this.onClickEvent.bind(this));
        document.removeEventListener("keydown", this.onKeyDownEvent.bind(this));
        document.removeEventListener("scroll", this.onScrollEvent.bind(this));
        document.removeEventListener("mousedown", this.onMouseDownEvent.bind(this));
        document.removeEventListener("mouseup", this.onMouseUpEvent.bind(this));
    }

    clearEvents() {
        this.events = [];
        this.currentTypingText = "";
    }

    getEvents() {
        return [...this.events];
    }

    getRecordingDuration() {
        return this.startTime ? Date.now() - this.startTime : 0;
    }

    onEventAddedCallback(callback) {
        this.onEventAdded = callback;
    }

    onClickEvent(e) {
        if (!this.isRecording) return;

        const target = e.target;
        const details = {
            x: e.clientX,
            y: e.clientY,
            button: e.button === 0 ? "left" : e.button === 1 ? "middle" : "right",
            target: this.getElementSelector(target),
        };

        this.addEvent(ActionType.CLICK, details);
    }

    onKeyDownEvent(e) {
        if (!this.isRecording) return;

        const key = e.key.toLowerCase();

        if (this.modifierKeys.has(key)) {
            return;
        }

        if (this.specialKeys.has(key)) {
            const specialKey = key === "enter" ? "return" : key;
            let keyName = specialKey;

            if (e.ctrlKey) keyName = "ctrl+" + specialKey;
            if (e.altKey) keyName = "alt+" + specialKey;
            if (e.shiftKey) keyName = "shift+" + specialKey;
            if (e.metaKey) keyName = "meta+" + specialKey;

            const details = { key: keyName };
            this.addEvent(ActionType.SPECIAL_KEY, details);
            return;
        }

        if (e.key.length === 1) {
            this.currentTypingText += e.key;

            if (this.typingTimeout !== null) {
                clearTimeout(this.typingTimeout);
            }

            this.typingTimeout = window.setTimeout(() => {
                if (this.currentTypingText) {
                    this.addTypeEvent(this.currentTypingText);
                    this.currentTypingText = "";
                }
            }, 500);
        }
    }

    onScrollEvent(e) {
        if (!this.isRecording) return;

        const details = {
            scrollX: window.scrollX,
            scrollY: window.scrollY,
        };

        this.addEvent(ActionType.SCROLL, details);
    }

    onMouseDownEvent(e) {
        if (!this.isRecording) return;
        this.dragStart = { x: e.clientX, y: e.clientY };
    }

    onMouseUpEvent(e) {
        if (!this.isRecording || !this.dragStart) return;

        const distance = Math.sqrt(
            Math.pow(e.clientX - this.dragStart.x, 2) +
            Math.pow(e.clientY - this.dragStart.y, 2)
        );

        if (distance > 10) {
            const details = {
                x: this.dragStart.x,
                y: this.dragStart.y,
                target: this.getElementSelector(e.target),
            };

            this.addEvent(ActionType.DRAG, details);
        }

        this.dragStart = null;
    }

    addTypeEvent(text) {
        const details = { text };
        this.addEvent(ActionType.TYPE, details);
    }

    async addEvent(type, details) {
        if (!this.isRecording) return;

        const event = {
            type,
            timestamp: Date.now() - this.startTime,
            details,
            screenshot: null,
        };

        // Captura screenshot em background
        if (this.captureScreenshots && typeof html2canvas !== 'undefined') {
            try {
                const screenshot = await ScreenshotCapture.capture();
                event.screenshot = screenshot;
            } catch (error) {
                console.warn('Failed to capture screenshot:', error);
            }
        }

        this.events.push(event);

        if (this.onEventAdded) {
            this.onEventAdded(event);
        }
    }

    getElementSelector(element) {
        if (element.id) {
            return "#" + element.id;
        }

        if (element.className) {
            return element.tagName.toLowerCase() + "." + element.className.split(" ").join(".");
        }

        return element.tagName.toLowerCase();
    }

    convertToBackendFormat() {
        return this.events.map(event => ({
            type: event.type,
            timestamp: event.timestamp,
            details: event.details,
        }));
    }
}

// ============================================================================
// Backend Uploader Module
// ============================================================================

class BackendUploader {
    constructor(backendUrl = "http://localhost:5000") {
        this.backendUrl = backendUrl.replace(/\/$/, "");
        this.timeout = 30000;
    }

    setBackendUrl(url) {
        this.backendUrl = url.replace(/\/$/, "");
    }

    async generateTutorial(events, options) {
        const payload = {
            events,
            use_ai: options.useAI,
            analyze_screenshots: options.analyzeScreenshots,
            model: options.model || "gpt-4o",
        };

        try {
            const response = await this.fetchWithTimeout(
                `${this.backendUrl}/api/generate-tutorial`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || `Erro HTTP: ${response.status}`
                );
            }

            const tutorial = await response.json();
            return tutorial;
        } catch (error) {
            throw new Error(`Falha ao gerar tutorial: ${error.message}`);
        }
    }

    async checkHealth() {
        try {
            const response = await this.fetchWithTimeout(
                `${this.backendUrl}/health`,
                { method: "GET" }
            );
            return response.ok;
        } catch {
            return false;
        }
    }

    async getServerInfo() {
        try {
            const response = await this.fetchWithTimeout(
                `${this.backendUrl}/api/info`,
                { method: "GET" }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Falha ao obter informações do servidor: ${error}`);
        }
    }

    fetchWithTimeout(url, options = {}) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error("Timeout na requisição")),
                    this.timeout
                )
            ),
        ]);
    }

    formatEventsForBackend(events) {
        return events.map(event => ({
            type: event.type,
            timestamp: event.timestamp,
            details: event.details || {},
        }));
    }
}

// ============================================================================
// Main Application
// ============================================================================

class TutorialGeneratorApp {
    constructor() {
        this.recorder = new EventRecorder();
        this.uploader = new BackendUploader();
        this.recordingStartTime = 0;
        this.timerInterval = null;
        this.loadSettings();
    }

    async init() {
        this.cacheElements();
        this.setupEventListeners();
        this.checkBackendHealth();
    }

    cacheElements() {
        this.startBtn = document.getElementById("startBtn");
        this.stopBtn = document.getElementById("stopBtn");
        this.clearBtn = document.getElementById("clearBtn");
        this.exportBtn = document.getElementById("exportBtn");
        this.generateBtn = document.getElementById("generateBtn");
        this.generateHeuristicBtn = document.getElementById("generateHeuristicBtn");
        this.saveSettingsBtn = document.getElementById("saveSettingsBtn");
        this.recordingStatus = document.getElementById("recordingStatus");
        this.eventsList = document.getElementById("eventsList");
        this.tutorialContainer = document.getElementById("tutorialContainer");
        this.eventCount = document.getElementById("eventCount");
        this.recordingTime = document.getElementById("recordingTime");
        this.loadingSpinner = document.getElementById("loadingSpinner");
        this.errorMessage = document.getElementById("errorMessage");
        this.backendUrlInput = document.getElementById("backendUrl");
        this.useAICheckbox = document.getElementById("useAI");
        this.captureScreenshotsCheckbox = document.getElementById("captureScreenshots");
        this.analyzeScreenshotsCheckbox = document.getElementById("analyzeScreenshots");
    }

    setupEventListeners() {
        this.startBtn.addEventListener("click", () => this.startRecording());
        this.stopBtn.addEventListener("click", () => this.stopRecording());
        this.clearBtn.addEventListener("click", () => this.clearEvents());
        this.exportBtn.addEventListener("click", () => this.exportEvents());
        this.generateBtn.addEventListener("click", () => this.generateTutorial(true));
        this.generateHeuristicBtn.addEventListener("click", () =>
            this.generateTutorial(false)
        );
        this.saveSettingsBtn.addEventListener("click", () => this.saveSettings());

        document.querySelectorAll(".tab-button").forEach(button => {
            button.addEventListener("click", (e) => {
                const tabName = e.target.dataset.tab;
                if (tabName) this.switchTab(tabName);
            });
        });

        this.recorder.onEventAddedCallback((event) => {
            this.updateEventsList();
            this.updateEventCount();
        });
    }

    switchTab(tabName) {
        document.querySelectorAll(".tab-button").forEach(btn => {
            btn.classList.remove("active");
        });
        document.querySelectorAll(".tab-content").forEach(content => {
            content.classList.remove("active");
        });

        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);

        if (tabBtn) tabBtn.classList.add("active");
        if (tabContent) tabContent.classList.add("active");
    }

    startRecording() {
        this.recorder.enableScreenshots(this.captureScreenshotsCheckbox.checked);
        this.recorder.startRecording();
        this.recordingStartTime = Date.now();
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.recordingStatus.className = "status-badge status-recording";
        this.recordingStatus.innerHTML =
            '<span class="status-dot"></span> GRAVANDO';

        this.startTimer();
    }

    stopRecording() {
        this.recorder.stopRecording();
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.recordingStatus.className = "status-badge status-stopped";
        this.recordingStatus.innerHTML =
            '<span class="status-dot"></span> PARADO';

        if (this.timerInterval !== null) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    startTimer() {
        this.timerInterval = window.setInterval(() => {
            const duration = Date.now() - this.recordingStartTime;
            const hours = Math.floor(duration / 3600000);
            const minutes = Math.floor((duration % 3600000) / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);

            this.recordingTime.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }, 100);
    }

    clearEvents() {
        if (confirm("Tem certeza que deseja limpar todos os eventos?")) {
            this.recorder.clearEvents();
            this.updateEventsList();
            this.updateEventCount();
            this.clearTutorial();
        }
    }

    exportEvents() {
        const events = this.recorder.convertToBackendFormat();
        const json = JSON.stringify(events, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `events-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    updateEventsList() {
        const events = this.recorder.getEvents();

        if (events.length === 0) {
            this.eventsList.innerHTML =
                '<div class="empty-state"><p>Nenhum evento capturado ainda.<br>Clique em "Começar Gravação" para iniciar.</p></div>';
            return;
        }

        const html = events
            .map((event, index) => this.formatEventItem(event, index))
            .join("");

        this.eventsList.innerHTML = html;
    }

    formatEventItem(event, index) {
        const typeLabel = event.type.toUpperCase().replace("_", " ");
        const timestamp = new Date(event.timestamp).toLocaleTimeString("pt-BR");
        const description = this.getEventDescription(event);
        const detailsJson = JSON.stringify(event.details, null, 2);
        const screenshotHtml = event.screenshot ? `
            <div class="event-screenshot">
                <img src="${event.screenshot}" alt="Screenshot do evento" class="screenshot-thumb">
            </div>
        ` : '';

        return `
            <div class="event-item">
                <div class="event-content">
                    <div class="event-type ${event.type}">${typeLabel}</div>
                    <div class="event-description">${description}</div>
                    <div class="event-details"><pre>${detailsJson}</pre></div>
                    ${screenshotHtml}
                </div>
                <div class="event-timestamp">${timestamp}</div>
            </div>
        `;
    }

    getEventDescription(event) {
        const details = event.details;

        switch (event.type) {
            case ActionType.CLICK:
                return `Clique ${details.button || "esquerdo"} em ${details.target || "elemento"}`;
            case ActionType.TYPE:
                return `Digitou: "${details.text}"`;
            case ActionType.SPECIAL_KEY:
                return `Pressionou: <kbd>${details.key}</kbd>`;
            case ActionType.NAVIGATION:
                return `Navegar para: ${details.url || details.key}`;
            case ActionType.SCROLL:
                return `Scroll para: (${Math.round(details.scrollX)}, ${Math.round(details.scrollY)})`;
            case ActionType.DRAG:
                return `Arrastar em ${details.target || "elemento"}`;
            default:
                return "Evento desconhecido";
        }
    }

    updateEventCount() {
        const events = this.recorder.getEvents();
        this.eventCount.textContent = String(events.length);
    }

    async generateTutorial(useAI) {
        const events = this.recorder.getEvents();

        if (events.length === 0) {
            this.showError("Por favor, capture alguns eventos primeiro!");
            return;
        }

        this.showLoading(true);
        this.clearError();

        try {
            const tutorial = await this.uploader.generateTutorial(
                this.recorder.convertToBackendFormat(),
                {
                    useAI,
                    analyzeScreenshots: this.analyzeScreenshotsCheckbox.checked,
                }
            );

            this.displayTutorial(tutorial);
            this.switchTab("tutorial");
        } catch (error) {
            this.showError(error.message || "Erro desconhecido");
        } finally {
            this.showLoading(false);
        }
    }

    displayTutorial(tutorial) {
        const stepsHtml = tutorial.steps
            .map(
                (step, index) => `
            <div class="tutorial-step">
                <div class="step-number">${index + 1}</div>
                <div class="step-description">${step.instruction}</div>
                ${this.formatStepDetails(step)}
                ${step.screenshot ? `<div class="tutorial-screenshot"><img src="${step.screenshot}" alt="Screenshot do passo" class="screenshot-img"></div>` : ''}
            </div>
        `
            )
            .join("");

        const html = `
            <div class="tutorial-header">
                <h2>${tutorial.title}</h2>
                <p class="tutorial-summary">${tutorial.summary}</p>
            </div>
            <div class="tutorial-steps">
                ${stepsHtml}
            </div>
        `;

        this.tutorialContainer.innerHTML = html;
    }

    formatStepDetails(step) {
        if (!step.details || Object.keys(step.details).length === 0) {
            return "";
        }

        const details = Object.entries(step.details)
            .map(([key, value]) => `<div class="step-detail">${key}: ${value}</div>`)
            .join("");

        return `<div class="step-details">${details}</div>`;
    }

    clearTutorial() {
        this.tutorialContainer.innerHTML =
            '<div class="empty-state"><p>Nenhum tutorial gerado ainda.<br>Capture eventos e clique em "Gerar Tutorial".</p></div>';
    }

    showLoading(show) {
        if (show) {
            this.loadingSpinner.classList.remove("hidden");
        } else {
            this.loadingSpinner.classList.add("hidden");
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove("hidden");
    }

    clearError() {
        this.errorMessage.classList.add("hidden");
    }

    async checkBackendHealth() {
        try {
            const isHealthy = await this.uploader.checkHealth();
            if (!isHealthy) {
                console.warn(
                    "Backend não está respondendo. Verifique a URL e tente novamente."
                );
            }
        } catch (error) {
            console.error("Erro ao verificar saúde do backend:", error);
        }
    }

    saveSettings() {
        const settings = {
            backendUrl: this.backendUrlInput.value,
            useAI: this.useAICheckbox.checked,
            captureScreenshots: this.captureScreenshotsCheckbox.checked,
            analyzeScreenshots: this.analyzeScreenshotsCheckbox.checked,
        };

        localStorage.setItem("tutorialGeneratorSettings", JSON.stringify(settings));
        this.uploader.setBackendUrl(this.backendUrlInput.value);
        alert("Configurações salvas com sucesso!");
    }

    loadSettings() {
        const saved = localStorage.getItem("tutorialGeneratorSettings");
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                setTimeout(() => {
                    if (settings.backendUrl) {
                        this.backendUrlInput.value = settings.backendUrl;
                        this.uploader.setBackendUrl(settings.backendUrl);
                    }
                    if (settings.useAI !== undefined) {
                        this.useAICheckbox.checked = settings.useAI;
                    }
                    if (settings.captureScreenshots !== undefined) {
                        this.captureScreenshotsCheckbox.checked = settings.captureScreenshots;
                    }
                    if (settings.analyzeScreenshots !== undefined) {
                        this.analyzeScreenshotsCheckbox.checked = settings.analyzeScreenshots;
                    }
                }, 100);
            } catch (error) {
                console.error("Erro ao carregar configurações:", error);
            }
        }
    }
}

// Inicializa a aplicação
document.addEventListener("DOMContentLoaded", async () => {
    const app = new TutorialGeneratorApp();
    await app.init();
});
