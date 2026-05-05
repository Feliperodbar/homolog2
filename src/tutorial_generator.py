"""
Tutorial Generator

Orchestrates the full pipeline:

1. Validate & parse the raw JSON input into UserAction objects.
2. Run ActionProcessor to group related events.
3. (Optionally) Run ScreenshotAnalyzer on each unique screenshot.
4. Build a prompt and call the OpenAI Chat API to produce natural-language
   instructions for each action group.
5. Return a validated Tutorial object.

The generator works in two modes:
  - **AI mode** (default):  requires a configured OpenAI API key.
  - **Offline / rule-based mode**: enabled automatically when no API key is
    available or when ``use_ai=False`` is passed.  Instructions are generated
    from simple heuristics — useful for testing and environments without an
    internet connection.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional, Sequence

from .action_processor import ActionGroup, ActionProcessor
from .models import ActionType, Tutorial, TutorialStep, UserAction
from .screenshot_analyzer import ScreenshotAnalyzer

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Heuristic (offline) instruction builder
# ---------------------------------------------------------------------------


def _heuristic_instruction(group: ActionGroup) -> str:
    """
    Generate a plain-English instruction without calling an external API.
    Used as a fallback when the OpenAI client is unavailable.
    """
    atype = group.action_type

    if atype == ActionType.click:
        button = (group.last_action.details.button or "left").lower()
        if button == "right":
            return "Clique com o botão direito do mouse no elemento desejado."
        if button == "middle":
            return "Clique com o botão do meio do mouse no elemento desejado."
        return "Clique no elemento desejado."

    if atype == ActionType.type:
        text = group.typed_text
        if text:
            return f"Digite \"{text}\"."
        return "Digite o texto no campo."

    if atype == ActionType.special_key:
        label = group.special_key_label
        if label:
            return f"Pressione a tecla {label}."
        return "Pressione a tecla especial."

    if atype == ActionType.navigation:
        url = group.navigation_url
        if url:
            return f"Navegue até: {url}"
        return "Navegue até a página desejada."

    if atype == ActionType.scroll:
        return "Role a página para encontrar o conteúdo desejado."

    if atype == ActionType.drag:
        return "Arraste o elemento para a posição desejada."

    return "Execute a ação indicada na tela."


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
Você é um especialista em criação de tutoriais passo a passo, semelhantes ao \
Scribehow.

Sua tarefa: analisar um grupo de ações registradas do usuário e gerar uma \
instrução clara, amigável e profissional em Português do Brasil, adequada para \
usuários não técnicos.

Regras:
- NÃO mencione coordenadas (x, y).
- Use verbos de ação: Clique, Digite, Selecione, Abra, Navegue, Insira, Pressione.
- Seja conciso (1-2 frases no máximo).
- Infira o elemento da interface com base no contexto (botão, campo, menu, link…).
- Se houver descrição da screenshot, use-a para melhorar a precisão.
- Responda APENAS com a instrução, sem prefixos ou explicações.
"""


def _build_step_prompt(group: ActionGroup, screenshot_description: str) -> str:
    action_info: dict[str, Any] = {
        "type": group.action_type.value,
        "details": {},
    }

    if group.action_type == ActionType.click:
        a = group.last_action
        if a.details.button:
            action_info["details"]["button"] = a.details.button

    elif group.action_type == ActionType.type:
        action_info["details"]["text"] = group.typed_text

    elif group.action_type == ActionType.special_key:
        action_info["details"]["key"] = group.special_key_label or (
            group.last_action.details.key or ""
        )

    elif group.action_type == ActionType.navigation:
        action_info["details"]["url"] = group.navigation_url

    context_parts: list[str] = [
        f"Ação: {json.dumps(action_info, ensure_ascii=False)}",
    ]
    if group.last_action.window:
        context_parts.append(f"Aplicativo/janela: {group.last_action.window}")
    if screenshot_description:
        context_parts.append(f"Interface visível: {screenshot_description}")

    return "\n".join(context_parts)


def _build_title_summary_prompt(instructions: list[str]) -> str:
    steps_text = "\n".join(
        f"{i+1}. {instr}" for i, instr in enumerate(instructions)
    )
    return (
        "Com base nos seguintes passos de um tutorial, gere:\n"
        "1. Um título curto (máximo 10 palavras) para o tutorial.\n"
        "2. Um resumo de 1-2 frases descrevendo o objetivo do tutorial.\n\n"
        "Passos:\n"
        f"{steps_text}\n\n"
        'Responda SOMENTE em JSON com o formato: {"title": "...", "summary": "..."}'
    )


# ---------------------------------------------------------------------------
# TutorialGenerator
# ---------------------------------------------------------------------------


