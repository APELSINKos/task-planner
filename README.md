# Планировщик задач (Task Planner)

Клиент-серверное веб-приложение для системного управления личными и учебными задачами.

## О проекте

Приложение решает проблему разрозненного хранения дел в заметках, чатах и локальных файлах: единое пространство для задач, сроков, приоритетов, категорий и подзадач с синхронизацией между компьютером и смартфоном.

### Целевая аудитория
- Студенты при планировании учебных работ, дедлайнов и практик.
- Разработчики и небольшие команды для ведения личного бэклога задач.

## Пользовательские истории (User Stories) и границы MVP

1. **Регистрация и вход:** как пользователь, я хочу создать учётную запись и войти в систему, чтобы мои задачи были доступны с разных устройств и изолированы от других пользователей.
2. **Управление задачами:** как пользователь, я хочу создавать, редактировать, удалять и отмечать задачи выполненными в один клик, чтобы оперативно вести список дел.
3. **Категории и подзадачи:** как пользователь, я хочу группировать задачи по цветовым категориям (с сохранением задач при удалении категории) и разбивать крупные работы на чек-лист подзадач.
4. **Приоритеты, сроки и поиск:** как пользователь, я хочу задавать приоритет и дедлайн, видеть просроченные задачи, искать по тексту, фильтровать и сортировать список.
5. **Адаптивный доступ:** как пользователь, я хочу удобно работать со списком задач со смартфона и десктопа, а также открывать веб-демо без локальной установки.

## Приоритизация требований (MoSCoW)

| Приоритет | Состав функциональности |
|---|---|
| **Must Have** | Регистрация и аутентификация (JWT), список задач, создание/редактирование/удаление задач, отметка выполнения, изоляция данных по пользователю |
| **Should Have** | Цветовые категории (`ON DELETE SET NULL`), подзадачи (`ON DELETE CASCADE`), приоритеты (`low`/`medium`/`high`), сроки и просрочки, поиск, фильтрация, сортировка, статистика, адаптивная вёрстка (WCAG 2.0) |
| **Could Have** | Манифест PWA и базовый Service Worker, статическое демо на GitHub Pages, скрипты резервного копирования PostgreSQL (`pg_dump`) |
| **Won't Have** | Push/Telegram-уведомления по расписанию, совместные командные доски с ролевой моделью |

## Планируемый стек технологий

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2, PyJWT, bcrypt, psycopg v3
- **СУБД:** PostgreSQL 16 (`postgres:16-alpine`)
- **Frontend:** HTML5 (семантические теги, WAI-ARIA), CSS3 (БЭМ, Flexbox, Grid, mobile-first), Vanilla JS (ES6+, Fetch API), PWA
- **Инфраструктура и QA:** Docker, Docker Compose, Nginx 1.27, pytest

## Планируемая структура репозитория

```text
task-planner/
├── backend/       # REST API на FastAPI, модели ORM, схемы Pydantic, тесты pytest
├── frontend/      # Адаптивный веб-интерфейс и обратный прокси Nginx
├── docs/          # Статическая демо-сборка для GitHub Pages
├── scripts/       # Скрипты резервного копирования PostgreSQL
└── docker-compose.yml
```

## Проектирование базы данных (3НФ)

Схема приведена к третьей нормальной форме и включает 4 связанные таблицы:
- `users` (`id`, `username`, `email`, `password_hash`, `created_at`) — учётные записи пользователей.
- `categories` (`id`, `user_id`, `name`, `color`, `created_at`) — уникальные цветовые категории пользователя (`ON DELETE CASCADE` от `users`).
- `tasks` (`id`, `user_id`, `category_id`, `title`, `description`, `priority`, `status`, `is_completed`, `due_date`, `created_at`, `updated_at`) — задачи (`ON DELETE SET NULL` от `categories`).
- `subtasks` (`id`, `task_id`, `title`, `is_completed`, `created_at`) — вложенные шаги (`ON DELETE CASCADE` от `tasks`).

