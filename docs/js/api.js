/* Local browser storage adapter for GitHub Pages static preview.
 * Full-stack version with FastAPI + PostgreSQL runs via Docker Compose (frontend/js/api.js). */

const DEMO_STORE_KEY = "task_planner_ghpages_demo_v3";
const LEGACY_DEMO_STORE_KEYS = ["task_planner_ghpages_demo_v2", "task_planner_ghpages_demo_v1"];
const DEMO_TOKEN_KEY = "task_planner_ghpages_token";

let _memoryStore = null;
let _memoryAuthoritative = false;
let _memoryToken = null;
let _memoryTokenAuthoritative = false;

const LEGACY_SEED_DEFINITIONS = {
  task_planner_ghpages_demo_v2: {
    1: {
      titles: ["Провести проверку отказоустойчивости REST API и Docker Compose"],
      description:
        "Проверить автоматический перезапуск сервисов, healthcheck PostgreSQL и резервное копирование pg_dump.",
      priority: "high",
      status: "todo",
      is_completed: false,
      legacyOffsetDays: -1,
      seedOffsetDays: 0,
      seedRank: 5,
      subtasks: [
        { id: 1, title: "Проверить восстановление после перезапуска backend" },
        { id: 2, title: "Сделать тестовый дамп и восстановить его в psql" },
      ],
    },
    2: {
      titles: ["Подготовить отчёт и презентацию к защите практики"],
      description:
        "Собрать единый отчёт по методическим указаниям, приложить ER-диаграмму и скриншоты интерфейса.",
      priority: "high",
      status: "in_progress",
      is_completed: false,
      legacyOffsetDays: 2,
      seedOffsetDays: 2,
      seedRank: 4,
      subtasks: [
        { id: 3, title: "Оформить разделы 1–4 по ГОСТ и методичке" },
        { id: 4, title: "Проверить список литературы по ГОСТ Р 7.0.100-2018" },
        { id: 5, title: "Подготовить 10 слайдов презентации и тезисы защиты" },
      ],
    },
    3: {
      titles: ["Проверить доступность интерфейса по WCAG 2.0"],
      description:
        "Протестировать навигацию с клавиатуры (Tab/Escape), видимый фокус, контрастность и размеры кнопок >= 44px.",
      priority: "medium",
      status: "in_progress",
      is_completed: false,
      legacyOffsetDays: 3,
      seedOffsetDays: 4,
      seedRank: 3,
      subtasks: [
        { id: 6, title: "Проверить светлую и тёмную тему" },
        { id: 7, title: "Проверить отображение при 390px" },
      ],
    },
    4: {
      titles: ["Составить план подготовки к зимней сессии", "Составить план подготовки к экзаменам"],
      description:
        "Расставить приоритеты по предметам и распределить повторение по дням недели.",
      priority: "low",
      status: "todo",
      is_completed: false,
      legacyOffsetDays: 6,
      seedOffsetDays: 7,
      seedRank: 2,
      subtasks: [],
    },
    5: {
      titles: ["Настроить docker-compose.yml с healthcheck"],
      description:
        "Объединить PostgreSQL 16, FastAPI и Nginx в единый стек с изолированной сетью.",
      priority: "high",
      status: "done",
      is_completed: true,
      legacyOffsetDays: -2,
      seedOffsetDays: 0,
      seedRank: 1,
      subtasks: [],
    },
    6: {
      titles: ["Покрыть серверный REST API автотестами pytest"],
      description:
        "Проверить регистрацию, JWT, CRUD, фильтрацию и изоляцию данных пользователей.",
      priority: "medium",
      status: "done",
      is_completed: true,
      legacyOffsetDays: -3,
      seedOffsetDays: 1,
      seedRank: 0,
      subtasks: [],
    },
  },
  task_planner_ghpages_demo_v1: {
    1: {
      titles: ["Проверить адаптивную вёрстку на мобильных экранах"],
      description:
        "Проверить контрастность WCAG 2.0, видимый фокус и размеры кнопок >= 44px.",
      priority: "high",
      status: "in_progress",
      is_completed: false,
      legacyOffsetDays: 2,
      seedOffsetDays: 2,
      seedRank: 2,
      subtasks: [
        { id: 1, title: "Проверить отображение при 390px" },
        { id: 2, title: "Проверить клавиатурную навигацию Tab" },
      ],
    },
    2: {
      titles: ["Подготовить docker-compose.yml для сборки проекта"],
      description:
        "Объединить PostgreSQL, FastAPI и Nginx в единый стек с healthcheck.",
      priority: "high",
      status: "done",
      is_completed: true,
      legacyOffsetDays: -1,
      seedOffsetDays: 0,
      seedRank: 1,
      subtasks: [],
    },
    3: {
      titles: ["Составить план задач на следующую неделю"],
      description: "Расставить приоритеты по методу MoSCoW и уточнить сроки.",
      priority: "low",
      status: "todo",
      is_completed: false,
      legacyOffsetDays: 5,
      seedOffsetDays: 5,
      seedRank: 0,
      subtasks: [],
    },
  },
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function _localIsoDate(days = 0, baseDate = new Date()) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function _todayStaggeredIso(rankFromOldest, totalCount, now = new Date()) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const elapsedMs = Math.max(0, now.getTime() - startOfDay.getTime());
  if (elapsedMs < totalCount + 1) {
    return new Date(startOfDay.getTime() + rankFromOldest).toISOString();
  }
  const windowMs = Math.min(elapsedMs, 3 * 60 * 60 * 1000);
  const stepMs = windowMs / (totalCount + 1);
  const ts = now.getTime() - (totalCount - rankFromOldest) * stepMs;
  return new Date(Math.round(ts)).toISOString();
}

