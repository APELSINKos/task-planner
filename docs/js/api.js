/* Local browser storage adapter for GitHub Pages static preview.
 * Full-stack version with FastAPI + PostgreSQL runs via Docker Compose (frontend/js/api.js). */

const DEMO_STORE_KEY = "task_planner_ghpages_demo_v2";
const DEMO_TOKEN_KEY = "task_planner_ghpages_token";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function _localIsoDate(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function _todayOffset(days) {
  return _localIsoDate(days);
}

function _loadStore() {
  const raw = localStorage.getItem(DEMO_STORE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_e) {}
  }
  const nowIso = new Date().toISOString();
  const initial = {
    nextId: 20,
    user: { id: 1, username: "demo_user", email: "demo@example.com", created_at: nowIso },
    categories: [
      { id: 1, name: "Практика", color: "#7c3aed", created_at: nowIso },
      { id: 2, name: "Работа", color: "#0b6a55", created_at: nowIso },
      { id: 3, name: "Учёба", color: "#2563eb", created_at: nowIso },
      { id: 4, name: "Личное", color: "#b45309", created_at: nowIso },
    ],
    tasks: [
      {
        id: 1,
        user_id: 1,
        category_id: 2,
        title: "Провести проверку отказоустойчивости REST API и Docker Compose",
        description: "Проверить автоматический перезапуск сервисов, healthcheck PostgreSQL и резервное копирование pg_dump.",
        priority: "high",
        status: "todo",
        is_completed: false,
        due_date: _todayOffset(-1),
        created_at: nowIso,
        updated_at: nowIso,
        subtasks: [
          { id: 1, task_id: 1, title: "Проверить восстановление после перезапуска backend", is_completed: true, created_at: nowIso },
          { id: 2, task_id: 1, title: "Сделать тестовый дамп и восстановить его в psql", is_completed: false, created_at: nowIso },
        ],
      },
      {
        id: 2,
        user_id: 1,
        category_id: 1,
        title: "Подготовить отчёт и презентацию к защите практики",
        description: "Собрать единый отчёт по методическим указаниям, приложить ER-диаграмму и скриншоты интерфейса.",
        priority: "high",
        status: "in_progress",
        is_completed: false,
        due_date: _todayOffset(2),
        created_at: nowIso,
        updated_at: nowIso,
        subtasks: [
          { id: 3, task_id: 2, title: "Оформить разделы 1–4 по ГОСТ и методичке", is_completed: true, created_at: nowIso },
          { id: 4, task_id: 2, title: "Проверить список литературы по ГОСТ Р 7.0.100-2018", is_completed: true, created_at: nowIso },
          { id: 5, task_id: 2, title: "Подготовить 10 слайдов презентации и тезисы защиты", is_completed: false, created_at: nowIso },
        ],
      },
      {
        id: 3,
        user_id: 1,
        category_id: 3,
        title: "Проверить доступность интерфейса по WCAG 2.0",
        description: "Протестировать навигацию с клавиатуры (Tab/Escape), видимый фокус, контрастность и размеры кнопок >= 44px.",
        priority: "medium",
        status: "in_progress",
        is_completed: false,
        due_date: _todayOffset(3),
        created_at: nowIso,
        updated_at: nowIso,
        subtasks: [
          { id: 6, task_id: 3, title: "Проверить светлую и тёмную тему", is_completed: true, created_at: nowIso },
          { id: 7, task_id: 3, title: "Проверить отображение при 390px", is_completed: false, created_at: nowIso },
        ],
      },
      {
        id: 4,
        user_id: 1,
        category_id: 4,
        title: "Составить план подготовки к зимней сессии",
        description: "Расставить приоритеты по предметам и распределить повторение по дням недели.",
        priority: "low",
        status: "todo",
        is_completed: false,
        due_date: _todayOffset(6),
        created_at: nowIso,
        updated_at: nowIso,
        subtasks: [],
      },
      {
        id: 5,
        user_id: 1,
        category_id: 2,
        title: "Настроить docker-compose.yml с healthcheck",
        description: "Объединить PostgreSQL 16, FastAPI и Nginx в единый стек с изолированной сетью.",
        priority: "high",
        status: "done",
        is_completed: true,
        due_date: _todayOffset(-2),
        created_at: nowIso,
        updated_at: nowIso,
        subtasks: [],
      },
      {
        id: 6,
        user_id: 1,
        category_id: 3,
        title: "Покрыть серверный REST API автотестами pytest",
        description: "Проверить регистрацию, JWT, CRUD, фильтрацию и изоляцию данных пользователей.",
        priority: "medium",
        status: "done",
        is_completed: true,
        due_date: _todayOffset(-3),
        created_at: nowIso,
        updated_at: nowIso,
        subtasks: [],
      },
    ],
  };
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(initial));
  return initial;
}

function _saveStore(store) {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
}

function _hydrateTask(store, task) {
  const today = _localIsoDate(0);
  const category = store.categories.find((c) => c.id === task.category_id) || null;
  return {
    ...task,
    category,
    is_overdue: !task.is_completed && Boolean(task.due_date) && task.due_date < today,
  };
}

