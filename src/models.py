"""
Data models for the Tutorial Generator.

Defines the input format (UserAction) and output format (Tutorial/TutorialStep)
using Pydantic for validation.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class ActionType(str, Enum):
    """Supported user-action types recorded in the interaction log."""

    click = "click"
    type = "type"
    special_key = "special_key"
    navigation = "navigation"
    scroll = "scroll"
    drag = "drag"
    unknown = "unknown"


# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------


class ActionDetails(BaseModel):
    """Variable details attached to a single user action."""

    # Pointer / click details
    x: Optional[float] = None
    y: Optional[float] = None
    button: Optional[str] = None

    # Keyboard details
    key: Optional[str] = None
    text: Optional[str] = None          # accumulated text for a typing burst

    # Any extra fields the recorder may include
    model_config = {"extra": "allow"}


class UserAction(BaseModel):
    """A single recorded user-interaction event."""

    step: int = Field(..., description="Sequential step number (1-based).")
    action: ActionType = Field(
        default=ActionType.unknown,
        description="Category of action performed.",
    )
    details: ActionDetails = Field(default_factory=ActionDetails)
    screenshot: Optional[str] = Field(
        None,
        description="Path or URL to the screenshot captured after this action.",
    )
    timestamp: Optional[str] = Field(
        None,
        description="ISO-8601 timestamp of the action.",
    )
    window: Optional[str] = Field(
        None,
        description="Name of the active window / application.",
    )

    model_config = {"extra": "allow"}


# ---------------------------------------------------------------------------
# Output models
# ---------------------------------------------------------------------------


class TutorialStep(BaseModel):
    """One step inside the generated tutorial."""

    step_number: int
    instruction: str = Field(..., description="Human-friendly instruction text.")
    image: Optional[str] = Field(
        None,
        description="Screenshot associated with this step.",
    )
    tip: Optional[str] = Field(
        None,
        description="Optional helpful tip for the user.",
    )


class Tutorial(BaseModel):
    """Complete generated tutorial returned by TutorialGenerator."""

    title: str = Field(..., description="Short descriptive title of the tutorial.")
    steps: list[TutorialStep] = Field(
        ...,
        description="Ordered list of tutorial steps.",
    )
    summary: str = Field(
        ...,
        description="Brief description of what the tutorial accomplishes.",
    )

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True)