class TutorialGenerator:
    """
    Transform a list of user-interaction events into a structured Tutorial.

    Parameters
    ----------
    api_key:
        OpenAI API key.  If not provided, falls back to the ``OPENAI_API_KEY``
        environment variable.  When neither is available the generator runs in
        offline/heuristic mode.
    model:
        Chat model to use for instruction generation.  Defaults to
        ``"gpt-4o"``.
    vision_model:
        Vision model to use for screenshot analysis.  Defaults to
        ``"gpt-4o"``.
    use_ai:
        Set to *False* to skip all OpenAI calls (forces offline mode).
    analyze_screenshots:
        Set to *True* to enable screenshot analysis via the vision API.
        Disabled by default to reduce latency and cost.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4o",
        vision_model: str = "gpt-4o",
        use_ai: bool = True,
        analyze_screenshots: bool = False,
    ) -> None:
        self._model = model
        self._use_ai = use_ai
        self._analyze_screenshots = analyze_screenshots
        self._client: Optional[object] = None

        resolved_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        if use_ai and resolved_key:
            try:
                import openai  # noqa: PLC0415

                self._client = openai.OpenAI(api_key=resolved_key)
                logger.info("OpenAI client initialized (model=%s).", model)
            except ImportError:
                logger.warning(
                    "openai package not installed. Falling back to offline mode."
                )
        elif use_ai:
            logger.info(
                "OPENAI_API_KEY not set. Running in offline/heuristic mode."
            )

        self._processor = ActionProcessor()
        self._screenshot_analyzer = ScreenshotAnalyzer(
            client=self._client if analyze_screenshots else None,
            model=vision_model,
        )

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def generate(self, events: list[dict[str, Any]] | str) -> Tutorial:
        """
        Generate a Tutorial from raw event data.

        Parameters
        ----------
        events:
            Either a JSON string or a Python list of event dicts, each
            conforming to the UserAction schema.

        Returns
        -------
        Tutorial
            Validated tutorial object.
        """
        # 1. Parse input
        actions = self._parse_events(events)

        # 2. Group actions
        groups = self._processor.process(actions)

        if not groups:
            return Tutorial(
                title="Tutorial vazio",
                steps=[],
                summary="Nenhuma ação registrada.",
            )

        # 3. Analyse screenshots (optional, one call per unique screenshot)
        screenshot_descriptions: dict[str, str] = {}
        if self._analyze_screenshots and self._client is not None:
            seen: set[str] = set()
            for group in groups:
                ss = group.screenshot or ""
                if ss and ss not in seen:
                    seen.add(ss)
                    screenshot_descriptions[ss] = self._screenshot_analyzer.describe(ss)

        # 4. Generate instructions
        steps = self._generate_steps(groups, screenshot_descriptions)

        # 5. Generate title & summary
        title, summary = self._generate_title_summary(
            [s.instruction for s in steps]
        )

        return Tutorial(title=title, steps=steps, summary=summary)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_events(events: list[dict[str, Any]] | str) -> list[UserAction]:
        if isinstance(events, str):
            try:
                events = json.loads(events)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON input: {exc}") from exc

        if not isinstance(events, list):
            raise TypeError(
                f"Expected a list of events, got {type(events).__name__}."
            )

        parsed: list[UserAction] = []
        for i, raw in enumerate(events):
            if not isinstance(raw, dict):
                raise TypeError(
                    f"Event at index {i} must be a dict, got {type(raw).__name__}."
                )
            try:
                parsed.append(UserAction.model_validate(raw))
            except Exception as exc:
                raise ValueError(f"Invalid event at index {i}: {exc}") from exc

        return parsed

    def _generate_steps(
        self,
        groups: list[ActionGroup],
        screenshot_descriptions: dict[str, str],
    ) -> list[TutorialStep]:
        steps: list[TutorialStep] = []

        for idx, group in enumerate(groups, start=1):
            ss = group.screenshot or ""
            description = screenshot_descriptions.get(ss, "")

            if self._client is not None:
                instruction = self._ai_instruction(group, description)
            else:
                instruction = _heuristic_instruction(group)

            steps.append(
                TutorialStep(
                    step_number=idx,
                    instruction=instruction,
                    image=group.screenshot or None,
                )
            )

        return steps

    def _ai_instruction(self, group: ActionGroup, screenshot_description: str) -> str:
        """Call the OpenAI Chat API to generate a single instruction."""
        user_prompt = _build_step_prompt(group, screenshot_description)
        try:
            response = self._client.chat.completions.create(  # type: ignore[attr-defined]
                model=self._model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=128,
                temperature=0.3,
            )
            return response.choices[0].message.content.strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("AI instruction generation failed: %s", exc)
            return _heuristic_instruction(group)

    def _generate_title_summary(
        self, instructions: list[str]
    ) -> tuple[str, str]:
        """Generate the tutorial title and summary from all instructions."""
        if not instructions:
            return "Tutorial", "Tutorial sem passos registrados."

        if self._client is not None:
            try:
                prompt = _build_title_summary_prompt(instructions)
                response = self._client.chat.completions.create(  # type: ignore[attr-defined]
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=200,
                    temperature=0.3,
                    response_format={"type": "json_object"},
                )
                data = json.loads(response.choices[0].message.content)
                title = data.get("title", "Tutorial")
                summary = data.get("summary", "")
                if title and summary:
                    return title, summary
            except Exception as exc:  # noqa: BLE001
                logger.warning("AI title/summary generation failed: %s", exc)

        # Offline fallback
        return self._heuristic_title_summary(instructions)

    @staticmethod
    def _heuristic_title_summary(instructions: list[str]) -> tuple[str, str]:
        """Simple heuristic title & summary when AI is unavailable."""
        n = len(instructions)
        summary = (
            f"Este tutorial guia você através de {n} "
            f"{'passo' if n == 1 else 'passos'} para concluir a tarefa."
        )
        # Try to derive a title from the first meaningful instruction
        first = instructions[0] if instructions else ""
        title = first[:60].rstrip(".") if first else "Tutorial"
        return title, summary
