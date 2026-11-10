from fastapi import APIRouter, HTTPException, Query, Response

from app.auth.deps import CurrentUser
from app.coach import service
from app.coach.schemas import ChatIn, ChatOut, CoachStatus, ConversationOut, ConversationSummary
from app.coach.service import CoachError
from app.core.db import DbSession
from app.tagging.llm import LLM

router = APIRouter(prefix="/coach", tags=["coach"])

TZ = Query(330, ge=-14 * 60, le=14 * 60, description="Minutes ahead of UTC (IST = 330)")


def _http(e: CoachError) -> HTTPException:
    return HTTPException(e.status, str(e))


@router.get("/status")
def status(llm: LLM, user: CurrentUser) -> CoachStatus:
    return CoachStatus(ai=llm is not None, model=llm.model if llm else None)


@router.post("/chat")
def chat(body: ChatIn, db: DbSession, user: CurrentUser, llm: LLM, tz: int = TZ) -> ChatOut:
    try:
        out = service.chat(db, user, body, llm, tz)
    except CoachError as e:
        raise _http(e) from e
    db.commit()
    return out


@router.get("/conversations")
def list_conversations(db: DbSession, user: CurrentUser) -> list[ConversationSummary]:
    return service.conversations(db, user)


@router.get("/conversations/{conv_id}")
def get_conversation(conv_id: int, db: DbSession, user: CurrentUser) -> ConversationOut:
    try:
        return service.conversation(db, user, conv_id)
    except CoachError as e:
        raise _http(e) from e


@router.delete("/conversations/{conv_id}", status_code=204)
def delete_conversation(conv_id: int, db: DbSession, user: CurrentUser) -> Response:
    try:
        service.delete_conversation(db, user, conv_id)
    except CoachError as e:
        raise _http(e) from e
    db.commit()
    return Response(status_code=204)
