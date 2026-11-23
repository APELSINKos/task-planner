# Changelog

Все заметные изменения проекта документируются в этом файле.

## [0.3.0] — 2026-11-23

### Добавлено
- Оркестрация стека через `docker-compose.yml`: PostgreSQL 16 (`pgdata`), FastAPI (non-root `appuser`), Nginx 1.27 (`:8080`) в изолированной сети `app-net` с цепочкой `healthcheck`.
- Динамический DNS-резолвер `127.0.0.11` в `nginx.conf` и таймауты проксирования для стабильной работы при перезапуске backend.
- Скрипты резервного копирования PostgreSQL (`scripts/backup_db.sh` и `scripts/backup_db.ps1`) с записью дампа без UTF-8 BOM.
- Сохранение сессии при временной недоступности сервера, откат чекбоксов при ошибке сети и расширенные граничные тесты `pytest` (8/8).
- Базовый workflow GitHub Actions CI для прогона `pytest` (SQLite + PostgreSQL 16), валидации `docker-compose.yml` и проверки синхронности статики `frontend/` и `docs/`.

## [0.2.0] — 2026-11-20

### Добавлено
- Семантический адаптивный веб-интерфейс (HTML5, CSS3/БЭМ, Flexbox/Grid, mobile-first).
- Интеграция с REST API через `Fetch API` (`async/await`, `try/catch`, состояния `loading`, `empty`, `error`, обработка `401`).
- PWA-манифест (`manifest.webmanifest`), иконки 192×192 и 512×512, Service Worker (`sw.js`).
- Автономная демо-версия на GitHub Pages (`docs/`) с локальным хранилищем браузера.

## [0.1.0] — 2026-11-13

### Добавлено
- Реляционная схема PostgreSQL 16 в 3НФ (`users`, `categories`, `tasks`, `subtasks`) с `ON DELETE SET NULL` для категорий и `ON DELETE CASCADE` для подзадач.
- Синхронный REST API на FastAPI + SQLAlchemy 2 + Pydantic v2 (18 эндпоинтов + Swagger UI `/docs` с русскоязычными описаниями всех 5 групп и маршрутов).
- Аутентификация Bearer JWT (HS256, 24 ч), хеширование паролей `bcrypt` (12 раундов) и изоляция данных по `user_id`.
- Набор автотестов `pytest` и исправления по результатам Code-Review (проверка длины пароля ≤ 72 байт UTF-8, экранирование `ILIKE`, обработка `IntegrityError`, проверка противоречивых `status`/`is_completed`).
