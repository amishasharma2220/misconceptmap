"""Pure-Python validation for a concept graph. No database here, so it is easy to unit-test."""

from dataclasses import dataclass, field


class ConceptGraphError(ValueError):
    pass


@dataclass
class ConceptSpec:
    slug: str
    name: str
    difficulty: int | None = None
    description: str | None = None
    prereqs: list[str] = field(default_factory=list)


def find_cycle(edges: dict[str, list[str]]) -> list[str] | None:
    """Return one cycle as a list of slugs (first == last), or None if the graph is a DAG.

    `edges` maps each concept to its prerequisites. Iterative DFS with three colours,
    so a long chain of concepts cannot hit Python's recursion limit.
    """
    WHITE, GREY, BLACK = 0, 1, 2
    colour = {node: WHITE for node in edges}
    parent: dict[str, str] = {}

    for start in edges:
        if colour[start] != WHITE:
            continue
        stack = [(start, iter(edges[start]))]
        colour[start] = GREY
        while stack:
            node, it = stack[-1]
            nxt = next(it, None)
            if nxt is None:
                colour[node] = BLACK
                stack.pop()
                continue
            if colour.get(nxt, BLACK) == GREY:
                cycle = [nxt, node]
                while cycle[-1] != nxt:
                    cycle.append(parent[cycle[-1]])
                return list(reversed(cycle))
            if colour.get(nxt) == WHITE:
                parent[nxt] = node
                colour[nxt] = GREY
                stack.append((nxt, iter(edges[nxt])))
    return None


def validate(concepts: list[ConceptSpec], known_slugs: set[str] | None = None) -> None:
    """Raise ConceptGraphError on duplicates, bad fields, unknown prerequisites or cycles.

    `known_slugs` are concepts from other subjects that prerequisites may point to.
    """
    known_slugs = known_slugs or set()
    seen: set[str] = set()
    errors: list[str] = []

    for c in concepts:
        if c.slug in seen:
            errors.append(f"duplicate concept slug '{c.slug}'")
        seen.add(c.slug)
        if c.difficulty is not None and not 1 <= c.difficulty <= 5:
            errors.append(f"'{c.slug}': difficulty must be 1-5, got {c.difficulty}")
        if c.slug in c.prereqs:
            errors.append(f"'{c.slug}' lists itself as a prerequisite")

    for c in concepts:
        for p in c.prereqs:
            if p not in seen and p not in known_slugs:
                errors.append(f"'{c.slug}': unknown prerequisite '{p}'")

    if errors:
        raise ConceptGraphError("; ".join(errors))

    edges = {c.slug: [p for p in c.prereqs if p in seen] for c in concepts}
    cycle = find_cycle(edges)
    if cycle:
        raise ConceptGraphError("prerequisite cycle: " + " -> ".join(cycle))