```mermaid
erDiagram
    USERS ||--o{ CATEGORIES : "CASCADE"
    USERS ||--o{ TASKS : "CASCADE"
    CATEGORIES ||--o{ TASKS : "SET NULL"
    TASKS ||--o{ SUBTASKS : "CASCADE"

    USERS {
        int id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        timestamptz created_at
    }
    CATEGORIES {
        int id PK
        int user_id FK
        varchar name
        varchar color
        timestamptz created_at
    }
    TASKS {
        int id PK
        int user_id FK
        int category_id FK
        varchar title
        text description
        varchar priority
        varchar status
        boolean is_completed
        date due_date
        timestamptz created_at
        timestamptz updated_at
    }
    SUBTASKS {
        int id PK
        int task_id FK
        varchar title
        boolean is_completed
        timestamptz created_at
    }
```

## Архитектура развёртывания

Три контейнера объединяются во внутренней Docker-сети `app-net`:
- `db` (`postgres:16-alpine`) — СУБД с томом `pgdata`, порт `5432` закрыт от внешнего мира.
- `backend` (`python:3.12-slim`) — FastAPI на `:8000`, запуск от непривилегированного `appuser`.
- `frontend` (`nginx:1.27-alpine`) — единая точка входа `:8080`, раздача статики и обратный прокси `/api/*` и `/docs`.

```mermaid
flowchart LR
    Client["Браузер / PWA"] <-->|"HTTP :8080"| Nginx["Nginx 1.27<br/>Статика · Proxy"]
    subgraph Net["Docker-сеть app-net"]
        Nginx -->|"/api, /docs"| Backend["FastAPI :8000"]
        Backend -->|"psycopg v3"| DB[("PostgreSQL 16 :5432")]
    end
```

## Реестр ключевых рисков

| Риск | Меры снижения |
|---|---|
| Потеря данных БД или утечка секретов в Git | Именованный том `pgdata`, скрипты `pg_dump`, исключение `.env` через `.gitignore` |
| Нарушение изоляции данных между пользователями | Обязательная фильтрация всех запросов по `user_id` из JWT и автотесты `pytest` |
| Несовместимость макета на узких мобильных экранах | Подход `mobile-first`, контроль ширины `390px` и зон нажатия ≥ `44×44 px` |

## Спецификация REST API (проект)

| Метод | Эндпоинт | Назначение |
|---|---|---|
| `GET` | `/api/health` | Проверка готовности API и подключения к БД |
| `POST` | `/api/auth/register` | Регистрация пользователя и выдача JWT |
| `POST` | `/api/auth/login` | Вход по логину или email |
| `GET` | `/api/auth/me` | Профиль текущего пользователя |
| `GET` / `POST` | `/api/categories` | Список и создание категорий |
| `PUT` / `DELETE` | `/api/categories/{id}` | Обновление и удаление категории |
| `GET` / `POST` | `/api/tasks` | Список задач (поиск/фильтры/сортировка) и создание |
| `GET` | `/api/tasks/stats` | Сводная статистика по задачам |
| `GET` / `PUT` / `DELETE` | `/api/tasks/{id}` | Карточка, редактирование и удаление задачи |
| `PATCH` | `/api/tasks/{id}/toggle` | Быстрое переключение статуса выполнения |
| `POST` | `/api/tasks/{id}/subtasks` | Добавление подзадачи |
| `PATCH` / `DELETE` | `/api/subtasks/{id}` | Переключение (`/toggle`) и удаление подзадачи |

## План этапов разработки

| Этап | Период по графику | Содержание |
|---|---|---|
| Подготовка | 1 сентября – 13 сентября | Выбор темы (вариант 13), настройка окружения и репозитория |
| Планирование | 14 сентября – 11 октября | Сбор требований, User Stories, MoSCoW, схема 3НФ, реестр рисков |
| `v0.1.0` (Backend) | 12 октября – 15 ноября | Реализация БД, FastAPI REST API, JWT + bcrypt, Swagger и тесты `pytest` |
| `v0.2.0` (Frontend) | 16 ноября – 29 ноября | Семантический адаптивный интерфейс HTML5/CSS3/БЭМ, Fetch API, PWA, GitHub Pages |
| `v0.3.0` (DevOps) | 30 ноября – 6 декабря | Финальная сборка Docker Compose, резервное копирование `pg_dump`, проверка среды |
| `v1.0.0` (QA и релиз) | 7 декабря – 20 декабря | Сквозное тестирование, Code-Review, документация и защита проекта |

Журнал изменений ведётся в [`CHANGELOG.md`](CHANGELOG.md).
