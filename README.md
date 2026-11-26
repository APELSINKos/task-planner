# Планировщик задач (Task Planner)

Веб-приложение для управления личными и учебными задачами: список задач, категории, подзадачи, приоритеты, дедлайны, фильтрация и статистика выполнения.

## Стек технологий

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2, PyJWT, bcrypt
- **База данных:** PostgreSQL 16
- **Frontend:** HTML5, CSS3 (БЭМ, Flexbox, Grid, mobile-first, WCAG 2.0), JavaScript (ES6+, Fetch API), PWA manifest
- **Инфраструктура:** Docker, Docker Compose, Nginx

## Быстрый старт

```bash
cp .env.example .env
docker compose up --build -d
```

После запуска приложение доступно по адресу `http://localhost:8080`, документация API (Swagger UI) — `http://localhost:8080/docs`.
