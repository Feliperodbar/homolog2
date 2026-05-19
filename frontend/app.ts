/**
 * Tutorial Generator - Aplicação Frontend
 * Orquestra o recorder de eventos e uploader para o backend
 */

import { EventRecorder, RecordedEvent, ActionType } from "./recorder";
import { BackendUploader, GeneratedTutorial } from "./uploader";

class TutorialGeneratorApp {
    private recorder: EventRecorder;
    private uploader: BackendUploader;
    private recordingStartTime = 0;
    private timerInterval: number | null = null;

    // Elementos DOM
    private startBtn!: HTMLButtonElement;
    private stopBtn!: HTMLButtonElement;
    private clearBtn!: HTMLButtonElement;
    private exportBtn!: HTMLButtonElement;
    private generateBtn!: HTMLButtonElement;
    private generateHeuristicBtn!: HTMLButtonElement;
    private saveSettingsBtn!: HTMLButtonElement;
    private recordingStatus!: HTMLElement;
    private eventsList!: HTMLElement;
    private tutorialContainer!: HTMLElement;
    private eventCount!: HTMLElement;
    private recordingTime!: HTMLElement;
    private loadingSpinner!: HTMLElement;
    private errorMessage!: HTMLElement;
    private backendUrlInput!: HTMLInputElement;
    private useAICheckbox!: HTMLInputElement;
    private analyzeScreenshotsCheckbox!: HTMLInputElement;

    constructor() {
        this.recorder = new EventRecorder();
        this.uploader = new BackendUploader();
        this.loadSettings();
    }

    /**
     * Inicializa a aplicação
     */
    async init(): Promise<void> {
        this.cacheElements();
        this.setupEventListeners();
        this.checkBackendHealth();
    }

    /**
     * Cache de elementos DOM
     */
    private cacheElements(): void {
        this.startBtn = document.getElementById("startBtn") as HTMLButtonElement;
        this.stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
        this.clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;
        this.exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;
        this.generateBtn = document.getElementById(
            "generateBtn"
        ) as HTMLButtonElement;
        this.generateHeuristicBtn = document.getElementById(
            "generateHeuristicBtn"
        ) as HTMLButtonElement;
        this.saveSettingsBtn = document.getElementById(
            "saveSettingsBtn"
        ) as HTMLButtonElement;
        this.recordingStatus = document.getElementById(
            "recordingStatus"
        ) as HTMLElement;
        this.eventsList = document.getElementById("eventsList") as HTMLElement;
        this.tutorialContainer = document.getElementById(
            "tutorialContainer"
        ) as HTMLElement;
        this.eventCount = document.getElementById("eventCount") as HTMLElement;
        this.recordingTime = document.getElementById(
            "recordingTime"
        ) as HTMLElement;
        this.loadingSpinner = document.getElementById(
            "loadingSpinner"
        ) as HTMLElement;
        this.errorMessage = document.getElementById(
            "errorMessage"
        ) as HTMLElement;
        this.backendUrlInput = document.getElementById(
            "backendUrl"
        ) as HTMLInputElement;
        this.useAICheckbox = document.getElementById(
            "useAI"
        ) as HTMLInputElement;
        this.analyzeScreenshotsCheckbox = document.getElementById(
            "analyzeScreenshots"
        ) as HTMLInputElement;
    }

    /**
     * Configura event listeners
     */
    private setupEventListeners(): void {
        this.startBtn.addEventListener("click", async () => await this.startRecording());
        this.stopBtn.addEventListener("click", () => this.stopRecording());
        this.clearBtn.addEventListener("click", () => this.clearEvents());
        this.exportBtn.addEventListener("click", () => this.exportEvents());
        this.generateBtn.addEventListener("click", () => this.generateTutorial(true));
        this.generateHeuristicBtn.addEventListener("click", () =>
            this.generateTutorial(false)
        );
        this.saveSettingsBtn.addEventListener("click", () => this.saveSettings());

        // Tabs
        document.querySelectorAll(".tab-button").forEach(button => {
            button.addEventListener("click", (e) => {
                const target = e.target as HTMLElement;
                const tabName = target.dataset.tab;
                if (tabName) this.switchTab(tabName);
            });
        });

        // Callback do recorder para atualizar UI
        this.recorder.onEventAdded((event: RecordedEvent) => {
            this.updateEventsList();
            this.updateEventCount();
        });
    }

    /**
     * Alterna entre abas
     */
    private switchTab(tabName: string): void {
        // Remove active de todos os tab-buttons e tab-content
        document.querySelectorAll(".tab-button").forEach(btn => {
            btn.classList.remove("active");
        });
        document.querySelectorAll(".tab-content").forEach(content => {
            content.classList.remove("active");
        });

        // Adiciona active no selecionado
        document
            .querySelector(`[data-tab="${tabName}"]`)
            ?.classList.add("active");
        document.getElementById(`${tabName}-tab`)?.classList.add("active");
    }

