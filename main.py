"""
Tutorial Generator — CLI entry point

Usage
-----
  # From a JSON file:
  python main.py --input events.json

  # From stdin:
  cat events.json | python main.py

  # Enable AI mode (requires OPENAI_API_KEY env var):
  python main.py --input events.json --ai

  # Enable screenshot analysis:
  python main.py --input events.json --ai --analyze-screenshots

  # Pretty-print output:
  python main.py --input events.json --pretty
"""

from __future__ import annotations

import argparse
import json
import logging
import sys

from src import TutorialGenerator


logging.basicConfig(
    level=logging.WARNING,
    format="%(levelname)s: %(message)s",
    stream=sys.stderr,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tutorial-generator",
        description=(
            "Transform structured user-interaction logs into step-by-step tutorials."
        ),
    )
    parser.add_argument(
        "--input", "-i",
        metavar="FILE",
        default=None,
        help="Path to the JSON file containing the event log. "
             "Reads from stdin if omitted.",
    )
    parser.add_argument(
        "--output", "-o",
        metavar="FILE",
        default=None,
        help="Path to write the tutorial JSON. Writes to stdout if omitted.",
    )
    parser.add_argument(
        "--ai",
        action="store_true",
        default=False,
        help="Enable OpenAI-powered instruction generation. "
             "Requires OPENAI_API_KEY to be set.",
    )
    parser.add_argument(
        "--model",
        default="gpt-4o",
        help="OpenAI model to use (default: gpt-4o).",
    )
    parser.add_argument(
        "--analyze-screenshots",
        action="store_true",
        default=False,
        help="Use the vision API to describe screenshots (requires --ai).",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        default=False,
        help="Pretty-print the JSON output.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        default=False,
        help="Enable verbose logging.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # --- Read input --------------------------------------------------------
    if args.input:
        try:
            with open(args.input, encoding="utf-8") as fh:
                raw = fh.read()
        except OSError as exc:
            print(f"Error reading input file: {exc}", file=sys.stderr)
            return 1
    else:
        if sys.stdin.isatty():
            print(
                "No input provided. Use --input FILE or pipe JSON via stdin.",
                file=sys.stderr,
            )
            parser.print_help(sys.stderr)
            return 1
        raw = sys.stdin.read()

    # --- Generate tutorial -------------------------------------------------
    generator = TutorialGenerator(
        use_ai=args.ai,
        model=args.model,
        analyze_screenshots=args.analyze_screenshots,
    )

    try:
        tutorial = generator.generate(raw)
    except (ValueError, TypeError) as exc:
        print(f"Error processing events: {exc}", file=sys.stderr)
        return 1

    # --- Write output -------------------------------------------------------
    indent = 2 if args.pretty else None
    output_json = json.dumps(tutorial.to_dict(), ensure_ascii=False, indent=indent)

    if args.output:
        try:
            with open(args.output, "w", encoding="utf-8") as fh:
                fh.write(output_json)
                fh.write("\n")
        except OSError as exc:
            print(f"Error writing output file: {exc}", file=sys.stderr)
            return 1
    else:
        print(output_json)

    return 0


if __name__ == "__main__":
    sys.exit(main())