const DEMO_HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const DEMO_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function _isValidIsoDateString(value) {
  if (typeof value !== "string" || !DEMO_ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function _utf8ByteLength(str) {
  return typeof TextEncoder === "function" ? new TextEncoder().encode(str).length : str.length;
}

function _safeGetItem(key) {
  try {
    return { ok: true, value: localStorage.getItem(key) };
  } catch (_e) {
    return { ok: false, value: null };
  }
}

function _safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (_e) {
    return { ok: false };
  }
}

function _safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
    return { ok: true };
  } catch (_e) {
    return { ok: false };
  }
}

function _createInitialStore(now = new Date()) {
  const today = _localIsoDate(0, now);
  const totalSeed = 6;
  const ts = (rank) => _todayStaggeredIso(rank, totalSeed, now);
  const userCreated = ts(0);

  return {
    seededDate: today,
    nextId: 20,
    user: { id: 1, username: "demo_user", email: "demo@example.com", created_at: userCreated },
    categories: [
      { id: 1, name: "Практика", color: "#7c3aed", created_at: userCreated },
      { id: 2, name: "Работа", color: "#0b6a55", created_at: userCreated },
      { id: 3, name: "Учёба", color: "#2563eb", created_at: userCreated },
      { id: 4, name: "Личное", color: "#b45309", created_at: userCreated },
    ],
    tasks: [
      {
        id: 1,
        user_id: 1,
        category_id: 2,
        title: "Провести проверку отказоустойчивости REST API и Docker Compose",
        description:
          "Проверить автоматический перезапуск сервисов, healthcheck PostgreSQL и резервное копирование pg_dump.",
        priority: "high",
        status: "todo",
        is_completed: false,
        due_date: _localIsoDate(0, now),
        created_at: ts(5),
        updated_at: ts(5),
        seedOffsetDays: 0,
        seedDueCustomized: false,
        seedRank: 5,
        seedCreatedCustomized: false,
        userModified: false,
        subtasks: [
          {
            id: 1,
            task_id: 1,
            title: "Проверить восстановление после перезапуска backend",
            is_completed: true,
            created_at: ts(5),
            seedFixture: true,
          },
          {
            id: 2,
            task_id: 1,
            title: "Сделать тестовый дамп и восстановить его в psql",
            is_completed: false,
            created_at: ts(5),
            seedFixture: true,
          },
        ],
      },
      {
        id: 2,
        user_id: 1,
        category_id: 1,
        title: "Подготовить отчёт и презентацию к защите практики",
        description:
          "Собрать единый отчёт по методическим указаниям, приложить ER-диаграмму и скриншоты интерфейса.",
        priority: "high",
        status: "in_progress",
        is_completed: false,
        due_date: _localIsoDate(2, now),
        created_at: ts(4),
        updated_at: ts(4),
        seedOffsetDays: 2,
        seedDueCustomized: false,
        seedRank: 4,
        seedCreatedCustomized: false,
        userModified: false,
        subtasks: [
          {
            id: 3,
            task_id: 2,
            title: "Оформить разделы 1–4 по ГОСТ и методичке",
            is_completed: true,
            created_at: ts(4),
            seedFixture: true,
          },
          {
            id: 4,
            task_id: 2,
            title: "Проверить список литературы по ГОСТ Р 7.0.100-2018",
            is_completed: true,
            created_at: ts(4),
            seedFixture: true,
          },
          {
            id: 5,
            task_id: 2,
            title: "Подготовить 10 слайдов презентации и тезисы защиты",
            is_completed: false,
            created_at: ts(4),
            seedFixture: true,
          },
        ],
      },
      {
        id: 3,
        user_id: 1,
        category_id: 3,
        title: "Проверить доступность интерфейса по WCAG 2.0",
        description:
          "Протестировать навигацию с клавиатуры (Tab/Escape), видимый фокус, контрастность и размеры кнопок >= 44px.",
        priority: "medium",
        status: "in_progress",
        is_completed: false,
        due_date: _localIsoDate(4, now),
        created_at: ts(3),
        updated_at: ts(3),
        seedOffsetDays: 4,
        seedDueCustomized: false,
        seedRank: 3,
        seedCreatedCustomized: false,
        userModified: false,
        subtasks: [
          {
            id: 6,
            task_id: 3,
            title: "Проверить светлую и тёмную тему",
            is_completed: true,
            created_at: ts(3),
            seedFixture: true,
          },
          {
            id: 7,
            task_id: 3,
            title: "Проверить отображение при 390px",
            is_completed: false,
            created_at: ts(3),
            seedFixture: true,
          },
        ],
      },
      {
        id: 4,
        user_id: 1,
        category_id: 4,
        title: "Составить план подготовки к экзаменам",
        description:
          "Расставить приоритеты по предметам и распределить повторение по дням недели.",
        priority: "low",
        status: "todo",
        is_completed: false,
        due_date: _localIsoDate(7, now),
        created_at: ts(2),
        updated_at: ts(2),
        seedOffsetDays: 7,
        seedDueCustomized: false,
        seedRank: 2,
        seedCreatedCustomized: false,
        userModified: false,
        subtasks: [],
      },
      {
        id: 5,
        user_id: 1,
        category_id: 2,
        title: "Настроить docker-compose.yml с healthcheck",
        description:
          "Объединить PostgreSQL 16, FastAPI и Nginx в единый стек с изолированной сетью.",
        priority: "high",
        status: "done",
        is_completed: true,
        due_date: _localIsoDate(0, now),
        created_at: ts(1),
        updated_at: ts(1),
        seedOffsetDays: 0,
        seedDueCustomized: false,
        seedRank: 1,
        seedCreatedCustomized: false,
        userModified: false,
        subtasks: [],
      },
      {
        id: 6,
        user_id: 1,
        category_id: 3,
        title: "Покрыть серверный REST API автотестами pytest",
        description:
          "Проверить регистрацию, JWT, CRUD, фильтрацию и изоляцию данных пользователей.",
        priority: "medium",
        status: "done",
        is_completed: true,
        due_date: _localIsoDate(1, now),
        created_at: ts(0),
        updated_at: ts(0),
        seedOffsetDays: 1,
        seedDueCustomized: false,
        seedRank: 0,
        seedCreatedCustomized: false,
        userModified: false,
        subtasks: [],
      },
    ],
  };
}

