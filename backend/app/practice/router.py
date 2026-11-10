from fastapi import APIRouter, HTTPException, Query

from app.auth.deps import CurrentUser
from app.core.db import DbSession
from app.practice import service, snapshot
from app.practice.schemas import AnswerIn, AnswerResult, SessionIn, SessionOut
from app.practice.service import PracticeError

router = APIRouter(prefix="/sessions", tags=["practice"])


def _http(e: PracticeError) -> HTTPException:
    return HTTPException(e.status, str(e))


@router.post("", status_code=201)
def start_session(body: SessionIn, db: DbSession, user: CurrentUser) -> SessionOut:
    try:
        with db.begin_nested():  # undo a half-created session, nothing else
            s = service.create_session(db, user, body)
    except PracticeError as e:
        raise _http(e) from e
    db.commit()
    return service.session_out(db, s)


@router.get("/{session_id}")
def get_session(session_id: int, db: DbSession, user: CurrentUser) -> SessionOut:
    try:
        s = service.get_session(db, user, session_id)
    except PracticeError as e:
        raise _http(e) from e
    return service.session_out(db, s)


@router.post("/{session_id}/next")
def next_question(session_id: int, db: DbSession, user: CurrentUser) -> SessionOut:
    """Serve the next question once the current one is answered. Safe to call twice."""
    try:
        s = service.get_session(db, user, session_id)
    except PracticeError as e:
        raise _http(e) from e
    service.serve_next(db, s)
    db.commit()
    return service.session_out(db, s)


@router.post("/{session_id}/answer")
def answer(session_id: int, body: AnswerIn, db: DbSession, user: CurrentUser) -> AnswerResult:
    try:
        s = service.get_session(db, user, session_id)
        with db.begin_nested():
            result = service.answer(db, s, body)
    except PracticeError as e:
        raise _http(e) from e
    db.commit()
    return result


@router.post("/{session_id}/end")
def end(session_id: int, db: DbSession, user: CurrentUser) -> SessionOut:
    try:
        s = service.get_session(db, user, session_id)
    except PracticeError as e:
        raise _http(e) from e
    service.end_session(db, s)
    db.commit()
    return service.session_out(db, s)


me_router = APIRouter(tags=["practice"])


@me_router.get("/me/snapshot", response_model_by_alias=True)
def my_snapshot(
    db: DbSession,
    user: CurrentUser,
    tz: int = Query(0, ge=-14 * 60, le=14 * 60, description="Minutes ahead of UTC (IST = 330)"),
) -> snapshot.Snapshot:
    return snapshot.build(db, user, tz)
