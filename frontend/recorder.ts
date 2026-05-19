/**
 * Event Recorder - Captura eventos do usuário
 * Monitora clicks, digitação, teclado especial, scroll e drag
 */

interface RecordedEvent {
    type: string;
    timestamp: number;
    details: Record<string, any>;
    screenshot?: string;
}

interface ActionDetails {
    x?: number;
    y?: number;
    button?: string;
    key?: string;
    text?: string;
    target?: string;
    scrollX?: number;
    scrollY?: number;
}

enum ActionType {
    CLICK = "click",
    TYPE = "type",
    SPECIAL_KEY = "special_key",
    NAVIGATION = "navigation",
    SCROLL = "scroll",
    DRAG = "drag",
    UNKNOWN = "unknown",
}

class EventRecorder {
    private events: RecordedEvent[] = [];
    private isRecording = false;
    private startTime = 0;
    private lastTypingTime = 0;
    private currentTypingText = "";
    private typingTimeout: number | null = null;
    private dragStart: { x: number; y: number } | null = null;
    private onEventAdded: ((event: RecordedEvent) => void) | null = null;
    // Captura de tela (janela real)
    private screenStream: MediaStream | null = null;
    private videoEl: HTMLVideoElement | null = null;
    private canvasEl: HTMLCanvasElement | null = null;

    private specialKeys = new Set([
        "enter", "tab", "escape", "backspace", "delete",
        "home", "end", "pageup", "pagedown",
        "arrowup", "arrowdown", "arrowleft", "arrowright",
        "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
    ]);

    private modifierKeys = new Set([
        "shift", "ctrl", "control", "alt", "meta", "super", "capslock",
    ]);

    constructor() {}

    /**
     * Inicia a gravação de eventos
     */
    async startRecording(): Promise<void> {
        if (this.isRecording) return;

        this.isRecording = true;
        this.startTime = Date.now();
        this.events = [];
        this.currentTypingText = "";

        // Tenta iniciar captura da tela (janela real). Se o usuário negar, continua sem screenshots.
        try {
            await this.startScreenCapture();
        } catch (err) {
            // ignore
        }

        // Registra listeners
        document.addEventListener("click", this.onClickEvent.bind(this));
        document.addEventListener("keydown", this.onKeyDownEvent.bind(this));
        document.addEventListener("keyup", this.onKeyUpEvent.bind(this));
        document.addEventListener("scroll", this.onScrollEvent.bind(this));
        document.addEventListener("mousedown", this.onMouseDownEvent.bind(this));
        document.addEventListener("mouseup", this.onMouseUpEvent.bind(this));
    }

    /**
     * Para a gravação de eventos
     */
    stopRecording(): void {
        if (!this.isRecording) return;

        this.isRecording = false;

        // Finaliza digitação pendente
        if (this.currentTypingText) {
            this.addTypeEvent(this.currentTypingText);
        }

        // Remove listeners
        document.removeEventListener("click", this.onClickEvent.bind(this));
        document.removeEventListener("keydown", this.onKeyDownEvent.bind(this));
        document.removeEventListener("keyup", this.onKeyUpEvent.bind(this));
        document.removeEventListener("scroll", this.onScrollEvent.bind(this));
        document.removeEventListener("mousedown", this.onMouseDownEvent.bind(this));
        document.removeEventListener("mouseup", this.onMouseUpEvent.bind(this));

        // Para captura de tela se estiver ativa
        this.stopScreenCapture();
    }

    /**
     * Limpa todos os eventos registrados
     */
    clearEvents(): void {
        this.events = [];
        this.currentTypingText = "";
    }

    /**
     * Retorna todos os eventos gravados
     */
    getEvents(): RecordedEvent[] {
        return [...this.events];
    }

    /**
     * Retorna o tempo total de gravação em ms
     */
    getRecordingDuration(): number {
        return this.startTime ? Date.now() - this.startTime : 0;
    }

    /**
     * Define callback para quando um novo evento é adicionado
     */
    onEventAdded(callback: (event: RecordedEvent) => void): void {
        this.onEventAdded = callback;
    }

    // =========================================================================
    // Handlers de Eventos
    // =========================================================================

    private onClickEvent(e: MouseEvent): void {
        if (!this.isRecording) return;

        const target = e.target as HTMLElement;
        const details: ActionDetails = {
            x: e.clientX,
            y: e.clientY,
            button: e.button === 0 ? "left" : e.button === 1 ? "middle" : "right",
            target: this.getElementSelector(target),
        };

        this.addEvent(ActionType.CLICK, details);
    }