    /**
     * Inicia a gravação
     */
    private async startRecording(): Promise<void> {
        try {
            await this.recorder.startRecording();
        } catch (err) {
            console.warn("Não foi possível iniciar captura da tela:", err);
        }

        this.recordingStartTime = Date.now();
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.recordingStatus.className = "status-badge status-recording";
        this.recordingStatus.innerHTML =
            '<span class="status-dot"></span> GRAVANDO';

        this.startTimer();
    }

    /**
     * Para a gravação
     */
    private stopRecording(): void {
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

    /**
     * Inicia timer de tempo de gravação
     */
    private startTimer(): void {
        this.timerInterval = window.setInterval(() => {
            const duration = Date.now() - this.recordingStartTime;
            const hours = Math.floor(duration / 3600000);
            const minutes = Math.floor((duration % 3600000) / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);

            this.recordingTime.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }, 100);
    }

    /**
     * Limpa os eventos
     */
    private clearEvents(): void {
        if (confirm("Tem certeza que deseja limpar todos os eventos?")) {
            this.recorder.clearEvents();
            this.updateEventsList();
            this.updateEventCount();
            this.clearTutorial();
        }
    }

    /**
     * Exporta os eventos como JSON
     */
    private exportEvents(): void {
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

    /**
     * Atualiza a lista de eventos na UI
     */
    private updateEventsList(): void {
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

    /**
     * Formata um evento para exibição
     */
    private formatEventItem(event: RecordedEvent, index: number): string {
        const typeLabel = event.type.toUpperCase().replace("_", " ");
        const timestamp = new Date(event.timestamp).toLocaleTimeString();
        const description = this.getEventDescription(event);
        const detailsJson = JSON.stringify(event.details, null, 2);

        return `
            <div class="event-item">
                <div class="event-content">
                    <div class="event-type ${event.type}">${typeLabel}</div>
                    <div class="event-description">${description}</div>
                    <div class="event-details"><pre>${detailsJson}</pre></div>
                </div>
                <div class="event-timestamp">${timestamp}</div>
            </div>
        `;
    }

    /**
     * Gera descrição legível do evento
     */
    private getEventDescription(event: RecordedEvent): string {
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

    /**
     * Atualiza o contador de eventos
     */
    private updateEventCount(): void {
        const events = this.recorder.getEvents();
        this.eventCount.textContent = String(events.length);
    }

    /**
     * Gera um tutorial a partir dos eventos
     */
    private async generateTutorial(useAI: boolean): Promise<void> {
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
            this.showError(
                error instanceof Error ? error.message : "Erro desconhecido"
            );
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Exibe o tutorial gerado
     */
    private displayTutorial(tutorial: GeneratedTutorial): void {
        const stepsHtml = tutorial.steps
            .map(
                (step, index) => `
            <div class="tutorial-step">
                <div class="step-number">${index + 1}</div>
                <div class="step-description">${step.instruction}</div>
                ${this.formatStepDetails(step)}
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

    /**
     * Formata detalhes de um passo
     */
    private formatStepDetails(step: any): string {
        if (!step.details || Object.keys(step.details).length === 0) {
            return "";
        }

        const details = Object.entries(step.details)
            .map(([key, value]) => `<div class="step-detail">${key}: ${value}</div>`)
            .join("");

        return `<div class="step-details">${details}</div>`;
    }

    /**
     * Limpa o tutorial
     */
    private clearTutorial(): void {
        this.tutorialContainer.innerHTML =
            '<div class="empty-state"><p>Nenhum tutorial gerado ainda.<br>Capture eventos e clique em "Gerar Tutorial".</p></div>';
    }

    /**
     * Mostra/esconde o spinner de loading
     */
    private showLoading(show: boolean): void {
        if (show) {
            this.loadingSpinner.classList.remove("hidden");
        } else {
            this.loadingSpinner.classList.add("hidden");
        }
    }

    /**
     * Mostra mensagem de erro
     */
    private showError(message: string): void {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove("hidden");
    }

    /**
     * Limpa mensagem de erro
     */
    private clearError(): void {
        this.errorMessage.classList.add("hidden");
    }

    /**
     * Verifica saúde do backend
     */
    private async checkBackendHealth(): Promise<void> {
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

    /**
     * Salva as configurações no localStorage
     */
    private saveSettings(): void {
        const settings = {
            backendUrl: this.backendUrlInput.value,
            useAI: this.useAICheckbox.checked,
            analyzeScreenshots: this.analyzeScreenshotsCheckbox.checked,
        };

        localStorage.setItem("tutorialGeneratorSettings", JSON.stringify(settings));
        this.uploader.setBackendUrl(this.backendUrlInput.value);
        alert("Configurações salvas com sucesso!");
    }

    /**
     * Carrega as configurações do localStorage
     */
    private loadSettings(): void {
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

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", async () => {
    const app = new TutorialGeneratorApp();
    await app.init();
});