const api = {
  isDemoMode: true,

  getToken() {
    return localStorage.getItem(DEMO_TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(DEMO_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(DEMO_TOKEN_KEY);
    }
  },

  async register(data) {
    const store = _loadStore();
    store.user = {
      id: 1,
      username: data.username,
      email: data.email,
      created_at: new Date().toISOString(),
    };
    _saveStore(store);
    return { access_token: "gh-pages-demo-token", token_type: "bearer", user: store.user };
  },

  async login(data) {
    const store = _loadStore();
    store.user.username = data.login.split("@")[0] || "demo_user";
    _saveStore(store);
    return { access_token: "gh-pages-demo-token", token_type: "bearer", user: store.user };
  },

  async getMe() {
    return _loadStore().user;
  },

  async getCategories() {
    return [..._loadStore().categories].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  },

  async createCategory(data) {
    const store = _loadStore();
    if (store.categories.some((c) => c.name.toLowerCase() === data.name.toLowerCase())) {
      throw new ApiError("Категория с таким названием уже существует", 409);
    }
    const cat = { id: store.nextId++, name: data.name, color: data.color, created_at: new Date().toISOString() };
    store.categories.push(cat);
    _saveStore(store);
    return cat;
  },

  async deleteCategory(categoryId) {
    const store = _loadStore();
    store.categories = store.categories.filter((c) => c.id !== categoryId);
    store.tasks.forEach((t) => {
      if (t.category_id === categoryId) t.category_id = null;
    });
    _saveStore(store);
    return null;
  },

  async getStats() {
    const store = _loadStore();
    const tasks = store.tasks.map((t) => _hydrateTask(store, t));
    const completed = tasks.filter((t) => t.is_completed).length;
    return {
      total: tasks.length,
      active: tasks.length - completed,
      completed,
      overdue: tasks.filter((t) => t.is_overdue).length,
      high_priority: tasks.filter((t) => t.priority === "high").length,
      medium_priority: tasks.filter((t) => t.priority === "medium").length,
      low_priority: tasks.filter((t) => t.priority === "low").length,
    };
  },

  async getTasks(params = {}) {
    const store = _loadStore();
    let tasks = store.tasks.map((t) => _hydrateTask(store, t));
    if (params.completed !== undefined && params.completed !== null) {
      tasks = tasks.filter((t) => t.is_completed === params.completed);
    }
    if (params.priority) {
      tasks = tasks.filter((t) => t.priority === params.priority);
    }
    if (params.category_id) {
      tasks = tasks.filter((t) => t.category_id === params.category_id);
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }
    const rank = { high: 1, medium: 2, low: 3 };
    tasks.sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      if (params.sort === "priority") return (rank[a.priority] || 3) - (rank[b.priority] || 3);
      if (params.sort === "due_date") return (a.due_date || "9999-99-99").localeCompare(b.due_date || "9999-99-99");
      return b.created_at.localeCompare(a.created_at);
    });
    return tasks;
  },

  async getTask(taskId) {
    const store = _loadStore();
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) throw new ApiError("Задача не найдена", 404);
    return _hydrateTask(store, task);
  },

  async createTask(data) {
    const store = _loadStore();
    const nowIso = new Date().toISOString();
    const task = {
      id: store.nextId++,
      user_id: 1,
      category_id: data.category_id || null,
      title: data.title,
      description: data.description || null,
      priority: data.priority || "medium",
      status: data.status || "todo",
      is_completed: data.status === "done",
      due_date: data.due_date || null,
      created_at: nowIso,
      updated_at: nowIso,
      subtasks: [],
    };
    store.tasks.unshift(task);
    _saveStore(store);
    return _hydrateTask(store, task);
  },

  async updateTask(taskId, data) {
    const store = _loadStore();
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) throw new ApiError("Задача не найдена", 404);
    Object.assign(task, {
      title: data.title ?? task.title,
      description: data.description !== undefined ? data.description : task.description,
      category_id: data.category_id !== undefined ? data.category_id : task.category_id,
      priority: data.priority ?? task.priority,
      status: data.status ?? task.status,
      is_completed: (data.status ?? task.status) === "done",
      due_date: data.due_date !== undefined ? data.due_date : task.due_date,
      updated_at: new Date().toISOString(),
    });
    _saveStore(store);
    return _hydrateTask(store, task);
  },

  async toggleTask(taskId) {
    const store = _loadStore();
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) throw new ApiError("Задача не найдена", 404);
    task.is_completed = !task.is_completed;
    task.status = task.is_completed ? "done" : "todo";
    task.updated_at = new Date().toISOString();
    _saveStore(store);
    return _hydrateTask(store, task);
  },

  async deleteTask(taskId) {
    const store = _loadStore();
    store.tasks = store.tasks.filter((t) => t.id !== taskId);
    _saveStore(store);
    return null;
  },

  async createSubtask(taskId, title) {
    const store = _loadStore();
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) throw new ApiError("Задача не найдена", 404);
    const sub = { id: store.nextId++, task_id: taskId, title, is_completed: false, created_at: new Date().toISOString() };
    task.subtasks.push(sub);
    _saveStore(store);
    return sub;
  },

  async toggleSubtask(subtaskId) {
    const store = _loadStore();
    for (const task of store.tasks) {
      const sub = task.subtasks.find((s) => s.id === subtaskId);
      if (sub) {
        sub.is_completed = !sub.is_completed;
        _saveStore(store);
        return sub;
      }
    }
    throw new ApiError("Подзадача не найдена", 404);
  },

  async deleteSubtask(subtaskId) {
    const store = _loadStore();
    for (const task of store.tasks) {
      const idx = task.subtasks.findIndex((s) => s.id === subtaskId);
      if (idx !== -1) {
        task.subtasks.splice(idx, 1);
        _saveStore(store);
        return null;
      }
    }
    throw new ApiError("Подзадача не найдена", 404);
  },
};
