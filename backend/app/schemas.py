"""Pydantic request and response schemas."""

from datetime import date, datetime
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, field_validator

PriorityType = Literal["low", "medium", "high"]
StatusType = Literal["todo", "in_progress", "done"]
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _strip_non_empty(value: str, field_label: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"Поле «{field_label}» не может быть пустым")
    return cleaned


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr = Field(max_length=120)
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
        cleaned = str(v).strip().lower()
        if len(cleaned) > 120:
            raise ValueError("Электронная почта не должна превышать 120 символов")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Пароль превышает допустимую длину (72 байта в UTF-8)")
        return v


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


class SubtaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        return _strip_non_empty(v, "Название подзадачи")


class SubtaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    title: str
    is_completed: bool
    created_at: datetime


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: PriorityType = "medium"
    status: StatusType = "todo"
    category_id: int | None = None
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        return _strip_non_empty(v, "Название задачи")

    @field_validator("description")
    @classmethod
    def clean_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: PriorityType | None = None
    status: StatusType | None = None
    is_completed: bool | None = None
    category_id: int | None = None
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        return _strip_non_empty(v, "Название задачи") if v is not None else None

    @field_validator("description")
    @classmethod
    def clean_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        return cleaned if cleaned else None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    category_id: int | None
    title: str
    description: str | None
    priority: PriorityType
    status: StatusType
    is_completed: bool
    due_date: date | None
    created_at: datetime
    updated_at: datetime
    category: CategoryOut | None = None
    subtasks: list[SubtaskOut] = Field(default_factory=list)

    @computed_field
    @property
    def is_overdue(self) -> bool:
        if self.is_completed or self.due_date is None:
            return False
        return self.due_date < date.today()


class TaskStatsOut(BaseModel):
    total: int
    active: int
    completed: int
    overdue: int
    high_priority: int
    medium_priority: int
    low_priority: int
