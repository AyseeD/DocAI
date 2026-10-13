"""Live synthetic smoke test; sends no user documents and prints no credentials.

Run from back-end: .venv/bin/python scripts/check_openrouter.py
Uses the configured models and may consume their quota.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.api.ai import MODE, MODEL, EMBED_MODEL, embed, generate


def main():
    if MODE != 'model':
        raise SystemExit('Set AI_MODE=model in back-end/.env first.')
    passage = 'The project is Cedar. It launched in March 2026.'
    document_vector = embed(passage)
    query_vector = embed('What is the project name?', query=True)
    assert len(document_vector) == 768
    assert math.isclose(sum(v*v for v in document_vector), 1)
    usage = {}
    parts = list(generate('What is the project name?', [{'content': passage}], usage))
    answer = ''.join(parts)
    assert 'Cedar' in answer and '[1]' in answer, 'Expected a grounded answer citing source 1'
    print('Generation:', MODEL)
    print('Embeddings:', EMBED_MODEL)
    print('Cosine distance:', round(1 - sum(a*b for a, b in zip(document_vector, query_vector)), 4))
    print('Answer:', answer)
    print('Text deltas:', len(parts))
    print('Generation usage:', usage)


if __name__ == '__main__':
    main()
