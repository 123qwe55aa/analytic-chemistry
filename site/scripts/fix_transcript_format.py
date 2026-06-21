#!/usr/bin/env python3
import argparse
import json
import re
import sys
from typing import Any, Dict, List


def split_speaker(line: str):
    # Match patterns like "Speaker: text" or "Speaker：text"
    m = re.match(r"^\s*([^:：]{1,40})\s*[:：]\s*(.+)$", line.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None, line.strip()


def normalize_transcript(payload: Dict[str, Any], default_speaker: str = "Host") -> Dict[str, Any]:
    transcript = payload.get("transcript")
    if not isinstance(transcript, list):
        raise ValueError("payload.transcript must be a list")

    fixed: List[Dict[str, str]] = []
    for idx, item in enumerate(transcript):
        if isinstance(item, dict):
            speaker = str(item.get("speaker") or item.get("name") or default_speaker).strip() or default_speaker
            text = str(item.get("text") or item.get("content") or "").strip()
            if text:
                fixed.append({"speaker": speaker, "text": text})
            continue

        if isinstance(item, str):
            speaker, text = split_speaker(item)
            if text:
                fixed.append({"speaker": speaker or default_speaker, "text": text})
            continue

        # Any unknown type becomes string text
        text = str(item).strip()
        if text:
            fixed.append({"speaker": default_speaker, "text": text})

    payload["transcript"] = fixed
    return payload


def main():
    ap = argparse.ArgumentParser(description="Normalize podcast transcript JSON format")
    ap.add_argument("input", help="Input JSON file")
    ap.add_argument("-o", "--output", help="Output JSON file (default: stdout)")
    ap.add_argument("--default-speaker", default="Host", help="Fallback speaker name")
    args = ap.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        payload = json.load(f)

    fixed = normalize_transcript(payload, default_speaker=args.default_speaker)

    out = json.dumps(fixed, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out + "\n")
    else:
        print(out)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
