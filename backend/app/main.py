"""FastAPI application entry point and REST API endpoints."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.config import settings
from app.database import Base, engine, get_db
from app.models import Category, User
from app.schemas import TokenOut, UserLogin, UserOut, UserRegister

DEFAULT_CATEGORIES = [
    ("Учёба", "#2563eb"),
    ("Работа", "#0f766e"),
    ("Личное", "#b45309"),
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="REST API для веб-приложения «Планировщик задач»",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/api/health", tags=["Система"])
def healthcheck(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}


@app.post("/api/auth/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED, tags=["Аутентификация"])
def register(payload: UserRegister, db: Session = Depends(get_db)):
    duplicate = db.execute(
        select(User).where(
            or_(
                func.lower(User.email) == payload.email.lower(),
                func.lower(User.username) == payload.username.lower(),
            )
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким именем или email уже существует",
        )

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()

    for cat_name, cat_color in DEFAULT_CATEGORIES:
        db.add(Category(user_id=user.id, name=cat_name, color=cat_color))

    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@app.post("/api/auth/login", response_model=TokenOut, tags=["Аутентификация"])
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.execute(
        select(User).where(
            or_(
                func.lower(User.email) == payload.login,
                func.lower(User.username) == payload.login,
            )
        )
    ).scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    token = create_access_token(user.id)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@app.get("/api/auth/me", response_model=UserOut, tags=["Аутентификация"])
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
