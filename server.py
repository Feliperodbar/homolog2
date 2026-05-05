"""
Tutorial Generator - Web Server

Um servidor Flask que:
1. Serve a interface frontend (HTML/CSS/JS)
2. Fornece endpoints de API para processar eventos
3. Integra com o sistema de geração de tutoriais
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from src import TutorialGenerator


# ============================================================================
# Setup
# ============================================================================

# Detecta diretório base
BASE_DIR = Path(__file__).parent
FRONTEND_DIR = BASE_DIR / "frontend"

# Configura logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Cria aplicação Flask
app = Flask(__name__, static_folder=str(FRONTEND_DIR))
CORS(app)


# ============================================================================
# Health Check
# ============================================================================

@app.route("/health", methods=["GET"])
def health_check():
    """Verifica se o servidor está online."""
    return jsonify({"status": "healthy", "service": "tutorial-generator"}), 200


@app.route("/api/info", methods=["GET"])
def server_info():
    """Retorna informações sobre o servidor."""
    return jsonify({
        "name": "Tutorial Generator API",
        "version": "1.0.0",
        "description": "Transforma ações do usuário em tutoriais passo-a-passo",
        "features": [
            "Gravação de eventos",
            "Geração de tutoriais",
            "Análise com IA",
            "Análise de screenshots (opcional)",
        ],
    }), 200


# ============================================================================
# Frontend Routes
# ============================================================================

@app.route("/", methods=["GET"])
def index():
    """Serve a página principal do frontend."""
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>", methods=["GET"])
def serve_static(filename):
    """Serve arquivos estáticos (CSS, JS, etc)."""
    return send_from_directory(FRONTEND_DIR, filename)


# ============================================================================
# API Routes
# ============================================================================

@app.route("/api/generate-tutorial", methods=["POST"])
def generate_tutorial():
    """
    Endpoint para gerar um tutorial a partir dos eventos.

    Request JSON:
    {
        "events": [...],           # Array de eventos capturados
        "use_ai": true,            # Usar IA (OpenAI)
        "analyze_screenshots": false,  # Analisar screenshots
        "model": "gpt-4o"          # Modelo OpenAI (opcional)
    }

    Response JSON:
    {
        "title": "...",
        "summary": "...",
        "steps": [...]
    }
    """
    try:
        data = request.get_json()

        if not data or "events" not in data:
            return jsonify({
                "error": "Falta campo 'events' no payload"
            }), 400

        events = data.get("events", [])
        use_ai = data.get("use_ai", False)
        analyze_screenshots = data.get("analyze_screenshots", False)
        model = data.get("model", "gpt-4o")

        if not events:
            return jsonify({
                "error": "Array de eventos não pode estar vazio"
            }), 400

        # Cria gerador de tutorial
        generator = TutorialGenerator(
            use_ai=use_ai,
            model=model,
            analyze_screenshots=analyze_screenshots,
        )

        # Converte eventos para formato esperado
        events_json = json.dumps(events)

        # Gera tutorial
        logger.info(f"Gerando tutorial com {len(events)} eventos (AI={use_ai})")
        tutorial = generator.generate(events_json)

        # Retorna resultado
        return jsonify(tutorial.to_dict()), 200

    except ValueError as e:
        logger.error(f"Erro de validação: {e}")
        return jsonify({"error": f"Validação falhou: {str(e)}"}), 400
    except Exception as e:
        logger.error(f"Erro ao gerar tutorial: {e}", exc_info=True)
        return jsonify({"error": f"Erro interno: {str(e)}"}), 500


@app.route("/api/events/validate", methods=["POST"])
def validate_events():
    """
    Valida se os eventos estão no formato correto.

    Request JSON:
    {
        "events": [...]
    }

    Response JSON:
    {
        "valid": true,
        "error": null,
        "event_count": 10,
        "summary": "..."
    }
    """
    try:
        data = request.get_json()

        if not data or "events" not in data:
            return jsonify({
                "valid": False,
                "error": "Falta campo 'events' no payload",
            }), 400

        events = data.get("events", [])

        if not events:
            return jsonify({
                "valid": False,
                "error": "Array de eventos não pode estar vazio",
            }), 400

        # Valida cada evento
        from src.models import UserAction, ActionDetails

        valid_events = 0
        for event in events:
            try:
                # Verifica se tem campos obrigatórios
                if not isinstance(event, dict):
                    raise ValueError("Evento deve ser um dicionário")
                if "type" not in event:
                    raise ValueError("Evento deve ter campo 'type'")
                if "details" not in event:
                    event["details"] = {}

                # Tenta criar um objeto UserAction para validar
                UserAction(
                    type=event["type"],
                    timestamp=event.get("timestamp", 0),
                    details=ActionDetails(**event.get("details", {})),
                )
                valid_events += 1
            except Exception as e:
                logger.warning(f"Evento inválido: {e}")
                continue

        return jsonify({
            "valid": valid_events > 0,
            "event_count": len(events),
            "valid_count": valid_events,
            "error": None if valid_events > 0 else "Nenhum evento válido encontrado",
        }), 200

    except Exception as e:
        logger.error(f"Erro ao validar eventos: {e}")
        return jsonify({
            "valid": False,
            "error": str(e),
        }), 500


# ============================================================================
# Error Handling
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    """Trata erros 404."""
    return jsonify({"error": "Recurso não encontrado"}), 404


@app.errorhandler(405)
def method_not_allowed(error):
    """Trata erros 405 (método não permitido)."""
    return jsonify({"error": "Método não permitido"}), 405


@app.errorhandler(500)
def internal_error(error):
    """Trata erros 500."""
    logger.error(f"Erro interno: {error}")
    return jsonify({"error": "Erro interno do servidor"}), 500


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import sys

    # Parse de argumentos simples
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"

    if "--debug" in sys.argv:
        debug = True
    if "--host" in sys.argv:
        idx = sys.argv.index("--host")
        if idx + 1 < len(sys.argv):
            host = sys.argv[idx + 1]
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            port = int(sys.argv[idx + 1])

    logger.info(f"Iniciando Tutorial Generator API em {host}:{port}")
    logger.info(f"Frontend: {FRONTEND_DIR}")
    logger.info(f"Debug mode: {debug}")

    app.run(host=host, port=port, debug=debug)
