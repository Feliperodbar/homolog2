/**
 * Uploader - Comunicação com o servidor backend
 * Envia eventos para processar e recebe tutoriais gerados
 */

interface AiGenerationOptions {
    useAI: boolean;
    analyzeScreenshots: boolean;
    model?: string;
}

interface GeneratedTutorial {
    title: string;
    summary: string;
    steps: TutorialStep[];
}

interface TutorialStep {
    action_type: string;
    instruction: string;
    details?: Record<string, any>;
}

class BackendUploader {
    private backendUrl: string;
    private timeout: number = 30000; // 30 segundos

    constructor(backendUrl: string = "http://localhost:5000") {
        this.backendUrl = backendUrl.replace(/\/$/, ""); // Remove trailing slash
    }

    setBackendUrl(url: string): void {
        this.backendUrl = url.replace(/\/$/, "");
    }

    /**
     * Gera um tutorial a partir dos eventos capturados
     */
    async generateTutorial(
        events: any[],
        options: AiGenerationOptions
    ): Promise<GeneratedTutorial> {
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

            const tutorial: GeneratedTutorial = await response.json();
            return tutorial;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Falha ao gerar tutorial: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Verifica a disponibilidade do servidor
     */
    async checkHealth(): Promise<boolean> {
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

    /**
     * Obtém informações sobre o servidor
     */
    async getServerInfo(): Promise<Record<string, any>> {
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
            throw new Error(
                `Falha ao obter informações do servidor: ${error}`
            );
        }
    }

    /**
     * Realiza fetch com timeout
     */
    private fetchWithTimeout(
        url: string,
        options: RequestInit = {}
    ): Promise<Response> {
        return Promise.race([
            fetch(url, options),
            new Promise<Response>((_, reject) =>
                setTimeout(
                    () => reject(new Error("Timeout na requisição")),
                    this.timeout
                )
            ),
        ]);
    }

    /**
     * Converte eventos no formato esperado pelo backend
     */
    formatEventsForBackend(events: any[]): any[] {
        return events.map(event => ({
            type: event.type,
            timestamp: event.timestamp,
            details: event.details || {},
        }));
    }
}

export {
    BackendUploader,
    AiGenerationOptions,
    GeneratedTutorial,
    TutorialStep,
};
