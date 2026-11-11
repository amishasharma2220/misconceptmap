from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import delete, func, select

from app.auth import ratelimit
from app.auth.deps import CurrentUser
from app.core.db import DbSession
from app.core.security import create_access_token, hash_password, verify_password
from app.models import (
    Attempt,
    CoachConversation,
    Mastery,
    PracticeSession,
    ReviewItem,
    User,
)

router = APIRouter(tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)
    consent_research: bool = False


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    display_name: str | None
    role: str
    consent_research: bool


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def _token_for(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id, user.role),
        user=UserOut.model_validate(user),
    )


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: DbSession, request: Request) -> TokenOut:
    address = ratelimit.client_address(request)
    ratelimit.signups.check(address)
    email = body.email.lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        consent_research=body.consent_research,
        role="student",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    ratelimit.signups.hit(address)
    return _token_for(user)


@router.post("/auth/login")
def login(body: LoginIn, db: DbSession, request: Request) -> TokenOut:
    email = body.email.lower()
    by_address = f"{ratelimit.client_address(request)}|{email}"
    ratelimit.login_by_address.check(by_address)
    ratelimit.login_by_account.check(email)
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None or not verify_password(body.password, user.password_hash):
        ratelimit.login_by_address.hit(by_address)
        ratelimit.login_by_account.hit(email)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    ratelimit.login_by_address.reset(by_address)
    return _token_for(user)


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


class ProfileIn(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)
    consent_research: bool | None = None


@router.patch("/me")
def update_me(body: ProfileIn, db: DbSession, user: CurrentUser) -> UserOut:
    """Change your name or your research-use choice. Only the fields sent are changed."""
    sent = body.model_fields_set
    if "display_name" in sent:
        user.display_name = (body.display_name or "").strip() or None
    if "consent_research" in sent and body.consent_research is not None:
        user.consent_research = body.consent_research
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


class DeleteIn(BaseModel):
    password: str


@router.post("/me/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(body: DeleteIn, db: DbSession, user: CurrentUser) -> Response:
    """Permanently delete the account and everything recorded for it."""
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Wrong password")
    if user.role == "admin":
        admins = db.scalar(select(func.count()).select_from(User).where(User.role == "admin"))
        if admins <= 1:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "You are the only admin. Make another account an admin before deleting this one.",
            )
    uid = user.id
    # Attempts are append-only in normal use; a deletion request is the one exception.
    db.execute(delete(Attempt).where(Attempt.user_id == uid))
    db.execute(delete(ReviewItem).where(ReviewItem.user_id == uid))
    db.execute(delete(Mastery).where(Mastery.user_id == uid))
    db.execute(delete(PracticeSession).where(PracticeSession.user_id == uid))  # + its items
    db.execute(delete(CoachConversation).where(CoachConversation.user_id == uid))  # + messages
    db.execute(delete(User).where(User.id == uid))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