    private onKeyDownEvent(e: KeyboardEvent): void {
        if (!this.isRecording) return;

        const key = e.key.toLowerCase();

        // Ignora teclas modificadoras sozinhas
        if (this.modifierKeys.has(key)) {
            return;
        }

        // Teclas especiais (enter, tab, etc)
        if (this.specialKeys.has(key)) {
            const specialKey = key === "enter" ? "return" : key;
            const details: ActionDetails = {
                key: specialKey,
            };

            // Adiciona modificadores se pressionados
            if (e.ctrlKey) details.key = "ctrl+" + specialKey;
            if (e.altKey) details.key = "alt+" + specialKey;
            if (e.shiftKey) details.key = "shift+" + specialKey;
            if (e.metaKey) details.key = "meta+" + specialKey;

            this.addEvent(ActionType.SPECIAL_KEY, details);
            return;
        }

        // Caracteres normais - acumula em tipagem
        if (e.key.length === 1) {
            this.currentTypingText += e.key;

            // Limpa timer anterior e cria novo
            if (this.typingTimeout !== null) {
                clearTimeout(this.typingTimeout);
            }

            // Espera 500ms sem digitação para considerar fim da entrada
            this.typingTimeout = window.setTimeout(() => {
                if (this.currentTypingText) {
                    this.addTypeEvent(this.currentTypingText);
                    this.currentTypingText = "";
                }
            }, 500);
        }
    }

    private onKeyUpEvent(e: KeyboardEvent): void {
        // Não faz nada aqui por enquanto
    }

    private onScrollEvent(e: Event): void {
        if (!this.isRecording) return;

        const details: ActionDetails = {
            scrollX: window.scrollX,
            scrollY: window.scrollY,
        };

        this.addEvent(ActionType.SCROLL, details);
    }

    private onMouseDownEvent(e: MouseEvent): void {
        if (!this.isRecording) return;
        this.dragStart = { x: e.clientX, y: e.clientY };
    }

    private onMouseUpEvent(e: MouseEvent): void {
        if (!this.isRecording || !this.dragStart) return;

        const distance = Math.sqrt(
            Math.pow(e.clientX - this.dragStart.x, 2) +
            Math.pow(e.clientY - this.dragStart.y, 2)
        );

        // Se moveu mais de 10px, considera drag
        if (distance > 10) {
            const details: ActionDetails = {
                x: this.dragStart.x,
                y: this.dragStart.y,
                target: this.getElementSelector(e.target as HTMLElement),
            };

            this.addEvent(ActionType.DRAG, details);
        }

        this.dragStart = null;
    }

    // =========================================================================
    // Métodos Auxiliares
    // =========================================================================

    private addTypeEvent(text: string): void {
        const details: ActionDetails = { text };
        this.addEvent(ActionType.TYPE, details);
    }

    private addEvent(type: ActionType, details: ActionDetails): void {
        if (!this.isRecording) return;

        const event: RecordedEvent = {
            type,
            timestamp: Date.now() - this.startTime,
            details,
        };

        // Se houver fluxo de tela, captura um frame e anexa ao evento (não bloqueante)
        if (this.screenStream && this.videoEl) {
            this.captureScreenshot().then(dataUrl => {
                if (dataUrl) {
                    event.screenshot = dataUrl;
                }
                this.events.push(event);
                if (this.onEventAdded) this.onEventAdded(event);
            }).catch(() => {
                this.events.push(event);
                if (this.onEventAdded) this.onEventAdded(event);
            });
        } else {
            this.events.push(event);
            if (this.onEventAdded) this.onEventAdded(event);
        }
    }

    // =========================================================================
    // Captura de tela (janela real)
    // =========================================================================

    private async startScreenCapture(): Promise<void> {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new Error("getDisplayMedia não suportado");
        }

        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
        this.screenStream = stream;

        // Elementos escondidos para desenhar frames
        this.videoEl = document.createElement("video");
        this.videoEl.style.display = "none";
        this.videoEl.autoplay = true;
        this.videoEl.srcObject = stream;
        // Não adicionamos ao DOM visível

        this.canvasEl = document.createElement("canvas");

        // Espera o vídeo pronto
        await new Promise<void>((resolve, reject) => {
            const onLoaded = () => {
                resolve();
            };
            this.videoEl!.addEventListener("loadedmetadata", onLoaded);
            // Timeout caso não carregue
            setTimeout(() => resolve(), 1000);
        });
    }

    private stopScreenCapture(): void {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(t => t.stop());
            this.screenStream = null;
        }

        if (this.videoEl) {
            try {
                this.videoEl.pause();
                // @ts-ignore
                this.videoEl.srcObject = null;
            } catch (e) {}
            this.videoEl = null;
        }

        this.canvasEl = null;
    }

    private async captureScreenshot(): Promise<string | null> {
        if (!this.videoEl || !this.canvasEl) return null;

        const video = this.videoEl;
        const canvas = this.canvasEl;

        const w = video.videoWidth || 1280;
        const h = video.videoHeight || 720;
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        try {
            ctx.drawImage(video, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/png");
            return dataUrl;
        } catch (err) {
            return null;
        }
    }

    /**
     * Gera um seletor CSS para um elemento
     */
    private getElementSelector(element: HTMLElement): string {
        if (element.id) {
            return "#" + element.id;
        }

        if (element.className) {
            return element.tagName.toLowerCase() + "." + element.className.split(" ").join(".");
        }

        return element.tagName.toLowerCase();
    }

    /**
     * Converte eventos para o formato esperado pelo backend
     */
    convertToBackendFormat(): any[] {
        return this.events.map(event => ({
            type: event.type,
            timestamp: event.timestamp,
            details: event.details,
        }));
    }
}

export { EventRecorder, RecordedEvent, ActionType, ActionDetails };