function _saveStore(store) {
  _memoryStore = store;
  const res = _safeSetItem(DEMO_STORE_KEY, JSON.stringify(store));
  _memoryAuthoritative = !res.ok;
  return res.ok;
}

function _syncSeedDatesIfNeeded(store, now = new Date(), { persist = true } = {}) {
  const today = _localIsoDate(0, now);
  let changed = false;

  if (store.seededDate !== today) {
    store.seededDate = today;
    changed = true;
  }

  const totalSeed = Math.max(
    6,
    store.tasks.filter((t) => typeof t.seedRank === "number").length
  );

  for (const task of store.tasks) {
    if (typeof task.seedOffsetDays === "number" && !task.seedDueCustomized) {
      const expectedDue = _localIsoDate(Math.max(0, task.seedOffsetDays), now);
      if (task.due_date !== expectedDue) {
        task.due_date = expectedDue;
        changed = true;
      }
    }

    if (typeof task.seedRank === "number" && !task.seedCreatedCustomized) {
      const freshIso = _todayStaggeredIso(task.seedRank, totalSeed, now);
      const isUserModified =
        Boolean(task.userModified) ||
        (typeof task.updated_at === "string" && task.updated_at !== task.created_at);

      if (!isUserModified) {
        const parsedCreated = new Date(task.created_at);
        const createdDay = Number.isNaN(parsedCreated.getTime())
          ? ""
          : _localIsoDate(0, parsedCreated);
        if (createdDay !== today) {
          task.created_at = freshIso;
          task.updated_at = freshIso;
          changed = true;
        }
      }

      if (Array.isArray(task.subtasks)) {
        task.subtasks.forEach((sub) => {
          if (sub && sub.seedFixture === true) {
            const parsedSubCreated = new Date(sub.created_at);
            const subDay = Number.isNaN(parsedSubCreated.getTime())
              ? ""
              : _localIsoDate(0, parsedSubCreated);
            if (subDay !== today) {
              sub.created_at = freshIso;
              changed = true;
            }
          }
        });
      }
    }
  }

  if (changed && persist) {
    _saveStore(store);
  }
  return store;
}

