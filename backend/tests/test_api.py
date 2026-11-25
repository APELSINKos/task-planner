"""Automated API tests for Task Planner backend."""

from datetime import date, timedelta
import os

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password
from app.database import Base, get_db
import app.main as app_main
from app.main import app
from app.models import Subtask, User


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    test_db_url = os.getenv("TEST_DATABASE_URL")
    if test_db_url:
        engine = create_engine(test_db_url, pool_pre_ping=True)
    else:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(engine, "connect")
        def _enable_fk(dbapi_conn, _record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    monkeypatch.setattr(app_main, "engine", engine)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _register_and_headers(client: TestClient, username: str, email: str, password: str = "secret123") -> dict[str, str]:
    resp = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_healthcheck(client: TestClient):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "database": "connected"}


def test_register_login_and_me(client: TestClient):
    reg = client.post(
        "/api/auth/register",
        json={"username": "alex_dev", "email": "Alex@Example.com", "password": "password123"},
    )
    assert reg.status_code == 201
    data = reg.json()
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "alex@example.com"
    assert "password_hash" not in data["user"]

    # Duplicate email or username must fail with 409
    dup = client.post(
        "/api/auth/register",
        json={"username": "other_user", "email": "alex@example.com", "password": "password123"},
    )
    assert dup.status_code == 409

    # Register second user and confirm dual-account username+email conflict returns 409 (never 500)
    reg2 = client.post(
        "/api/auth/register",
        json={"username": "second_dev", "email": "second@example.com", "password": "password123"},
    )
    assert reg2.status_code == 201
    dual_dup = client.post(
        "/api/auth/register",
        json={"username": "alex_dev", "email": "second@example.com", "password": "password123"},
    )
    assert dual_dup.status_code == 409

    # Cross-field collision (new user's email matches existing username) must return 409
    reg_at = client.post(
        "/api/auth/register",
        json={"username": "alice@example.com", "email": "real_alice@example.com", "password": "password123"},
    )
    assert reg_at.status_code == 201
    cross_dup = client.post(
        "/api/auth/register",
        json={"username": "bob_dev", "email": "alice@example.com", "password": "password456"},
    )
    assert cross_dup.status_code == 409

    # Even if legacy DB rows share username/email across accounts, login must never 500
    with sessionmaker(bind=app_main.engine)() as db:
        db.add(User(username="legacy_bob", email="alice@example.com", password_hash=hash_password("legacyPass99")))
        db.commit()
    legacy_login = client.post("/api/auth/login", json={"login": "alice@example.com", "password": "legacyPass99"})
    assert legacy_login.status_code == 200
    assert legacy_login.json()["user"]["username"] == "legacy_bob"
    legacy_bad = client.post("/api/auth/login", json={"login": "alice@example.com", "password": "wrongPassword"})
    assert legacy_bad.status_code == 401

    # Email exceeding 120 chars must be rejected with 422
    long_email = f"{'a' * 60}@{'b' * 55}.example.com"
    assert len(long_email) > 120
    too_long_email = client.post(
        "/api/auth/register",
        json={"username": "long_mail_user", "email": long_email, "password": "password123"},
    )
    assert too_long_email.status_code == 422

    # Login by username and email both work
    login_by_email = client.post("/api/auth/login", json={"login": "alex@example.com", "password": "password123"})
    assert login_by_email.status_code == 200
    token = login_by_email.json()["access_token"]

    login_by_user = client.post("/api/auth/login", json={"login": "ALEX_DEV", "password": "password123"})
    assert login_by_user.status_code == 200

    # Wrong password -> 401
    bad_login = client.post("/api/auth/login", json={"login": "alex_dev", "password": "wrong"})
    assert bad_login.status_code == 401

    # /me requires valid token
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"}).status_code == 401

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "alex_dev"


