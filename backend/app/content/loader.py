"""Load a subject's concept graph from YAML into Postgres.

Usage (from backend/):
    python -m app.content.loader ../content/concepts/dsa.yaml
    python -m app.content.loader ../content/concepts/*.yaml

Idempotent: re-running updates names/descriptions/difficulty and replaces the
subject's prerequisite edges, so the YAML file is the source of truth.
Concepts removed from the YAML are reported, not deleted (they may have attempts).
"""

import sys
from pathlib import Path

import yaml
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.content.graph import ConceptGraphError, ConceptSpec, validate
from app.models import Concept, ConceptPrereq, Subject


def parse_file(path: Path) -> tuple[dict, list[ConceptSpec]]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or "subject" not in data or "concepts" not in data:
        raise ConceptGraphError(f"{path}: expected top-level 'subject' and 'concepts'")
    specs = [
        ConceptSpec(
            slug=c["slug"],
            name=c["name"],
            difficulty=c.get("difficulty"),
            description=c.get("description"),
            prereqs=list(c.get("prereqs") or []),
        )
        for c in data["concepts"]
    ]
    return data["subject"], specs


def load_subject(db: Session, subject_data: dict, specs: list[ConceptSpec]) -> dict:
    """Validate, then upsert one subject. Caller commits."""
    subject = db.scalar(select(Subject).where(Subject.code == subject_data["code"]))
    if subject is None:
        subject = Subject(code=subject_data["code"], name=subject_data["name"])
        db.add(subject)
        db.flush()
    else:
        subject.name = subject_data["name"]

    other_slugs = set(
        db.scalars(select(Concept.slug).where(Concept.subject_id != subject.id)).all()
    )
    validate(specs, known_slugs=other_slugs)

    existing = {
        c.slug: c for c in db.scalars(select(Concept).where(Concept.subject_id == subject.id))
    }
    created = updated = 0
    for s in specs:
        c = existing.get(s.slug)
        if c is None:
            c = Concept(subject_id=subject.id, slug=s.slug)
            db.add(c)
            created += 1
        else:
            updated += 1
        c.name, c.description, c.difficulty = s.name, s.description, s.difficulty
    db.flush()

    ids = dict(db.execute(select(Concept.slug, Concept.id)).all())
    subject_ids = [ids[s.slug] for s in specs]
    db.execute(delete(ConceptPrereq).where(ConceptPrereq.concept_id.in_(subject_ids)))
    n_edges = 0
    for s in specs:
        for p in s.prereqs:
            db.add(ConceptPrereq(concept_id=ids[s.slug], prereq_id=ids[p]))
            n_edges += 1

    orphaned = sorted(set(existing) - {s.slug for s in specs})
    return {
        "subject": subject.code,
        "created": created,
        "updated": updated,
        "edges": n_edges,
        "not_in_yaml": orphaned,
    }


def main(paths: list[str]) -> int:
    from app.core.db import SessionLocal

    if not paths:
        print(__doc__)
        return 2
    with SessionLocal() as db:
        try:
            for p in paths:
                subject_data, specs = parse_file(Path(p))
                report = load_subject(db, subject_data, specs)
                print(
                    f"{report['subject']}: {report['created']} created, "
                    f"{report['updated']} updated, {report['edges']} prerequisite edges"
                )
                if report["not_in_yaml"]:
                    print(f"  warning: in database but not in YAML: {report['not_in_yaml']}")
            db.commit()
        except ConceptGraphError as e:
            db.rollback()
            print(f"error: {e}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
