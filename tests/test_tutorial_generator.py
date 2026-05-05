"""
Tests for the Tutorial Generator pipeline.

All tests run in offline mode (no OpenAI calls) to keep the suite fast
and dependency-free in CI environments.
"""

from __future__ import annotations

import json

import pytest

from src.action_processor import ActionGroup, ActionProcessor
from src.models import (
    ActionDetails,
    ActionType,
    Tutorial,
    TutorialStep,
    UserAction,
)
from src.tutorial_generator import TutorialGenerator, _heuristic_instruction


# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------


def make_action(
    step: int,
    action: str = "click",
    key: str | None = None,
    text: str | None = None,
    button: str | None = None,
    screenshot: str | None = None,
    window: str | None = None,
) -> UserAction:
    return UserAction(
        step=step,
        action=ActionType(action),
        details=ActionDetails(key=key, text=text, button=button),
        screenshot=screenshot,
        window=window,
    )


SAMPLE_EVENTS: list[dict] = [
    {
        "step": 1,
        "action": "click",
        "details": {"x": 100, "y": 200, "button": "left"},
        "screenshot": "step_1.png",
        "timestamp": "2024-01-01T10:00:00Z",
    },
    {
        "step": 2,
        "action": "type",
        "details": {"key": "a"},
        "screenshot": "step_2.png",
        "timestamp": "2024-01-01T10:00:01Z",
    },
    {
        "step": 3,
        "action": "type",
        "details": {"key": "d"},
        "screenshot": "step_2.png",
        "timestamp": "2024-01-01T10:00:02Z",
    },
    {
        "step": 4,
        "action": "type",
        "details": {"key": "m"},
        "screenshot": "step_2.png",
        "timestamp": "2024-01-01T10:00:03Z",
    },
    {
        "step": 5,
        "action": "type",
        "details": {"key": "i"},
        "screenshot": "step_2.png",
        "timestamp": "2024-01-01T10:00:04Z",
    },
    {
        "step": 6,
        "action": "type",
        "details": {"key": "n"},
        "screenshot": "step_2.png",
        "timestamp": "2024-01-01T10:00:05Z",
    },
    {
        "step": 7,
        "action": "special_key",
        "details": {"key": "Return"},
        "screenshot": "step_3.png",
        "timestamp": "2024-01-01T10:00:06Z",
    },
]


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------


class TestModels:
    def test_user_action_defaults(self):
        action = UserAction(step=1)
        assert action.action == ActionType.unknown
        assert action.screenshot is None

    def test_user_action_from_dict(self):
        raw = {
            "step": 1,
            "action": "click",
            "details": {"x": 50, "y": 80, "button": "left"},
            "screenshot": "img.png",
        }
        action = UserAction.model_validate(raw)
        assert action.action == ActionType.click
        assert action.details.x == 50
        assert action.details.button == "left"

    def test_tutorial_step_optional_image(self):
        step = TutorialStep(step_number=1, instruction="Clique aqui.")
        assert step.image is None
        assert step.tip is None

    def test_tutorial_to_dict_excludes_none(self):
        tutorial = Tutorial(
            title="Test",
            steps=[TutorialStep(step_number=1, instruction="Step 1.")],
            summary="Summary.",
        )
        d = tutorial.to_dict()
        assert "title" in d
        assert "steps" in d
        assert "summary" in d
        # None fields should be excluded
        for step in d["steps"]:
            assert "image" not in step
            assert "tip" not in step

    def test_action_type_enum_values(self):
        assert ActionType("click") == ActionType.click
        assert ActionType("type") == ActionType.type
        assert ActionType("navigation") == ActionType.navigation
        assert ActionType("special_key") == ActionType.special_key


# ---------------------------------------------------------------------------
# ActionProcessor tests
# ---------------------------------------------------------------------------


