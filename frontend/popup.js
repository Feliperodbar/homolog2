(function () {
    const extensionApi = globalThis.browser || globalThis.chrome;
    const openAppButton = document.getElementById("openApp");
    const startCaptureButton = document.getElementById("startCapture");
    const statusEl = document.getElementById("status");

    if (!openAppButton || !startCaptureButton || !statusEl) {
        return;
    }

    openAppButton.addEventListener("click", () => {
        const url = extensionApi?.runtime?.getURL
            ? extensionApi.runtime.getURL("index.html")
            : "index.html";
        window.open(url, "_blank", "noopener,noreferrer");
    });

    startCaptureButton.addEventListener("click", async () => {
        statusEl.textContent = "Solicitando permissão de captura...";

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error("getDisplayMedia não suportado neste navegador");
            }

            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            stream.getTracks().forEach((track) => track.stop());
            statusEl.textContent =
                "Permissão concedida. Você pode abrir a aplicação completa para iniciar a gravação.";
        } catch (error) {
            statusEl.textContent = "Permissão negada ou erro durante a captura.";
        }
    });
})();