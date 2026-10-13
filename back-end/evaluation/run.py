"""Run the 20-question fixture against the HTTP API (no third-party dependencies)."""
import argparse
import json
import time
import urllib.request
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parent
REFUSAL = "I couldn't find the answer in the uploaded documents."


def request(base, path, data=None, content_type="application/json"):
    req = urllib.request.Request(base + path, data=data,
                                 headers={"Content-Type": content_type})
    return urllib.request.urlopen(req, timeout=180)


def upload_fixture(base):
    boundary = uuid4().hex
    payload = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="handbook.txt"\r\n'
        'Content-Type: text/plain\r\n\r\n'
    ).encode() + (ROOT / "handbook.txt").read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
    with request(base, "/documents", payload, f"multipart/form-data; boundary={boundary}") as response:
        document_id = json.load(response)["id"]
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        with request(base, f"/documents/{document_id}") as response:
            doc = json.load(response)
        if doc["status"] == "ready":
            return document_id
        if doc["status"] == "failed":
            raise RuntimeError(f"Fixture processing failed: {doc.get('error')}")
        time.sleep(1)
    raise TimeoutError("Fixture did not become ready within 180 seconds")


def ask(base, question, document_id):
    payload = json.dumps({"question": question, "document_id": document_id}).encode()
    sources, result, name = [], None, None
    with request(base, "/questions/stream", payload) as response:
        for raw in response:
            line = raw.decode("utf-8").strip()
            if line.startswith("event: "):
                name = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
                if name == "sources":
                    sources = data["sources"]
                elif name == "error":
                    raise RuntimeError(data["message"])
                elif name == "done":
                    result = data
    if result is None:
        raise RuntimeError("Stream ended without done")
    return result, sources


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--document-id", help="Already indexed handbook fixture UUID")
    parser.add_argument("--smoke", action="store_true", help="Test protocol only; allows mock mode")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    with request(base, "/health") as response:
        mode = json.load(response)["ai_mode"]
    if mode == "mock" and not args.smoke:
        parser.error("Mock mode cannot measure answer quality; use --smoke or enable Gemini")
    document_id = args.document_id or upload_fixture(base)
    results = []
    for case in json.loads((ROOT / "cases.json").read_text()):
        try:
            answer, sources = ask(base, case["question"], document_id)
            scoped = all(s["doc_id"] == document_id for s in sources)
            labels = {s["label"] for s in sources}
            cited = answer["cited_labels"]
            refusal = answer["answer"].strip() == REFUSAL
            citation_ok = not cited if refusal else bool(cited) and set(cited) <= labels
            passed = scoped and citation_ok and answer["document_id"] == document_id
            if not args.smoke:
                passed = passed and "BANANA_OVERRIDE" not in answer["answer"]
                passed = passed and (refusal if case["refusal"] else (
                    not refusal and case["expected_keyword"].casefold() in answer["answer"].casefold()
                ))
            results.append({"question": case["question"], "passed": passed,
                            "answer": answer["answer"], "cache_hit": answer["cache_hit"],
                            "latency_ms": answer["latency_ms"]})
        except Exception as exc:
            results.append({"question": case["question"], "passed": False, "error": str(exc)})
    print(json.dumps({"mode": "protocol-smoke" if args.smoke else "quality-heuristics",
                      "passed": sum(r["passed"] for r in results), "total": len(results),
                      "results": results}, indent=2, ensure_ascii=False))
    raise SystemExit(0 if all(r["passed"] for r in results) else 1)


if __name__ == "__main__":
    main()