class TestActionProcessor:
    def setup_method(self):
        self.processor = ActionProcessor()

    def test_empty_input(self):
        assert self.processor.process([]) == []

    def test_single_click(self):
        actions = [make_action(1, "click", button="left")]
        groups = self.processor.process(actions)
        assert len(groups) == 1
        assert groups[0].action_type == ActionType.click

    def test_consecutive_typing_merged(self):
        actions = [
            make_action(1, "type", key="h"),
            make_action(2, "type", key="i"),
        ]
        groups = self.processor.process(actions)
        assert len(groups) == 1
        assert groups[0].action_type == ActionType.type
        assert groups[0].typed_text == "hi"

    def test_typing_broken_by_click(self):
        actions = [
            make_action(1, "type", key="a"),
            make_action(2, "click", button="left"),
            make_action(3, "type", key="b"),
        ]
        groups = self.processor.process(actions)
        assert len(groups) == 3

    def test_screenshot_tracks_latest(self):
        actions = [
            make_action(1, "type", key="a", screenshot="s1.png"),
            make_action(2, "type", key="b", screenshot="s2.png"),
        ]
        groups = self.processor.process(actions)
        assert groups[0].screenshot == "s2.png"

    def test_full_sample_events(self):
        parsed = [UserAction.model_validate(e) for e in SAMPLE_EVENTS]
        groups = self.processor.process(parsed)
        # click → 1 group; 5 type events → 1 group; return key → 1 group
        assert len(groups) == 3

    def test_group_typed_text_from_key_field(self):
        actions = [
            make_action(1, "type", key="u"),
            make_action(2, "type", key="s"),
            make_action(3, "type", key="e"),
            make_action(4, "type", key="r"),
        ]
        groups = self.processor.process(actions)
        assert groups[0].typed_text == "user"

    def test_group_typed_text_from_text_field(self):
        actions = [
            UserAction(
                step=1,
                action=ActionType.type,
                details=ActionDetails(text="hello world"),
            )
        ]
        groups = self.processor.process(actions)
        assert groups[0].typed_text == "hello world"

    def test_navigation_action(self):
        actions = [
            UserAction(
                step=1,
                action=ActionType.navigation,
                details=ActionDetails(text="https://example.com"),
            )
        ]
        groups = self.processor.process(actions)
        assert groups[0].navigation_url == "https://example.com"


# ---------------------------------------------------------------------------
# Heuristic instruction tests
# ---------------------------------------------------------------------------


class TestHeuristicInstruction:
    def _group(self, action_type: ActionType, **kwargs) -> ActionGroup:
        group = ActionGroup(action_type)
        action = make_action(1, action_type.value, **kwargs)
        group.add(action)
        return group

    def test_click_left(self):
        group = self._group(ActionType.click, button="left")
        instr = _heuristic_instruction(group)
        assert "Clique" in instr

    def test_click_right(self):
        group = self._group(ActionType.click, button="right")
        instr = _heuristic_instruction(group)
        assert "direito" in instr.lower()

    def test_type_with_text(self):
        group = ActionGroup(ActionType.type)
        group.add(make_action(1, "type", text="admin"))
        instr = _heuristic_instruction(group)
        assert "admin" in instr

    def test_type_with_keys(self):
        actions = [
            make_action(1, "type", key="a"),
            make_action(2, "type", key="b"),
        ]
        group = ActionGroup(ActionType.type)
        for a in actions:
            group.add(a)
        instr = _heuristic_instruction(group)
        assert "ab" in instr

    def test_special_key_enter(self):
        group = self._group(ActionType.special_key, key="Return")
        instr = _heuristic_instruction(group)
        assert "Enter" in instr or "tecla" in instr.lower()

    def test_navigation(self):
        group = ActionGroup(ActionType.navigation)
        group.add(
            UserAction(
                step=1,
                action=ActionType.navigation,
                details=ActionDetails(text="https://example.com"),
            )
        )
        instr = _heuristic_instruction(group)
        assert instr == "Navegue até: https://example.com"

    def test_scroll(self):
        group = self._group(ActionType.scroll)
        instr = _heuristic_instruction(group)
        assert "Role" in instr or "rolar" in instr.lower()

    def test_unknown(self):
        group = self._group(ActionType.unknown)
        instr = _heuristic_instruction(group)
        assert instr  # should not be empty


# ---------------------------------------------------------------------------
# TutorialGenerator (offline mode) tests
# ---------------------------------------------------------------------------