def test_categories_crud_and_defaults(client: TestClient):
    headers = _register_and_headers(client, "cat_user", "cat@example.com")

    # Registration creates 3 default categories
    cats = client.get("/api/categories", headers=headers)
    assert cats.status_code == 200
    assert len(cats.json()) == 3

    created = client.post(
        "/api/categories",
        headers=headers,
        json={"name": "Практика", "color": "#7c3aed"},
    )
    assert created.status_code == 201
    cat_id = created.json()["id"]

    # Duplicate name for same user -> 409
    dup = client.post(
        "/api/categories",
        headers=headers,
        json={"name": "практика", "color": "#111111"},
    )
    assert dup.status_code == 409

    # Invalid hex color -> 422
    bad_color = client.post(
        "/api/categories",
        headers=headers,
        json={"name": "Спорт", "color": "red"},
    )
    assert bad_color.status_code == 422

    # Update category
    upd = client.put(
        f"/api/categories/{cat_id}",
        headers=headers,
        json={"name": "Учебная практика", "color": "#059669"},
    )
    assert upd.status_code == 200
    assert upd.json()["name"] == "Учебная практика"
    assert upd.json()["color"] == "#059669"

    # Delete category keeps attached task with category_id=None
    task_resp = client.post(
        "/api/tasks",
        headers=headers,
        json={"title": "Сдать отчёт", "category_id": cat_id},
    )
    assert task_resp.status_code == 201
    task_id = task_resp.json()["id"]

    del_resp = client.delete(f"/api/categories/{cat_id}", headers=headers)
    assert del_resp.status_code == 204

    task_after = client.get(f"/api/tasks/{task_id}", headers=headers)
    assert task_after.status_code == 200
    assert task_after.json()["category_id"] is None


def test_tasks_crud_toggle_filters_and_stats(client: TestClient):
    headers = _register_and_headers(client, "task_user", "tasks@example.com")
    cats = client.get("/api/categories", headers=headers).json()
    cat_id = cats[0]["id"]

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    t1 = client.post(
        "/api/tasks",
        headers=headers,
        json={
            "title": "Спроектировать схему БД",
            "description": "Подготовить ER-диаграмму для PostgreSQL",
            "priority": "high",
            "category_id": cat_id,
            "due_date": yesterday,
        },
    )
    assert t1.status_code == 201
    t1_data = t1.json()
    assert t1_data["is_completed"] is False
    assert t1_data["is_overdue"] is True

    t2 = client.post(
        "/api/tasks",
        headers=headers,
        json={
            "title": "Настроить Docker Compose",
            "priority": "medium",
            "status": "in_progress",
            "due_date": tomorrow,
        },
    )
    assert t2.status_code == 201
    t2_id = t2.json()["id"]

    # Toggle completion syncs status <-> is_completed
    toggled = client.patch(f"/api/tasks/{t1_data['id']}/toggle", headers=headers)
    assert toggled.status_code == 200
    assert toggled.json()["is_completed"] is True
    assert toggled.json()["status"] == "done"
    assert toggled.json()["is_overdue"] is False

    # Untoggle
    untoggled = client.patch(f"/api/tasks/{t1_data['id']}/toggle", headers=headers)
    assert untoggled.status_code == 200
    assert untoggled.json()["is_completed"] is False
    assert untoggled.json()["status"] == "todo"

    # Update task
    updated = client.put(
        f"/api/tasks/{t2_id}",
        headers=headers,
        json={"title": "Настроить Docker Compose и Nginx", "priority": "low", "status": "done"},
    )
    assert updated.status_code == 200
    assert updated.json()["is_completed"] is True
    assert updated.json()["priority"] == "low"

    # Filter & search & sort
    only_active = client.get("/api/tasks?completed=false", headers=headers)
    assert len(only_active.json()) == 1
    assert only_active.json()[0]["id"] == t1_data["id"]

    searched = client.get("/api/tasks?search=Docker", headers=headers)
    assert len(searched.json()) == 1
    assert searched.json()[0]["id"] == t2_id

    # Stats
    stats = client.get("/api/tasks/stats", headers=headers)
    assert stats.status_code == 200
    assert stats.json() == {
        "total": 2,
        "active": 1,
        "completed": 1,
        "overdue": 1,
        "high_priority": 1,
        "medium_priority": 0,
        "low_priority": 1,
    }

    # Verify sort order across active tasks (priority rank, due_date asc NULLS LAST, completed last)
    two_days_ago = (date.today() - timedelta(days=2)).isoformat()
    t3_id = client.post(
        "/api/tasks",
        headers=headers,
        json={"title": "Низкий приоритет, ранний срок", "priority": "low", "due_date": two_days_ago},
    ).json()["id"]
    t4_id = client.post(
        "/api/tasks",
        headers=headers,
        json={"title": "Средний приоритет, без срока", "priority": "medium", "due_date": None},
    ).json()["id"]

    by_priority = client.get("/api/tasks?sort=priority", headers=headers)
    assert by_priority.status_code == 200
    assert [t["id"] for t in by_priority.json()] == [t1_data["id"], t4_id, t3_id, t2_id]

    by_due = client.get("/api/tasks?sort=due_date", headers=headers)
    assert by_due.status_code == 200
    assert [t["id"] for t in by_due.json()] == [t3_id, t1_data["id"], t4_id, t2_id]

    # Delete task
    assert client.delete(f"/api/tasks/{t2_id}", headers=headers).status_code == 204
    assert client.get(f"/api/tasks/{t2_id}", headers=headers).status_code == 404


