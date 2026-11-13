# Changelog

Все заметные изменения проекта документируются в этом файле.

## [0.1.0] — 2026-11-13

### Добавлено
- Реляционная схема PostgreSQL 16 в 3НФ (`users`, `categories`, `tasks`, `subtasks`) с `ON DELETE SET NULL` для категорий и `ON DELETE CASCADE` для подзадач.
- Синхронный REST API на FastAPI + SQLAlchemy 2 + Pydantic v2 (18 эндпоинтов + Swagger UI `/docs` с русскоязычными описаниями всех 5 групп и маршрутов).
- Аутентификация Bearer JWT (HS256, 24 ч), хеширование паролей `bcrypt` (12 раундов) и изоляция данных по `user_id`.
- Набор автотестов `pytest` и исправления по результатам Code-Review (проверка длины пароля ≤ 72 байт UTF-8, экранирование `ILIKE`, обработка `IntegrityError`, проверка противоречивых `status`/`is_completed`).