class TestTutorialGeneratorOffline:
    def setup_method(self):
        self.generator = TutorialGenerator(use_ai=False)

    def test_generate_from_list(self):
        tutorial = self.generator.generate(SAMPLE_EVENTS)
        assert isinstance(tutorial, Tutorial)
        assert len(tutorial.steps) > 0
        assert tutorial.title
        assert tutorial.summary

    def test_generate_from_json_string(self):
        json_str = json.dumps(SAMPLE_EVENTS)
        tutorial = self.generator.generate(json_str)
        assert isinstance(tutorial, Tutorial)

    def test_step_count_matches_groups(self):
        """The number of steps should equal the number of logical groups."""
        processor = ActionProcessor()
        parsed = [UserAction.model_validate(e) for e in SAMPLE_EVENTS]
        groups = processor.process(parsed)

        tutorial = self.generator.generate(SAMPLE_EVENTS)
        assert len(tutorial.steps) == len(groups)

    def test_step_numbers_are_sequential(self):
        tutorial = self.generator.generate(SAMPLE_EVENTS)
        numbers = [s.step_number for s in tutorial.steps]
        assert numbers == list(range(1, len(numbers) + 1))

    def test_screenshots_attached_to_steps(self):
        tutorial = self.generator.generate(SAMPLE_EVENTS)
        # At least one step should have an image
        images = [s.image for s in tutorial.steps if s.image]
        assert len(images) > 0

    def test_empty_events_returns_empty_tutorial(self):
        tutorial = self.generator.generate([])
        assert tutorial.steps == []

    def test_invalid_json_raises(self):
        with pytest.raises(ValueError):
            self.generator.generate("not valid json")

    def test_invalid_type_raises(self):
        with pytest.raises(TypeError):
            self.generator.generate({"not": "a list"})  # type: ignore[arg-type]

    def test_invalid_event_raises(self):
        with pytest.raises(ValueError):
            self.generator.generate([{"invalid_field": True}])

    def test_to_dict_output_format(self):
        tutorial = self.generator.generate(SAMPLE_EVENTS)
        d = tutorial.to_dict()
        assert set(d.keys()) >= {"title", "steps", "summary"}
        assert isinstance(d["steps"], list)
        for step in d["steps"]:
            assert "step_number" in step
            assert "instruction" in step

    def test_single_click_event(self):
        events = [
            {
                "step": 1,
                "action": "click",
                "details": {"x": 100, "y": 200, "button": "left"},
                "screenshot": "click.png",
            }
        ]
        tutorial = self.generator.generate(events)
        assert len(tutorial.steps) == 1
        step = tutorial.steps[0]
        assert step.image == "click.png"
        assert "Clique" in step.instruction

    def test_right_click_instruction(self):
        events = [
            {
                "step": 1,
                "action": "click",
                "details": {"x": 100, "y": 200, "button": "right"},
                "screenshot": "click.png",
            }
        ]
        tutorial = self.generator.generate(events)
        assert "direito" in tutorial.steps[0].instruction.lower()

    def test_typing_group_has_text(self):
        events = [
            {"step": 1, "action": "type", "details": {"key": "u"}, "screenshot": "s.png"},
            {"step": 2, "action": "type", "details": {"key": "s"}, "screenshot": "s.png"},
            {"step": 3, "action": "type", "details": {"key": "e"}, "screenshot": "s.png"},
            {"step": 4, "action": "type", "details": {"key": "r"}, "screenshot": "s.png"},
        ]
        tutorial = self.generator.generate(events)
        assert len(tutorial.steps) == 1
        assert "user" in tutorial.steps[0].instruction

    def test_navigation_event(self):
        events = [
            {
                "step": 1,
                "action": "navigation",
                "details": {"text": "https://example.com"},
                "screenshot": "nav.png",
            }
        ]
        tutorial = self.generator.generate(events)
        step_instr = tutorial.steps[0].instruction
        assert step_instr == "Navegue até: https://example.com"

    def test_window_name_preserved_in_action(self):
        events = [
            {
                "step": 1,
                "action": "click",
                "details": {"x": 10, "y": 10, "button": "left"},
                "window": "Google Chrome",
                "screenshot": "chrome.png",
            }
        ]
        parsed = TutorialGenerator._parse_events(events)
        assert parsed[0].window == "Google Chrome"


# ---------------------------------------------------------------------------
# CLI tests
# ---------------------------------------------------------------------------


class TestCLI:
    def test_help_exits_cleanly(self, capsys):
        from main import main

        with pytest.raises(SystemExit) as exc_info:
            main(["--help"])
        assert exc_info.value.code == 0

    def test_no_input_exits_with_error(self, monkeypatch, capsys):
        """Running with no input and a TTY should exit with code 1."""
        import io

        from main import main

        monkeypatch.setattr("sys.stdin", io.StringIO(""))
        monkeypatch.setattr("sys.stdin.isatty", lambda: True)
        result = main([])
        assert result == 1

    def test_generate_from_stdin(self, monkeypatch):
        import io

        from main import main

        monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps(SAMPLE_EVENTS)))
        monkeypatch.setattr("sys.stdin.isatty", lambda: False)
        result = main(["--pretty"])
        assert result == 0

    def test_invalid_json_from_stdin(self, monkeypatch):
        import io

        from main import main

        monkeypatch.setattr("sys.stdin", io.StringIO("not json"))
        monkeypatch.setattr("sys.stdin.isatty", lambda: False)
        result = main([])
        assert result == 1

    def test_output_to_file(self, tmp_path, monkeypatch):
        import io

        from main import main

        out_file = tmp_path / "tutorial.json"
        monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps(SAMPLE_EVENTS)))
        monkeypatch.setattr("sys.stdin.isatty", lambda: False)
        result = main(["--output", str(out_file)])
        assert result == 0
        assert out_file.exists()
        data = json.loads(out_file.read_text())
        assert "title" in data
        assert "steps" in data
        assert "summary" in data

    def test_input_from_file(self, tmp_path):
        from main import main

        in_file = tmp_path / "events.json"
        in_file.write_text(json.dumps(SAMPLE_EVENTS), encoding="utf-8")
        result = main(["--input", str(in_file), "--pretty"])
        assert result == 0

    def test_missing_input_file_exits_with_error(self):
        from main import main

        result = main(["--input", "/nonexistent/path/events.json"])
        assert result == 1
