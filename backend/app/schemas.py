"""Pydantic request and response schemas."""

from datetime import datetime
import re
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _strip_non_empty(value: str, field_label: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"Поле «{field_label}» не может быть пустым")
    return cleaned


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        cleaned = _strip_non_empty(v, "Имя пользователя")
        if len(cleaned) < 3:
            raise ValueError("Имя пользователя должно содержать минимум 3 символа")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        return str(v).strip().lower()


class UserLogin(BaseModel):
    login: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1, max_length=72)

    @field_validator("login")
    @classmethod
    def normalize_login(cls, v: str) -> str:
        return _strip_non_empty(v, "Логин или email").lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(default="#2563eb")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _strip_non_empty(v, "Название категории")

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        v = v.strip()
        if not HEX_COLOR_RE.match(v):
            raise ValueError("Цвет должен быть в HEX-формате, например #2563eb")
        return v.lower()


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    color: str | None = Field(default=None)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        return _strip_non_empty(v, "Название категории") if v is not None else None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not HEX_COLOR_RE.match(v):
            raise ValueError("Цвет должен быть в HEX-формате, например #2563eb")
        return v.lower()


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    created_at: datetime
