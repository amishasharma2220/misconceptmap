import json

from sqlalchemy import select

from app.models import LLMDraft
from tests.conftest import FakeLLM
from tests.test_questions import mcq


def reply(**overrides) -> str:
    body = {
        "primary_concept": "sorting-stability-inplace",
        "secondary_concepts": ["heap-sort", "not-a-real-concept"],
        "options": [
            {
                "label": "A",
                "misconception": None,
                "new_misconception": {
                    "concept": "heap-sort",
                    "title": "Believes heap sort is stable",
                    "explanation": "Sift-down swaps can reorder equal keys.",
                },
                "reason": "Confuses in-place with stable.",
            },
            {"label": "B", "misconception": "quicksort-is-stable", "reason": "..."},
            {"label": "C", "misconception": "should-be-ignored", "reason": "correct option"},
            {"label": "D", "misconception": None, "new_misconception": None, "reason": "slip"},
            {"label": "Z", "misconception": None},
        ],
        "explanation_md": "Merge sort is stable; the others are not.",
    }
    body.update(overrides)
    return json.dumps(body)


def make_question(client, admin_headers, dsa):
    return client.post("/admin/questions", json=mcq(dsa), headers=admin_headers).json()


def test_draft_is_disabled_without_key(client, admin_headers, dsa):
    q = make_question(client, admin_headers, dsa)
    r = client.post(
        f"/admin/questions/{q['id']}/draft-tags", json={"subject": "DSA"}, headers=admin_headers
    )
    assert r.status_code == 503
    assert "LLM_API_KEY" in r.json()["detail"]


def test_draft_resolves_slugs_and_reports_warnings(client, admin_headers, dsa, llm_holder):
    existing = client.post(
        "/admin/misconceptions",
        json={
            "concept_id": dsa["quicksort"],
            "slug": "quicksort-is-stable",
            "title": "Believes quicksort is stable",
            "explanation": "Partitioning swaps distant elements.",
        },
        headers=admin_headers,
    ).json()
    llm_holder["client"] = fake = FakeLLM(reply())
    q = make_question(client, admin_headers, dsa)

    r = client.post(
        f"/admin/questions/{q['id']}/draft-tags", json={"subject": "DSA"}, headers=admin_headers
    )
    assert r.status_code == 200, r.text
    d = r.json()

    assert d["primary_concept_id"] == dsa["sorting-stability-inplace"]
    assert d["secondary_concept_ids"] == [dsa["heap-sort"]]
    opts = {o["label"]: o for o in d["options"]}
    assert set(opts) == {"A", "B", "C", "D"}
    assert opts["A"]["new_misconception"]["concept_id"] == dsa["heap-sort"]
    assert opts["B"]["misconception_id"] == existing["id"]
    assert opts["C"]["misconception_id"] is None  # correct option never tagged
    assert opts["D"]["misconception_id"] is None and opts["D"]["new_misconception"] is None
    assert any("not-a-real-concept" in w for w in d["warnings"])
    assert any("'Z'" in w for w in d["warnings"])

    prompt = fake.prompts[0]
    assert "quicksort-is-stable [quicksort]" in prompt
    assert "C. Merge sort   <- correct" in prompt


def test_draft_retries_once_on_bad_json(client, admin_headers, dsa, llm_holder):
    llm_holder["client"] = fake = FakeLLM("not json at all", "```json\n" + reply() + "\n```")
    q = make_question(client, admin_headers, dsa)
    r = client.post(
        f"/admin/questions/{q['id']}/draft-tags", json={"subject": "DSA"}, headers=admin_headers
    )
    assert r.status_code == 200
    assert len(fake.prompts) == 2


def test_draft_fails_cleanly_after_two_bad_replies(client, admin_headers, dsa, llm_holder, db):
    llm_holder["client"] = FakeLLM("{}", "[]")
    q = make_question(client, admin_headers, dsa)
    r = client.post(
        f"/admin/questions/{q['id']}/draft-tags", json={"subject": "DSA"}, headers=admin_headers
    )
    assert r.status_code == 502
    assert db.scalar(select(LLMDraft).where(LLMDraft.question_id == q["id"])) is None


def _apply_and_approve(client, admin_headers, dsa, q, draft, tweak=None):
    """Mimic the UI: create the proposed misconception, apply tags, approve."""
    body = mcq(dsa)
    for o in draft["options"]:
        opt = next(x for x in body["options"] if x["label"] == o["label"])
        if o["new_misconception"]:
            m = client.post(
                "/admin/misconceptions", json=o["new_misconception"], headers=admin_headers
            ).json()
            opt["misconception_id"] = m["id"]
        elif o["misconception_id"]:
            opt["misconception_id"] = o["misconception_id"]
    body["concepts"] = [{"concept_id": draft["primary_concept_id"], "is_primary": True}] + [
        {"concept_id": c} for c in draft["secondary_concept_ids"]
    ]
    if tweak:
        tweak(body)
    client.put(f"/admin/questions/{q['id']}", json=body, headers=admin_headers)
    return client.post(f"/admin/questions/{q['id']}/approve", headers=admin_headers).json()


def test_acceptance_recorded_when_draft_used_as_is(client, admin_headers, dsa, llm_holder, db):
    llm_holder["client"] = FakeLLM(reply(options=reply_options_no_existing()))
    q = make_question(client, admin_headers, dsa)
    draft = client.post(
        f"/admin/questions/{q['id']}/draft-tags", json={"subject": "DSA"}, headers=admin_headers
    ).json()
    out = _apply_and_approve(client, admin_headers, dsa, q, draft)
    assert out["draft_accepted_unchanged"] is True
    assert db.get(LLMDraft, draft["draft_id"]).accepted_unchanged is True


def test_acceptance_false_when_admin_changes_tags(client, admin_headers, dsa, llm_holder):
    llm_holder["client"] = FakeLLM(reply(options=reply_options_no_existing()))
    q = make_question(client, admin_headers, dsa)
    draft = client.post(
        f"/admin/questions/{q['id']}/draft-tags", json={"subject": "DSA"}, headers=admin_headers
    ).json()

    def change_primary(body):
        body["concepts"][0]["concept_id"] = dsa["heap-sort"]
        body["concepts"] = [c for c in body["concepts"][:1]]

    out = _apply_and_approve(client, admin_headers, dsa, q, draft, tweak=change_primary)
    assert out["draft_accepted_unchanged"] is False


def reply_options_no_existing():
    return [
        {
            "label": "A",
            "new_misconception": {
                "concept": "heap-sort",
                "title": "Believes heap sort is stable",
                "explanation": "Sift-down swaps can reorder equal keys.",
            },
        },
        {"label": "B", "misconception": None},
        {"label": "C", "misconception": None},
        {"label": "D", "misconception": None},
    ]
