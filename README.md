# Планировщик задач (Task Planner)

Веб-приложение для управления задачами: создание и редактирование задач, отметка о выполнении, категории, подзадачи, приоритеты, сроки выполнения, фильтрация, поиск и сводная статистика.

## Демо-версия

Статический предпросмотр интерфейса опубликован на GitHub Pages: https://apelsinkos.github.io/task-planner/

## Стек технологий

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2, PyJWT, bcrypt
- **СУБД:** PostgreSQL 16 (`postgres:16-alpine`)
- **Frontend:** HTML5 (семантическая вёрстка), CSS3 (БЭМ, Flexbox, Grid, mobile-first, WCAG 2.0), JavaScript (ES6+, Fetch API), PWA manifest
- **Инфраструктура:** Docker, Docker Compose, Nginx 1.27 (обратный прокси)

## Архитектура и структура проекта

```text
task-planner/
├── backend/              # REST API на FastAPI + SQLAlchemy + тесты pytest
│   ├── app/
│   │   ├── auth.py       # Хеширование паролей bcrypt и JWT (HS256)
│   │   ├── config.py     # Конфигурация из переменных окружения
│   │   ├── database.py   # Подключение к БД и сессии SQLAlchemy
│   │   ├── main.py       # Эндпоинты REST API и бизнес-логика
│   │   ├── models.py     # ORM-модели: users, categories, tasks, subtasks
│   │   └── schemas.py    # Схемы валидации Pydantic v2
│   ├── tests/            # Автоматизированные тесты pytest
│   └── Dockerfile
├── frontend/             # Адаптивный веб-интерфейс и конфигурация Nginx
│   ├── css/styles.css
│   ├── js/api.js         # Клиент REST API (Fetch API + Bearer JWT)
│   ├── js/motion.js      # Скролл-анимация обзора, интерактивные карточки и переключение темы
│   ├── js/app.js         # Логика экрана входа, задач, категорий и подзадач
│   ├── icons/
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── nginx.conf
│   └── Dockerfile
├── docs/                 # Статическая сборка для GitHub Pages
├── scripts/              # Скрипты резервного копирования PostgreSQL (pg_dump)
├── docker-compose.yml
└── .env.example
```

## Запуск через Docker Compose

Требования: Docker Engine и Docker Compose. Конфигурация задаётся через `.env` по шаблону `.env.example`.

```bash
git clone https://github.com/APELSINKos/task-planner.git
cd task-planner
cp .env.example .env
docker compose up --build -d
docker compose ps
```

После запуска:
- Веб-приложение: `http://localhost:8080`
- Документация API (Swagger UI): `http://localhost:8080/docs`
- Проверка работоспособности: `http://localhost:8080/api/health`

Остановка контейнеров:

```bash
docker compose down
```

## Основные эндпоинты API

| Метод | Адрес | Описание |
|---|---|---|
| `GET` | `/api/health` | Проверка состояния API и подключения к PostgreSQL |
| `POST` | `/api/auth/register` | Регистрация пользователя и выдача JWT |
| `POST` | `/api/auth/login` | Вход по логину или email и выдача JWT |
| `GET` | `/api/auth/me` | Данные текущего авторизованного пользователя |
| `GET` / `POST` | `/api/categories` | Список и создание категорий |
| `PUT` / `DELETE` | `/api/categories/{id}` | Обновление и удаление категории |
| `GET` / `POST` | `/api/tasks` | Список задач (поиск, фильтры, сортировка) и создание задачи |
| `GET` | `/api/tasks/stats` | Сводная статистика (всего, активные, выполненные, просроченные) |
| `GET` / `PUT` / `DELETE` | `/api/tasks/{id}` | Просмотр, редактирование и удаление задачи |
| `PATCH` | `/api/tasks/{id}/toggle` | Переключение статуса выполнения задачи |
| `POST` | `/api/tasks/{id}/subtasks` | Добавление подзадачи |
| `PATCH` / `DELETE` | `/api/subtasks/{id}` | Отметка выполнения (`/toggle`) и удаление подзадачи |

## Тестирование и резервное копирование

Запуск автоматизированных тестов внутри контейнера:

```bash
docker compose exec backend pytest -v
```

Создание резервной копии базы данных PostgreSQL:

```bash
# Linux / macOS / Git Bash
./scripts/backup_db.sh

# PowerShell (Windows)
.\scripts\backup_db.ps1
```