def test_subtasks_and_cascade_delete(client: TestClient):
    headers = _register_and_headers(client, "sub_user", "sub@example.com")
    task_id = client.post("/api/tasks", headers=headers, json={"title": "Подготовить защиту"}).json()["id"]

    sub = client.post(f"/api/tasks/{task_id}/subtasks", headers=headers, json={"title": "Сделать презентацию"})
    assert sub.status_code == 201
    sub_id = sub.json()["id"]
    assert sub.json()["is_completed"] is False

    toggled = client.patch(f"/api/subtasks/{sub_id}/toggle", headers=headers)
    assert toggled.status_code == 200
    assert toggled.json()["is_completed"] is True

    task_detail = client.get(f"/api/tasks/{task_id}", headers=headers).json()
    assert len(task_detail["subtasks"]) == 1
    assert task_detail["subtasks"][0]["is_completed"] is True

    # Delete subtask directly
    assert client.delete(f"/api/subtasks/{sub_id}", headers=headers).status_code == 204
    assert client.get(f"/api/tasks/{task_id}", headers=headers).json()["subtasks"] == []

    # Deleting parent task cascades to all child subtasks
    sub2_id = client.post(
        f"/api/tasks/{task_id}/subtasks", headers=headers, json={"title": "Проверить Docker"}
    ).json()["id"]
    sub3_id = client.post(
        f"/api/tasks/{task_id}/subtasks", headers=headers, json={"title": "Прогнать pytest"}
    ).json()["id"]
    assert client.delete(f"/api/tasks/{task_id}", headers=headers).status_code == 204
    assert client.get(f"/api/tasks/{task_id}", headers=headers).status_code == 404
    assert client.patch(f"/api/subtasks/{sub2_id}/toggle", headers=headers).status_code == 404
    assert client.delete(f"/api/subtasks/{sub3_id}", headers=headers).status_code == 404

    with sessionmaker(bind=app_main.engine)() as db:
        remaining = db.execute(select(Subtask).where(Subtask.task_id == task_id)).scalars().all()
        assert remaining == []


def test_user_data_isolation_and_validation(client: TestClient):
    h1 = _register_and_headers(client, "user_one", "one@example.com")
    h2 = _register_and_headers(client, "user_two", "two@example.com")

    cat1_id = client.get("/api/categories", headers=h1).json()[0]["id"]
    task1_id = client.post("/api/tasks", headers=h1, json={"title": "Секретная задача"}).json()["id"]
    sub1_id = client.post(
        f"/api/tasks/{task1_id}/subtasks", headers=h1, json={"title": "Внутренний шаг"}
    ).json()["id"]

    # User 2 cannot view, edit, toggle, or delete User 1's task, category, or subtask
    assert client.get(f"/api/tasks/{task1_id}", headers=h2).status_code == 404
    assert client.put(f"/api/tasks/{task1_id}", headers=h2, json={"title": "Взлом"}).status_code == 404
    assert client.patch(f"/api/tasks/{task1_id}/toggle", headers=h2).status_code == 404
    assert client.delete(f"/api/tasks/{task1_id}", headers=h2).status_code == 404
    assert client.put(f"/api/categories/{cat1_id}", headers=h2, json={"name": "Чужая"}).status_code == 404
    assert client.delete(f"/api/categories/{cat1_id}", headers=h2).status_code == 404
    assert client.patch(f"/api/subtasks/{sub1_id}/toggle", headers=h2).status_code == 404
    assert client.delete(f"/api/subtasks/{sub1_id}", headers=h2).status_code == 404

    # User 2 cannot attach User 1's category to their task
    bad_cat_task = client.post(
        "/api/tasks",
        headers=h2,
        json={"title": "Чужая категория", "category_id": cat1_id},
    )
    assert bad_cat_task.status_code == 404

    # Blank title rejected
    blank = client.post("/api/tasks", headers=h1, json={"title": "   "})
    assert blank.status_code == 422


