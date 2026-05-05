# Tutorial Generator

An AI-powered system that transforms structured user-interaction logs into
step-by-step tutorials — similar to [Scribehow](https://scribehow.com).

---

## Overview

The system reads a JSON array of recorded user actions (clicks, keystrokes,
navigation events, etc.), groups related actions, analyses optional
screenshots using vision AI, and produces a clean, professional tutorial in
structured JSON format.

---

## Features

- **Action grouping** — consecutive keystrokes are merged into a single
  "type" step; modifier keys are combined with the following keystroke.
- **Heuristic (offline) mode** — works without an API key using built-in
  rules; perfect for testing and CI.
- **AI mode** — uses OpenAI GPT-4o to generate natural-language instructions
  in Brazilian Portuguese.
- **Screenshot analysis** (optional) — sends screenshots to the OpenAI
  vision API to identify UI elements and improve instruction accuracy.
- **Structured JSON output** — matches the expected `{ title, steps[], summary }` schema.

---

## Web Interface (Frontend)

A modern web interface for capturing user interactions in real-time and generating tutorials:

```bash
# Install dependencies
pip install -r requirements.txt

# Start the Flask server
python server.py

# Open in browser
# http://localhost:5000
```

The interface features:

- **Real-time event recording** — Capture clicks, typing, navigation, scrolling
- **Live preview** — See each event as it's captured
- **Tutorial generation** — Convert events to step-by-step instructions
- **Multiple modes** — AI-powered (GPT-4o) or offline heuristic mode
- **Export** — Download events as JSON for analysis
- **Responsive design** — Works on desktop, tablet, and mobile

For detailed information about the frontend, see [frontend/README.md](frontend/README.md).

---

- Python ≥ 3.10
- Dependencies listed in `requirements.txt`

```bash
pip install -r requirements.txt
```

---

## Configuration

Copy `.env.example` to `.env` and fill in your OpenAI API key:

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...
```

---

## Input Format

The input is a JSON array where each element represents one user action:

```json
[
  {
    "step": 1,
    "action": "click",
    "details": { "x": 150, "y": 300, "button": "left" },
    "screenshot": "step_1.png",
    "timestamp": "2024-01-01T10:00:00Z",
    "window": "Google Chrome"
  },
  {
    "step": 2,
    "action": "type",
    "details": { "key": "a" },
    "screenshot": "step_2.png",
    "timestamp": "2024-01-01T10:00:01Z"
  }
]
```

Supported `action` values: `click`, `type`, `special_key`, `navigation`,
`scroll`, `drag`.

---

## Output Format

```json
{
  "title": "Título curto do tutorial",
  "steps": [
    {
      "step_number": 1,
      "instruction": "Clique no campo de login",
      "image": "step_1.png"
    },
    {
      "step_number": 2,
      "instruction": "Digite seu usuário",
      "image": "step_2.png"
    }
  ],
  "summary": "Descrição breve do que o tutorial faz"
}
```

---

## Usage

### Command-line interface

```bash
# From a file (offline/heuristic mode — no API key needed):
python main.py --input events.json --pretty

# From stdin:
cat events.json | python main.py --pretty

# With AI-powered instructions (requires OPENAI_API_KEY):
python main.py --input events.json --ai --pretty

# With screenshot analysis:
python main.py --input events.json --ai --analyze-screenshots --pretty

# Save output to a file:
python main.py --input events.json --ai --output tutorial.json
```

Run `python main.py --help` for all options.

### Python API

```python
from src import TutorialGenerator

# Offline mode (no API key required)
generator = TutorialGenerator(use_ai=False)
tutorial = generator.generate(events_list)
print(tutorial.title)
print(tutorial.summary)
for step in tutorial.steps:
    print(f"{step.step_number}. {step.instruction}")

# AI mode
generator = TutorialGenerator(use_ai=True)  # reads OPENAI_API_KEY from env
tutorial = generator.generate(events_list)
```

---

## Running Tests

```bash
pip install pytest
pytest tests/ -v
```

---

## Project Structure

```
.
├── main.py                     # CLI entry point
├── requirements.txt
├── .env.example
├── src/
│   ├── __init__.py
│   ├── models.py               # Pydantic input/output models
│   ├── action_processor.py     # Action grouping logic
│   ├── screenshot_analyzer.py  # Vision-based screenshot description
│   └── tutorial_generator.py  # Main orchestration + AI/heuristic generation
└── tests/
    └── test_tutorial_generator.py
```
