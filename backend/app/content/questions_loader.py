"""Load misconceptions and questions from YAML.

Usage (from backend/):
    python -m app.content.questions_loader ../content/questions/dsa.yaml

File shape:
    misconceptions:
      - slug: master-theorem-any-f
        concept: master-theorem
        title: ...
        explanation: ...
        example: ...            # optional
    questions:
      - key: dsa-mt-001         # stable id; re-importing updates this question in place
        type: MCQ               # MCQ | MSQ | NAT
        concept: master-theorem # primary concept slug
        also: [recurrence-relations]
        difficulty: 3
        source: original
        stem: |
          ...
        options:                # MCQ / MSQ
          - text: ...
            correct: true
          - text: ...
            misconception: master-theorem-any-f
        answer: [3, 3]          # NAT: [min, max]
        explanation: |
          ...

Every question goes through the same checks as the admin editor and is approved on import.
The YAML is the source of truth for imported questions: admin edits to them are overwritten
the next time the file is imported. Questions entered in the admin editor are never touched.
"""

import sys
from decimal import Decimal
from pathlib import Path

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.content.schemas import OptionIn, QuestionConceptIO, QuestionIn
from app.content.service import (
    ContentError,
    check_ready_to_approve,
    save_question,
    to_out,
)
from app.models import Concept, Misconception, Question

LABELS = "ABCDE"


def _concept_id(db: Session, slug: str, where: str) -> int:
    cid = db.scalar(select(Concept.id).where(Concept.slug == slug))
    if cid is None:
        raise ContentError(f"{where}: unknown concept '{slug}' (load the concept graph first)")
    return cid


def load(db: Session, data: dict) -> dict:
    """Validate and upsert everything in one file. Caller commits."""
    stats = {"misconceptions": 0, "created": 0, "updated": 0}
    mis_ids: dict[str, int] = {}
    for m in data.get("misconceptions") or []:
        where = f"misconception {m.get('slug')}"
        concept_id = _concept_id(db, m["concept"], where)
        row = db.scalar(select(Misconception).where(Misconception.slug == m["slug"]))
        if row is None:
            row = Misconception(slug=m["slug"])
            db.add(row)
        row.concept_id = concept_id
        row.title, row.explanation, row.example = m["title"], m["explanation"], m.get("example")
        db.flush()
        mis_ids[m["slug"]] = row.id
        stats["misconceptions"] += 1

    keys = set()
    for raw in data.get("questions") or []:
        key = raw.get("key")
        where = f"question {key}"
        if not key or key in keys:
            raise ContentError(f"{where}: every question needs a unique key")
        keys.add(key)

        options = []
        for i, o in enumerate(raw.get("options") or []):
            mslug = o.get("misconception")
            if mslug and mslug not in mis_ids:
                mid = db.scalar(select(Misconception.id).where(Misconception.slug == mslug))
                if mid is None:
                    raise ContentError(f"{where}: unknown misconception '{mslug}'")
                mis_ids[mslug] = mid
            options.append(
                OptionIn(
                    label=LABELS[i],
                    text_md=str(o["text"]),
                    is_correct=bool(o.get("correct")),
                    misconception_id=mis_ids.get(mslug) if mslug else None,
                )
            )
        answer = raw.get("answer")
        concepts = [
            QuestionConceptIO(concept_id=_concept_id(db, raw["concept"], where), is_primary=True)
        ]
        concepts += [
            QuestionConceptIO(concept_id=_concept_id(db, s, where)) for s in raw.get("also") or []
        ]
        body = QuestionIn(
            qtype=raw.get("type", "MCQ"),
            stem_md=raw["stem"].strip(),
            explanation_md=(raw.get("explanation") or "").strip() or None,
            source=raw.get("source"),
            difficulty=raw.get("difficulty"),
            nat_answer_min=Decimal(str(answer[0])) if answer else None,
            nat_answer_max=Decimal(str(answer[1])) if answer else None,
            options=options,
            concepts=concepts,
        )
        existing = db.scalar(select(Question).where(Question.import_key == key))
        try:
            q = save_question(db, body, existing)
            check_ready_to_approve(to_out(db, q))
        except ContentError as e:
            raise ContentError(f"{where}: {e}") from e
        q.import_key, q.status = key, "approved"
        stats["updated" if existing else "created"] += 1
    db.flush()
    return stats


def main(paths: list[str]) -> int:
    from app.core.db import SessionLocal

    if not paths:
        print(__doc__)
        return 2
    with SessionLocal() as db:
        try:
            for p in paths:
                data = yaml.safe_load(Path(p).read_text(encoding="utf-8")) or {}
                stats = load(db, data)
                print(
                    f"{p}: {stats['misconceptions']} misconceptions, "
                    f"{stats['created']} questions created, {stats['updated']} updated"
                )
            db.commit()
        except ContentError as e:
            db.rollback()
            print(f"Nothing imported. {e}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