function _migrateLegacyStore(parsed, legacyKey, now = new Date()) {
  const seedSpecs = LEGACY_SEED_DEFINITIONS[legacyKey] || {};
  const migratedTasks = parsed.tasks.map((rawTask) => {
    const task = {
      ...rawTask,
      is_completed: Boolean(rawTask.is_completed),
      due_date: rawTask.due_date || null,
      subtasks: Array.isArray(rawTask.subtasks) ? rawTask.subtasks.map((s) => ({ ...s })) : [],
    };
    const spec = seedSpecs[task.id];
    if (!spec || !spec.titles.includes(task.title)) {
      return task;
    }

    const parsedCreated = new Date(task.created_at);
    const hasValidCreated = !Number.isNaN(parsedCreated.getTime());

    let dueCustomized = true;
    if (task.due_date !== null && hasValidCreated) {
      const expectedLegacyLocal = _localIsoDate(spec.legacyOffsetDays, parsedCreated);
      const expectedV3Local = _localIsoDate(spec.seedOffsetDays, parsedCreated);
      const utcD = new Date(parsedCreated.getTime());
      utcD.setUTCDate(utcD.getUTCDate() + spec.legacyOffsetDays);
      const expectedLegacyUtc = utcD.toISOString().slice(0, 10);
      if (
        task.due_date === expectedLegacyLocal ||
        task.due_date === expectedV3Local ||
        task.due_date === expectedLegacyUtc
      ) {
        dueCustomized = false;
      }
    }

    const wasModified =
      dueCustomized ||
      (typeof task.updated_at === "string" && task.updated_at !== task.created_at) ||
      (task.description ?? null) !== spec.description ||
      task.priority !== spec.priority ||
      task.status !== spec.status ||
      task.is_completed !== spec.is_completed;

    const migratedSubtasks = task.subtasks.map((sub) => {
      const isSeedSub = spec.subtasks.some((s) => s.id === sub.id && s.title === sub.title);
      return isSeedSub ? { ...sub, seedFixture: true } : { ...sub };
    });

    return {
      ...task,
      seedOffsetDays: spec.seedOffsetDays,
      seedDueCustomized: dueCustomized,
      seedRank: spec.seedRank,
      seedCreatedCustomized: false,
      userModified: wasModified,
      subtasks: migratedSubtasks,
    };
  });

  const maxCatId = parsed.categories.reduce((m, c) => Math.max(m, c.id), 0);
  const maxTaskId = migratedTasks.reduce((m, t) => Math.max(m, t.id), 0);
  const maxSubId = migratedTasks.reduce(
    (m, t) => Math.max(m, ...(t.subtasks || []).map((s) => s.id)),
    0
  );

  return {
    seededDate: _localIsoDate(0, now),
    nextId: Math.max(parsed.nextId, maxCatId + 1, maxTaskId + 1, maxSubId + 1),
    user: { ...parsed.user },
    categories: parsed.categories.map((c) => ({ ...c })),
    tasks: migratedTasks,
  };
}

