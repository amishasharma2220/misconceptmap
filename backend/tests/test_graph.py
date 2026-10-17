from pathlib import Path

import pytest

from app.content.graph import ConceptGraphError, ConceptSpec, find_cycle, validate
from app.content.loader import parse_file

CONTENT = Path(__file__).resolve().parents[2] / "content" / "concepts"


def spec(slug, *prereqs, difficulty=2):
    return ConceptSpec(slug=slug, name=slug, difficulty=difficulty, prereqs=list(prereqs))


def test_dag_has_no_cycle():
    assert find_cycle({"a": [], "b": ["a"], "c": ["a", "b"]}) is None


def test_detects_cycle_and_reports_path():
    cycle = find_cycle({"a": ["c"], "b": ["a"], "c": ["b"]})
    assert cycle is not None
    assert cycle[0] == cycle[-1]
    assert set(cycle) == {"a", "b", "c"}


def test_long_chain_does_not_hit_recursion_limit():
    edges = {f"c{i}": [f"c{i - 1}"] if i else [] for i in range(5000)}
    assert find_cycle(edges) is None


@pytest.mark.parametrize(
    "concepts, message",
    [
        ([spec("a"), spec("a")], "duplicate"),
        ([spec("a", "missing")], "unknown prerequisite"),
        ([spec("a", "a")], "itself"),
        ([spec("a", difficulty=9)], "difficulty"),
        ([spec("a", "b"), spec("b", "a")], "cycle"),
    ],
)
def test_validate_rejects_bad_graphs(concepts, message):
    with pytest.raises(ConceptGraphError, match=message):
        validate(concepts)


def test_prereq_from_another_subject_is_allowed():
    validate([spec("deadlock", "graph-representation")], known_slugs={"graph-representation"})


@pytest.mark.parametrize("path", sorted(CONTENT.glob("*.yaml")), ids=lambda p: p.name)
def test_every_content_file_is_a_valid_dag(path):
    _, specs = parse_file(path)
    assert len(specs) >= 10
    validate(specs)
