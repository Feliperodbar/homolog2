"""
Action Processor

Responsible for:
- Normalising raw UserAction objects
- Grouping consecutive typing keystrokes into a single "type" event
- Collapsing redundant or near-duplicate events
- Producing a clean, reduced list of logical steps ready for tutorial generation
"""

from __future__ import annotations

from typing import Sequence

from .models import ActionType, UserAction


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MODIFIER_KEYS = frozenset(
    {
        "shift", "ctrl", "control", "alt", "meta", "super",
        "capslock", "numlock", "scrolllock",
    }
)

_NAVIGATION_KEYS = frozenset(
    {
        "return", "enter", "tab", "escape", "esc",
        "backspace", "delete", "home", "end",
        "pageup", "pagedown", "arrowup", "arrowdown", "arrowleft", "arrowright",
        "f1", "f2", "f3", "f4", "f5", "f6",
        "f7", "f8", "f9", "f10", "f11", "f12",
    }
)


def _key_label(key: str) -> str:
    """Return a human-readable label for a special key."""
    labels: dict[str, str] = {
        "return": "Enter",
        "enter": "Enter",
        "tab": "Tab",
        "escape": "Esc",
        "esc": "Esc",
        "backspace": "Backspace",
        "delete": "Delete",
        "home": "Home",
        "end": "End",
        "pageup": "Page Up",
        "pagedown": "Page Down",
        "arrowup": "↑",
        "arrowdown": "↓",
        "arrowleft": "←",
        "arrowright": "→",
    }
    k = key.lower()
    return labels.get(k, key.capitalize())


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


class ActionGroup:
    """
    A logical group of one or more UserActions that describe a single
    coherent user intention (e.g., typing a full word, performing a click).
    """

    def __init__(self, action_type: ActionType, screenshot: str | None = None):
        self.action_type: ActionType = action_type
        self.actions: list[UserAction] = []
        self.screenshot: str | None = screenshot

    def add(self, action: UserAction) -> None:
        self.actions.append(action)
        # Keep the *latest* screenshot so we capture the state after the group
        if action.screenshot:
            self.screenshot = action.screenshot

    @property
    def last_action(self) -> UserAction:
        return self.actions[-1]

    @property
    def first_action(self) -> UserAction:
        return self.actions[0]

    # -- Derived helpers -------------------------------------------------

    @property
    def typed_text(self) -> str:
        """Concatenated text from all type-actions in the group."""
        parts: list[str] = []
        for a in self.actions:
            if a.details.text:
                parts.append(a.details.text)
            elif a.details.key:
                parts.append(a.details.key)
        return "".join(parts)

    @property
    def special_key_label(self) -> str:
        """Human-readable label for a special-key group."""
        keys: list[str] = []
        for a in self.actions:
            k = (a.details.key or "").strip()
            if k and k.lower() not in _MODIFIER_KEYS:
                keys.append(_key_label(k))
        return " + ".join(keys) if keys else ""

    @property
    def navigation_url(self) -> str:
        """URL (or path) from a navigation action."""
        for a in self.actions:
            url = a.details.text or a.details.key or ""
            if url:
                return url
        return ""


# ---------------------------------------------------------------------------


class ActionProcessor:
    """
    Converts a flat list of UserAction events into a condensed list of
    ActionGroup objects by merging consecutive related events.
    """

    def process(self, actions: Sequence[UserAction]) -> list[ActionGroup]:
        """
        Process the raw action list and return logical ActionGroups.

        Grouping rules
        --------------
        - Consecutive ``type`` actions are merged into one group.
        - Consecutive ``special_key`` actions whose key is a *modifier*
          (Shift, Ctrl, …) are merged with the next non-modifier key.
        - All other action types start a new group.
        """
        if not actions:
            return []

        groups: list[ActionGroup] = []
        current: ActionGroup | None = None

        for action in actions:
            action_type = action.action

            if current is None:
                current = ActionGroup(action_type, action.screenshot)
                current.add(action)
                continue

            # Merge consecutive typing
            if action_type == ActionType.type and current.action_type == ActionType.type:
                current.add(action)
                continue

            # Merge modifier keys with the following keystroke
            if action_type == ActionType.special_key:
                key = (action.details.key or "").lower()
                if key in _MODIFIER_KEYS and current.action_type == ActionType.special_key:
                    current.add(action)
                    continue

            # Everything else → new group
            groups.append(current)
            current = ActionGroup(action_type, action.screenshot)
            current.add(action)

        if current is not None:
            groups.append(current)

        return groups