function _isValidStore(parsed) {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !parsed.user ||
    typeof parsed.user !== "object" ||
    typeof parsed.user.username !== "string" ||
    !Array.isArray(parsed.categories) ||
    !Array.isArray(parsed.tasks) ||
    !Number.isFinite(parsed.nextId)
  ) {
    return false;
  }

  const catsValid = parsed.categories.every(
    (c) =>
      c &&
      typeof c === "object" &&
      Number.isFinite(c.id) &&
      typeof c.name === "string" &&
      typeof c.color === "string"
  );
  if (!catsValid) return false;

  return parsed.tasks.every(
    (t) =>
      t &&
      typeof t === "object" &&
      Number.isFinite(t.id) &&
      typeof t.title === "string" &&
      typeof t.status === "string" &&
      typeof t.priority === "string" &&
      typeof t.created_at === "string" &&
      Array.isArray(t.subtasks) &&
      t.subtasks.every(
        (s) =>
          s &&
          typeof s === "object" &&
          Number.isFinite(s.id) &&
          typeof s.title === "string"
      )
  );
}

function _loadStore() {
  if (_memoryAuthoritative && _isValidStore(_memoryStore)) {
    return _syncSeedDatesIfNeeded(_memoryStore);
  }

  const v3Res = _safeGetItem(DEMO_STORE_KEY);
  if (v3Res.ok && v3Res.value) {
    try {
      const parsed = JSON.parse(v3Res.value);
      if (_isValidStore(parsed)) {
        _memoryStore = parsed;
        _memoryAuthoritative = false;
        return _syncSeedDatesIfNeeded(parsed);
      }
    } catch (_e) {}
  }

  if (!v3Res.ok && _isValidStore(_memoryStore)) {
    return _syncSeedDatesIfNeeded(_memoryStore);
  }

  for (const legacyKey of LEGACY_DEMO_STORE_KEYS) {
    const legacyRes = _safeGetItem(legacyKey);
    if (legacyRes.ok && legacyRes.value) {
      try {
        const parsed = JSON.parse(legacyRes.value);
        if (_isValidStore(parsed)) {
          const migrated = _migrateLegacyStore(parsed, legacyKey);
          _syncSeedDatesIfNeeded(migrated, new Date(), { persist: false });
          const saved = _saveStore(migrated);
          if (saved) {
            LEGACY_DEMO_STORE_KEYS.forEach(_safeRemoveItem);
          }
          return migrated;
        }
      } catch (_e) {}
    }
  }

  const initial = _createInitialStore();
  const saved = _saveStore(initial);
  if (saved) {
    LEGACY_DEMO_STORE_KEYS.forEach(_safeRemoveItem);
  }
  return initial;
}