def test_edge_cases_password_bytes_search_escaping_and_status_conflict(client: TestClient):
    # 40 Cyrillic characters = 80 UTF-8 bytes (> bcrypt 72-byte limit) -> clean 422
    long_cyrillic = "пароль" * 7  # 42 Cyrillic chars = 84 bytes
    resp = client.post(
        "/api/auth/register",
        json={"username": "cyr_user", "email": "cyr@example.com", "password": long_cyrillic},
    )
    assert resp.status_code == 422

    headers = _register_and_headers(client, "edge_user", "edge@example.com")
    client.post("/api/tasks", headers=headers, json={"title": "Готовность 100%"})
    client.post("/api/tasks", headers=headers, json={"title": "Готовность 1000"})
    client.post("/api/tasks", headers=headers, json={"title": "Отчёт_2026"})
    client.post("/api/tasks", headers=headers, json={"title": "ОтчётX2026"})

    # Searching "100%" and "_" must match literally, not treat "%" or "_" as SQL wildcards
    matched = client.get("/api/tasks?search=100%25", headers=headers)
    assert matched.status_code == 200
    assert [t["title"] for t in matched.json()] == ["Готовность 100%"]

    matched_underscore = client.get("/api/tasks?search=Отчёт_2026", headers=headers)
    assert matched_underscore.status_code == 200
    assert [t["title"] for t in matched_underscore.json()] == ["Отчёт_2026"]

    # Contradictory status and is_completed must fail with 422
    task_id = matched.json()[0]["id"]
    conflict = client.put(
        f"/api/tasks/{task_id}",
        headers=headers,
        json={"status": "done", "is_completed": False},
    )
    assert conflict.status_code == 422

    # Expired JWT token rejected with 401
    from datetime import datetime, timedelta, timezone
    import jwt
    from app.config import settings

    expired = jwt.encode(
        {"sub": "1", "exp": int((datetime.now(timezone.utc) - timedelta(minutes=5)).timestamp())},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_category_rename_conflict_task_null_clear_and_long_login(client: TestClient):
    headers = _register_and_headers(client, "qa_user", "qa@example.com")

    # Login with >72 UTF-8 byte Cyrillic password must return 401, never 500 or silent truncation
    exact_72_bytes = "п" * 36  # 36 Cyrillic chars == 72 UTF-8 bytes
    _register_and_headers(client, "exact72_user", "exact72@example.com", password=exact_72_bytes)
    assert (
        client.post("/api/auth/login", json={"login": "exact72_user", "password": exact_72_bytes}).status_code
        == 200
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"login": "exact72_user", "password": f"{exact_72_bytes}а"},
        ).status_code
        == 401
    )

    long_login = client.post(
        "/api/auth/login",
        json={"login": "qa_user", "password": "пароль" * 7},
    )
    assert long_login.status_code == 401

    cats = client.get("/api/categories", headers=headers).json()
    c1_id = cats[0]["id"]
    c2_name = cats[1]["name"]

    # Renaming category to an existing category name (different Cyrillic case) -> 409
    dup_rename = client.put(
        f"/api/categories/{c1_id}",
        headers=headers,
        json={"name": c2_name.upper()},
    )
    assert dup_rename.status_code == 409

    # Clearing nullable fields category_id and due_date via PUT -> null persisted
    created = client.post(
        "/api/tasks",
        headers=headers,
        json={"title": "Задача с категорией и сроком", "category_id": c1_id, "due_date": date.today().isoformat()},
    ).json()
    cleared = client.put(
        f"/api/tasks/{created['id']}",
        headers=headers,
        json={"category_id": None, "due_date": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["category_id"] is None
    assert cleared.json()["due_date"] is None


