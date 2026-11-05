"""FastAPI application entry point and REST API endpoints."""

from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case, func, or_, select, text
from sqlalchemy.orm import Session, joinedload

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.config import settings
from app.database import Base, engine, get_db
from app.models import Category, Subtask, Task, User
from app.schemas import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    PriorityType,
    StatusType,
    SubtaskCreate,
    SubtaskOut,
    TaskCreate,
    TaskOut,
    TaskStatsOut,
    TaskUpdate,
    TokenOut,
    UserLogin,
    UserOut,
    UserRegister,
)

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


def _get_user_task_or_404(db: Session, user_id: int, task_id: int) -> Task:
    stmt = (
        select(Task)
        .options(joinedload(Task.category), joinedload(Task.subtasks))
        .where(Task.id == task_id, Task.user_id == user_id)
    )
    task = db.execute(stmt).unique().scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задача не найдена")
    return task


def _validate_user_category(db: Session, user_id: int, category_id: int | None) -> None:
    if category_id is None:
        return
    exists = db.execute(
        select(Category.id).where(Category.id == category_id, Category.user_id == user_id)
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Указанная категория не найдена",
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


@app.get("/api/categories", response_model=list[CategoryOut], tags=["Категории"])
def list_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Category)
        .where(Category.user_id == current_user.id)
        .order_by(Category.name.asc())
    )
    return list(db.execute(stmt).scalars().all())


@app.post("/api/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED, tags=["Категории"])
def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_categories = db.execute(
        select(Category).where(Category.user_id == current_user.id)
    ).scalars().all()
    if any(c.name.casefold() == payload.name.casefold() for c in user_categories):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Категория с таким названием уже существует",
        )

    category = Category(user_id=current_user.id, name=payload.name, color=payload.color)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@app.put("/api/categories/{category_id}", response_model=CategoryOut, tags=["Категории"])
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == current_user.id)
    ).scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    if payload.name is not None:
        other_categories = db.execute(
            select(Category).where(
                Category.user_id == current_user.id,
                Category.id != category_id,
            )
        ).scalars().all()
        if any(c.name.casefold() == payload.name.casefold() for c in other_categories):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Категория с таким названием уже существует",
            )
        category.name = payload.name

    if payload.color is not None:
        category.color = payload.color

    db.commit()
    db.refresh(category)
    return category


@app.delete("/api/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Категории"])
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    category = db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == current_user.id)
    ).scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/tasks/stats", response_model=TaskStatsOut, tags=["Задачи"])
def get_task_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tasks = list(db.execute(select(Task).where(Task.user_id == current_user.id)).scalars().all())
    today = date.today()
    completed = sum(1 for t in tasks if t.is_completed)
    active = len(tasks) - completed
    overdue = sum(1 for t in tasks if not t.is_completed and t.due_date is not None and t.due_date < today)
    return TaskStatsOut(
        total=len(tasks),
        active=active,
        completed=completed,
        overdue=overdue,
        high_priority=sum(1 for t in tasks if t.priority == "high"),
        medium_priority=sum(1 for t in tasks if t.priority == "medium"),
        low_priority=sum(1 for t in tasks if t.priority == "low"),
    )


@app.get("/api/tasks", response_model=list[TaskOut], tags=["Задачи"])
def list_tasks(
    completed: bool | None = Query(default=None),
    status_filter: StatusType | None = Query(default=None, alias="status"),
    priority: PriorityType | None = Query(default=None),
    category_id: int | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100),
    sort: str = Query(default="created_at", pattern="^(created_at|due_date|priority)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Task)
        .options(joinedload(Task.category), joinedload(Task.subtasks))
        .where(Task.user_id == current_user.id)
    )

    if completed is not None:
        stmt = stmt.where(Task.is_completed == completed)
    if status_filter is not None:
        stmt = stmt.where(Task.status == status_filter)
    if priority is not None:
        stmt = stmt.where(Task.priority == priority)
    if category_id is not None:
        stmt = stmt.where(Task.category_id == category_id)
    if search:
        term = search.strip()
        if term:
            pattern = f"%{term}%"
            stmt = stmt.where(or_(Task.title.ilike(pattern), Task.description.ilike(pattern)))

    if sort == "due_date":
        stmt = stmt.order_by(Task.is_completed.asc(), Task.due_date.asc().nullslast(), Task.created_at.desc())
    elif sort == "priority":
        priority_rank = case(
            (Task.priority == "high", 1),
            (Task.priority == "medium", 2),
            else_=3,
        )
        stmt = stmt.order_by(Task.is_completed.asc(), priority_rank.asc(), Task.created_at.desc())
    else:
        stmt = stmt.order_by(Task.is_completed.asc(), Task.created_at.desc())

    return list(db.execute(stmt).unique().scalars().all())