function _publicSubtask(sub) {
  const { seedFixture: _sf, ...publicSub } = sub;
  return { ...publicSub };
}

function _hydrateTask(store, task) {
  const today = _localIsoDate(0);
  const category = store.categories.find((c) => c.id === task.category_id) || null;
  const {
    seedOffsetDays: _o,
    seedDueCustomized: _d,
    seedRank: _r,
    seedCreatedCustomized: _c,
    userModified: _m,
    ...publicTask
  } = task;

  return {
    ...publicTask,
    subtasks: Array.isArray(publicTask.subtasks)
      ? publicTask.subtasks.map(_publicSubtask)
      : [],
    category: category ? { ...category } : null,
    is_overdue: !publicTask.is_completed && Boolean(publicTask.due_date) && publicTask.due_date < today,
  };
}

const api = {
  isDemoMode: true,

  getToken() {
    if (_memoryTokenAuthoritative) {
      return _memoryToken;
    }
    const res = _safeGetItem(DEMO_TOKEN_KEY);
    if (res.ok) {
      const value = res.value || null;
      _memoryToken = value;
      return value;
    }
    return _memoryToken;
  },

  setToken(token) {
    const normalized = token || null;
    _memoryToken = normalized;
    const res = normalized
      ? _safeSetItem(DEMO_TOKEN_KEY, normalized)
      : _safeRemoveItem(DEMO_TOKEN_KEY);
    _memoryTokenAuthoritative = !res.ok;
  },

  async register(data) {
    const username = (data.username || "").trim();
    const email = (data.email || "").trim().toLowerCase();
    const password = typeof data.password === "string" ? data.password : "";
    if (username.length < 3 || username.length > 50) {
      throw new ApiError("Имя пользователя должно содержать от 3 до 50 символов", 422);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
      throw new ApiError("Укажите корректный адрес электронной почты", 422);
    }
    if (password.length < 6) {
      throw new ApiError("Пароль должен содержать минимум 6 символов", 422);
    }
    if (_utf8ByteLength(password) > 72) {
      throw new ApiError("Пароль превышает допустимую длину (72 байта в UTF-8)", 422);
    }
    const store = _loadStore();
    store.user = {
      id: 1,
      username,
      email,
      created_at: new Date().toISOString(),
    };
    _saveStore(store);
    return { access_token: "gh-pages-demo-token", token_type: "bearer", user: { ...store.user } };
  },

  async login(data) {
    const login = (data.login || "").trim();
    const password = typeof data.password === "string" ? data.password : "";
    if (!login || !password) {
      throw new ApiError("Заполните логин и пароль", 422);
    }
    const store = _loadStore();
    store.user.username = login.split("@")[0] || "demo_user";
    _saveStore(store);
    return { access_token: "gh-pages-demo-token", token_type: "bearer", user: { ...store.user } };
  },

  async getMe() {
    return { ..._loadStore().user };
  },

  async getCategories() {
    return [..._loadStore().categories]
      .map((c) => ({ ...c }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  },

  async createCategory(data) {
    const name = (data.name || "").trim();
    const color = (data.color || "#0b6a55").trim().toLowerCase();
    if (!name || name.length > 60) {
      throw new ApiError("Поле «Название категории» должно содержать от 1 до 60 символов", 422);
    }
    if (!DEMO_HEX_COLOR_RE.test(color)) {
      throw new ApiError("Цвет должен быть в HEX-формате, например #2563eb", 422);
    }
    const store = _loadStore();
    if (store.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new ApiError("Категория с таким названием уже существует", 409);
    }
    const cat = { id: store.nextId++, name, color, created_at: new Date().toISOString() };
    store.categories.push(cat);
    _saveStore(store);
    return { ...cat };
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
    if (params.status) {
      tasks = tasks.filter((t) => t.status === params.status);
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
      if (params.sort === "priority") {
        const diff = (rank[a.priority] || 3) - (rank[b.priority] || 3);
        if (diff !== 0) return diff;
      } else if (params.sort === "due_date") {
        const diff = (a.due_date || "9999-99-99").localeCompare(b.due_date || "9999-99-99");
        if (diff !== 0) return diff;
      }
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
    const title = (data.title || "").trim();
    if (!title || title.length > 200) {
      throw new ApiError("Поле «Название задачи» должно содержать от 1 до 200 символов", 422);
    }
    const description = data.description ? data.description.trim() || null : null;
    if (description && description.length > 2000) {
      throw new ApiError("Описание задачи не должно превышать 2000 символов", 422);
    }
    const dueDate = data.due_date || null;
    if (dueDate !== null && !_isValidIsoDateString(dueDate)) {
      throw new ApiError("Укажите корректную дату срока выполнения", 422);
    }
    const store = _loadStore();
    const nowIso = new Date().toISOString();
    const status = data.status || "todo";
    const task = {
      id: store.nextId++,
      user_id: 1,
      category_id: data.category_id || null,
      title,
      description,
      priority: data.priority || "medium",
      status,
      is_completed: status === "done",
      due_date: dueDate,
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

    const nextDue = data.due_date !== undefined ? data.due_date || null : task.due_date;
    if (nextDue !== null && !_isValidIsoDateString(nextDue)) {
      throw new ApiError("Укажите корректную дату срока выполнения", 422);
    }
    const nextTitle = data.title !== undefined ? data.title.trim() : task.title;
    if (!nextTitle || nextTitle.length > 200) {
      throw new ApiError("Поле «Название задачи» должно содержать от 1 до 200 символов", 422);
    }
    const nextDescription =
      data.description !== undefined
        ? data.description
          ? data.description.trim() || null
          : null
        : task.description;
    if (nextDescription && nextDescription.length > 2000) {
      throw new ApiError("Описание задачи не должно превышать 2000 символов", 422);
    }

    if (nextDue !== task.due_date && typeof task.seedOffsetDays === "number") {
      task.seedDueCustomized = true;
    }

    const nextStatus = data.status ?? task.status;
    Object.assign(task, {
      title: nextTitle,
      description: nextDescription,
      category_id: data.category_id !== undefined ? data.category_id : task.category_id,
      priority: data.priority ?? task.priority,
      status: nextStatus,
      is_completed: nextStatus === "done",
      due_date: nextDue,
      updated_at: new Date().toISOString(),
      userModified: true,
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
    task.userModified = true;
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
    const cleaned = (title || "").trim();
    if (!cleaned || cleaned.length > 200) {
      throw new ApiError("Поле «Название подзадачи» должно содержать от 1 до 200 символов", 422);
    }
    const store = _loadStore();
    const task = store.tasks.find((t) => t.id === taskId);
    if (!task) throw new ApiError("Задача не найдена", 404);
    const sub = {
      id: store.nextId++,
      task_id: taskId,
      title: cleaned,
      is_completed: false,
      created_at: new Date().toISOString(),
    };
    task.subtasks.push(sub);
    _saveStore(store);
    return _publicSubtask(sub);
  },

  async toggleSubtask(subtaskId) {
    const store = _loadStore();
    for (const task of store.tasks) {
      const sub = task.subtasks.find((s) => s.id === subtaskId);
      if (sub) {
        sub.is_completed = !sub.is_completed;
        _saveStore(store);
        return _publicSubtask(sub);
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
