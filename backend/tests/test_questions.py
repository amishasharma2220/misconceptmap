import pytest


def mcq(dsa, **overrides):
    body = {
        "qtype": "MCQ",
        "stem_md": "Which of these sorting algorithms is stable?",
        "explanation_md": "Merge sort keeps equal keys in input order.",
        "source": "original",
        "difficulty": 2,
        "options": [
            {"label": "A", "text_md": "Heap sort"},
            {"label": "B", "text_md": "Quicksort"},
            {"label": "C", "text_md": "Merge sort", "is_correct": True},
            {"label": "D", "text_md": "Selection sort"},
        ],
        "concepts": [{"concept_id": dsa["sorting-stability-inplace"], "is_primary": True}],
    }
    body.update(overrides)
    return body


def test_concepts_endpoint_lists_prereqs(client, student_headers, dsa):
    r = client.get("/concepts?subject=DSA", headers=student_headers)
    assert r.status_code == 200
    by_slug = {c["slug"]: c for c in r.json()}
    assert by_slug["master-theorem"]["prereqs"] == ["recurrence-relations"]
    assert len(by_slug) == len(dsa)


def test_create_get_list_question(client, admin_headers, dsa):
    r = client.post("/admin/questions", json=mcq(dsa), headers=admin_headers)
    assert r.status_code == 201, r.text
    q = r.json()
    assert q["status"] == "draft"
    assert [o["label"] for o in q["options"]] == ["A", "B", "C", "D"]

    r = client.get(f"/admin/questions/{q['id']}", headers=admin_headers)
    assert r.json()["stem_md"].startswith("Which")

    r = client.get("/admin/questions?subject=DSA&status=draft", headers=admin_headers)
    assert [x["id"] for x in r.json()] == [q["id"]]
    assert r.json()[0]["primary_concept"] == "Stability and in-place sorting"


def test_update_keeps_option_ids(client, admin_headers, dsa):
    q = client.post("/admin/questions", json=mcq(dsa), headers=admin_headers).json()
    ids = {o["label"]: o["id"] for o in q["options"]}
    body = mcq(dsa)
    body["options"][0]["text_md"] = "Heap sort (in-place)"
    q2 = client.put(f"/admin/questions/{q['id']}", json=body, headers=admin_headers).json()
    assert {o["label"]: o["id"] for o in q2["options"]} == ids
    assert q2["options"][0]["text_md"] == "Heap sort (in-place)"


@pytest.mark.parametrize(
    "change, message",
    [
        (lambda b: b["options"].append({"label": "A", "text_md": "dup"}), "unique"),
        (
            lambda b: b["concepts"].append({"concept_id": b["concepts"][0]["concept_id"]}),
            "twice",
        ),
        (lambda b: b.update(qtype="NAT"), "no options"),
        (lambda b: b["concepts"].__setitem__(0, {"concept_id": 999999}), "Unknown concept"),
    ],
)
def test_save_rejects_bad_structure(client, admin_headers, dsa, change, message):
    body = mcq(dsa)
    change(body)
    r = client.post("/admin/questions", json=body, headers=admin_headers)
    assert r.status_code == 400
    assert message in r.json()["detail"]


def test_correct_option_cannot_carry_misconception(client, admin_headers, dsa):
    m = client.post(
        "/admin/misconceptions",
        json={
            "concept_id": dsa["sorting-stability-inplace"],
            "title": "Believes heap sort is stable",
            "explanation": "Heap operations reorder equal keys.",
        },
        headers=admin_headers,
    ).json()
    body = mcq(dsa)
    body["options"][2]["misconception_id"] = m["id"]
    r = client.post("/admin/questions", json=body, headers=admin_headers)
    assert r.status_code == 400
    assert "correct" in r.json()["detail"]


def test_approve_rules(client, admin_headers, dsa):
    no_correct = mcq(dsa)
    for o in no_correct["options"]:
        o["is_correct"] = False
    q = client.post("/admin/questions", json=no_correct, headers=admin_headers).json()
    r = client.post(f"/admin/questions/{q['id']}/approve", headers=admin_headers)
    assert r.status_code == 400
    assert "exactly 1 correct" in r.json()["detail"]

    no_primary = mcq(dsa, concepts=[], explanation_md="")
    q = client.post("/admin/questions", json=no_primary, headers=admin_headers).json()
    detail = client.post(f"/admin/questions/{q['id']}/approve", headers=admin_headers).json()[
        "detail"
    ]
    assert "primary concept" in detail and "explanation" in detail

    q = client.post("/admin/questions", json=mcq(dsa), headers=admin_headers).json()
    r = client.post(f"/admin/questions/{q['id']}/approve", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["question"]["status"] == "approved"
    assert r.json()["draft_accepted_unchanged"] is None  # no LLM draft was made


def test_misconception_slug_is_generated_and_unique(client, admin_headers, dsa):
    payload = {
        "concept_id": dsa["heap-sort"],
        "title": "Believes heap sort is stable!",
        "explanation": "It is not.",
    }
    a = client.post("/admin/misconceptions", json=payload, headers=admin_headers).json()
    b = client.post("/admin/misconceptions", json=payload, headers=admin_headers).json()
    assert a["slug"] == "believes-heap-sort-is-stable"
    assert b["slug"] == "believes-heap-sort-is-stable-2"


def test_cannot_delete_misconception_in_use(client, admin_headers, dsa):
    m = client.post(
        "/admin/misconceptions",
        json={
            "concept_id": dsa["heap-sort"],
            "title": "Heap sort is stable",
            "explanation": "x" * 5,
        },
        headers=admin_headers,
    ).json()
    body = mcq(dsa)
    body["options"][0]["misconception_id"] = m["id"]
    client.post("/admin/questions", json=body, headers=admin_headers)
    r = client.delete(f"/admin/misconceptions/{m['id']}", headers=admin_headers)
    assert r.status_code == 409


def test_list_preview_strips_markdown():
    from app.content.router import plain_preview

    assert plain_preview("Find **all** $n$ such that `x`") == "Find all n such that x"
    assert plain_preview("word " * 100).endswith("…")