@app.get("/api/tasks/{task_id}", response_model=TaskOut, tags=["Задачи"])
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_user_task_or_404(db, current_user.id, task_id)


@app.post("/api/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED, tags=["Задачи"])
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_user_category(db, current_user.id, payload.category_id)
    is_completed = payload.status == "done"

    task = Task(
        user_id=current_user.id,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        status=payload.status,
        is_completed=is_completed,
        due_date=payload.due_date,
    )
    db.add(task)
    db.commit()
    return _get_user_task_or_404(db, current_user.id, task.id)


@app.put("/api/tasks/{task_id}", response_model=TaskOut, tags=["Задачи"])
def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_user_task_or_404(db, current_user.id, task_id)
    fields = payload.model_fields_set

    if "category_id" in fields:
        _validate_user_category(db, current_user.id, payload.category_id)
        task.category_id = payload.category_id
    if "title" in fields and payload.title is not None:
        task.title = payload.title
    if "description" in fields:
        task.description = payload.description
    if "priority" in fields and payload.priority is not None:
        task.priority = payload.priority
    if "due_date" in fields:
        task.due_date = payload.due_date

    # Keep status and is_completed synchronized regardless of which field changed
    if "status" in fields and payload.status is not None:
        task.status = payload.status
        task.is_completed = payload.status == "done"
    elif "is_completed" in fields and payload.is_completed is not None:
        task.is_completed = payload.is_completed
        task.status = "done" if payload.is_completed else ("todo" if task.status == "done" else task.status)

    db.commit()
    return _get_user_task_or_404(db, current_user.id, task.id)


@app.patch("/api/tasks/{task_id}/toggle", response_model=TaskOut, tags=["Задачи"])
def toggle_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_user_task_or_404(db, current_user.id, task_id)
    task.is_completed = not task.is_completed
    task.status = "done" if task.is_completed else "todo"
    db.commit()
    return _get_user_task_or_404(db, current_user.id, task.id)


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Задачи"])
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_user_task_or_404(db, current_user.id, task_id)
    db.delete(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/tasks/{task_id}/subtasks", response_model=SubtaskOut, status_code=status.HTTP_201_CREATED, tags=["Подзадачи"])
def create_subtask(
    task_id: int,
    payload: SubtaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_user_task_or_404(db, current_user.id, task_id)
    subtask = Subtask(task_id=task.id, title=payload.title)
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    return subtask


@app.patch("/api/subtasks/{subtask_id}/toggle", response_model=SubtaskOut, tags=["Подзадачи"])
def toggle_subtask(
    subtask_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Subtask)
        .join(Task, Subtask.task_id == Task.id)
        .where(Subtask.id == subtask_id, Task.user_id == current_user.id)
    )
    subtask = db.execute(stmt).scalar_one_or_none()
    if subtask is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Подзадача не найдена")

    subtask.is_completed = not subtask.is_completed
    db.commit()
    db.refresh(subtask)
    return subtask


@app.delete("/api/subtasks/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Подзадачи"])
def delete_subtask(
    subtask_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Subtask)
        .join(Task, Subtask.task_id == Task.id)
        .where(Subtask.id == subtask_id, Task.user_id == current_user.id)
    )
    subtask = db.execute(stmt).scalar_one_or_none()
    if subtask is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Подзадача не найдена")

    db.delete(subtask)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
