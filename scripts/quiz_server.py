from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parents[1]
STATS_PATH = ROOT / "data" / "questions" / "choice_stats.json"


def empty_stats() -> dict:
    return {"version": 1, "questions": {}}


def load_stats() -> dict:
    if not STATS_PATH.exists():
        return empty_stats()
    try:
        with STATS_PATH.open(encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        return empty_stats()
    if not isinstance(data, dict):
        return empty_stats()
    data.setdefault("version", 1)
    data.setdefault("questions", {})
    return data


def save_stats(data: dict) -> None:
    STATS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temp_path = STATS_PATH.with_suffix(".tmp")
    temp_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp_path, STATS_PATH)


def question_record(data: dict, question_id: str) -> dict:
    questions = data.setdefault("questions", {})
    record = questions.setdefault(
        question_id,
        {
            "attempts": 0,
            "correct": 0,
            "choices": {},
            "ratings": {"good": 0, "bad": 0, "out_of_scope": 0},
            "updated_at": "",
        },
    )
    record.setdefault("attempts", 0)
    record.setdefault("correct", 0)
    record.setdefault("choices", {})
    record.setdefault("ratings", {"good": 0, "bad": 0, "out_of_scope": 0})
    record["ratings"].setdefault("good", 0)
    record["ratings"].setdefault("bad", 0)
    record["ratings"].setdefault("out_of_scope", 0)
    return record


class QuizRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/stats":
            self.handle_get_stats(parsed.query)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/results":
            self.handle_post_results()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")

    def handle_get_stats(self, query: str) -> None:
        params = parse_qs(query)
        ids = []
        for value in params.get("ids", []):
            ids.extend(part for part in value.split(",") if part)
        data = load_stats()
        questions = data.get("questions", {})
        if ids:
            payload = {"questions": {question_id: questions.get(question_id) for question_id in ids}}
        else:
            payload = {"questions": questions}
        self.send_json(payload)

    def handle_post_results(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length).decode("utf-8")
            payload = json.loads(body or "{}")
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
            return

        responses = payload.get("responses", [])
        ratings = payload.get("ratings", {})
        if not isinstance(responses, list) or not isinstance(ratings, dict):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid payload")
            return

        data = load_stats()
        now = datetime.now(timezone.utc).isoformat()

        for response in responses:
            if not isinstance(response, dict):
                continue
            question_id = str(response.get("questionId") or "").strip()
            choice_id = str(response.get("selectedChoiceId") or "").strip()
            if not question_id or not choice_id:
                continue
            record = question_record(data, question_id)
            record["attempts"] += 1
            record["correct"] += 1 if bool(response.get("isCorrect")) else 0
            record["choices"][choice_id] = int(record["choices"].get(choice_id, 0)) + 1
            record["updated_at"] = now

        for question_id, rating in ratings.items():
            question_id = str(question_id).strip()
            rating = str(rating).strip()
            if not question_id or rating not in {"good", "bad", "out_of_scope"}:
                continue
            record = question_record(data, question_id)
            record["ratings"][rating] += 1
            record["updated_at"] = now

        save_stats(data)
        self.send_json({"ok": True})

    def send_json(self, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the quiz app with local result collection APIs.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), QuizRequestHandler)
    print(f"serving http://{args.host}:{args.port}/app/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
