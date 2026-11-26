/* Local browser storage adapter for GitHub Pages static preview.
 * Supports isolated local user accounts with password verification and dynamic dates.
 * Full-stack version with FastAPI + PostgreSQL runs via Docker Compose (frontend/js/api.js). */

const DEMO_STORE_KEY = "task_planner_ghpages_demo_v4";
const LEGACY_DEMO_STORE_KEYS = [
  "task_planner_ghpages_demo_v3",
  "task_planner_ghpages_demo_v2",
  "task_planner_ghpages_demo_v1",
];
const DEMO_TOKEN_KEY = "task_planner_ghpages_token";
const DEMO_TOKEN_PREFIX = "gh-pages-demo-token:";
const DEMO_DEFAULT_SALT = "tp_demo_v4_static";

const DEFAULT_USER_CATEGORIES = [
  { name: "Учёба", color: "#2563eb" },
  { name: "Работа", color: "#0b6a55" },
  { name: "Личное", color: "#b45309" },
];

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

/* Synchronous pure-JS SHA-256 for local demo password hashing across HTTP, HTTPS, and Node. */
const _SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function _utf8Bytes(str) {
  if (typeof TextEncoder === "function") {
    return Array.from(new TextEncoder().encode(str));
  }
  const encoded = unescape(encodeURIComponent(str));
  const out = [];
  for (let i = 0; i < encoded.length; i += 1) {
    out.push(encoded.charCodeAt(i));
  }
  return out;
}

function _sha256Hex(message) {
  const bytes = _utf8Bytes(message);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  bytes.push(
    (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
    (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff
  );

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Array(64);
  const rrot = (v, n) => (v >>> n) | (v << (32 - n));

  for (let i = 0; i < bytes.length; i += 64) {
    for (let j = 0; j < 16; j += 1) {
      w[j] =
        ((bytes[i + j * 4] << 24) |
          (bytes[i + j * 4 + 1] << 16) |
          (bytes[i + j * 4 + 2] << 8) |
          bytes[i + j * 4 + 3]) >>> 0;
    }
    for (let j = 16; j < 64; j += 1) {
      const s0 = rrot(w[j - 15], 7) ^ rrot(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rrot(w[j - 2], 17) ^ rrot(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j += 1) {
      const S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + _SHA256_K[j] + w[j]) >>> 0;
      const S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, "0"))
    .join("");
}

function _randomSalt() {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint8Array(12);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 12)}`;
}

async function _pbkdf2Hex(password, salt, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
}

function _iteratedSha256Hex(password, salt, rounds) {
  let acc = _sha256Hex(`${salt}:${password}`);
  for (let i = 1; i < rounds; i += 1) {
    acc = _sha256Hex(`${salt}:${acc}`);
  }
  return acc;
}

function _hashDemoSeedPassword(password, salt) {
  return `s256:${salt}:${_sha256Hex(`${salt}:${password}`)}`;
}

async function _hashDemoPassword(password, salt = _randomSalt()) {
  if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder === "function") {
    const iterations = 100000;
    const hex = await _pbkdf2Hex(password, salt, iterations);
    return `pbkdf2:${iterations}:${salt}:${hex}`;
  }
  const rounds = 2000;
  return `i256:${rounds}:${salt}:${_iteratedSha256Hex(password, salt, rounds)}`;
}

async function _verifyDemoPassword(password, storedHash) {
  if (typeof storedHash !== "string" || !storedHash) return false;
  const parts = storedHash.split(":");
  if (parts[0] === "pbkdf2" && parts.length === 4) {
    const iterations = Number(parts[1]);
    if (!Number.isSafeInteger(iterations) || iterations < 1000) return false;
    if (typeof crypto === "undefined" || !crypto.subtle || typeof TextEncoder !== "function") {
      return false;
    }
    const hex = await _pbkdf2Hex(password, parts[2], iterations);
    return hex === parts[3];
  }
  if (parts[0] === "i256" && parts.length === 4) {
    const rounds = Number(parts[1]);
    if (!Number.isSafeInteger(rounds) || rounds < 1) return false;
    return _iteratedSha256Hex(password, parts[2], rounds) === parts[3];
  }
  if (parts[0] === "s256" && parts.length === 3) {
    return _sha256Hex(`${parts[1]}:${password}`) === parts[2];
  }
  return false;
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
  return _utf8Bytes(str).length;
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

function _publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    created_at: user.created_at,
  };
}

function _parseTokenUserId(token) {
  if (!token || typeof token !== "string") return null;
  if (token === "gh-pages-demo-token") return 1;
  if (!token.startsWith(DEMO_TOKEN_PREFIX)) return null;
  const raw = token.slice(DEMO_TOKEN_PREFIX.length);
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function _makeDemoToken(userId) {
  return `${DEMO_TOKEN_PREFIX}${userId}`;
}

function _buildSeedDataForUser(userId, startId, now = new Date()) {
  const totalSeed = 6;
  const ts = (rank) => _todayStaggeredIso(rank, totalSeed, now);
  const userCreated = ts(0);
  let id = startId;
  const c1 = id++, c2 = id++, c3 = id++, c4 = id++;
  const categories = [
    { id: c1, user_id: userId, name: "Практика", color: "#7c3aed", created_at: userCreated },
    { id: c2, user_id: userId, name: "Работа", color: "#0b6a55", created_at: userCreated },
    { id: c3, user_id: userId, name: "Учёба", color: "#2563eb", created_at: userCreated },
    { id: c4, user_id: userId, name: "Личное", color: "#b45309", created_at: userCreated },
  ];
  const t1 = id++, t2 = id++, t3 = id++, t4 = id++, t5 = id++, t6 = id++;
  const tasks = [
    {
      id: t1, user_id: userId, category_id: c2,
      title: "Провести проверку отказоустойчивости REST API и Docker Compose",
      description: "Проверить автоматический перезапуск сервисов, healthcheck PostgreSQL и резервное копирование pg_dump.",
      priority: "high", status: "todo", is_completed: false, due_date: _localIsoDate(0, now),
      created_at: ts(5), updated_at: ts(5),
      seedOffsetDays: 0, seedDueCustomized: false, seedRank: 5, seedCreatedCustomized: false, userModified: false,
      subtasks: [
        { id: id++, task_id: t1, title: "Проверить восстановление после перезапуска backend", is_completed: true, created_at: ts(5), seedFixture: true },
        { id: id++, task_id: t1, title: "Сделать тестовый дамп и восстановить его в psql", is_completed: false, created_at: ts(5), seedFixture: true },
      ],
    },
    {
      id: t2, user_id: userId, category_id: c1,
      title: "Подготовить отчёт и презентацию к защите практики",
      description: "Собрать единый отчёт по методическим указаниям, приложить ER-диаграмму и скриншоты интерфейса.",
      priority: "high", status: "in_progress", is_completed: false, due_date: _localIsoDate(2, now),
      created_at: ts(4), updated_at: ts(4),
      seedOffsetDays: 2, seedDueCustomized: false, seedRank: 4, seedCreatedCustomized: false, userModified: false,
      subtasks: [
        { id: id++, task_id: t2, title: "Оформить разделы 1–4 по ГОСТ и методичке", is_completed: true, created_at: ts(4), seedFixture: true },
        { id: id++, task_id: t2, title: "Проверить список литературы по ГОСТ Р 7.0.100-2018", is_completed: true, created_at: ts(4), seedFixture: true },
        { id: id++, task_id: t2, title: "Подготовить 10 слайдов презентации и тезисы защиты", is_completed: false, created_at: ts(4), seedFixture: true },
      ],
    },
    {
      id: t3, user_id: userId, category_id: c3,
      title: "Проверить доступность интерфейса по WCAG 2.0",
      description: "Протестировать навигацию с клавиатуры (Tab/Escape), видимый фокус, контрастность и размеры кнопок >= 44px.",
      priority: "medium", status: "in_progress", is_completed: false, due_date: _localIsoDate(4, now),
      created_at: ts(3), updated_at: ts(3),
      seedOffsetDays: 4, seedDueCustomized: false, seedRank: 3, seedCreatedCustomized: false, userModified: false,
      subtasks: [
        { id: id++, task_id: t3, title: "Проверить светлую и тёмную тему", is_completed: true, created_at: ts(3), seedFixture: true },
        { id: id++, task_id: t3, title: "Проверить отображение при 390px", is_completed: false, created_at: ts(3), seedFixture: true },
      ],
    },
    {
      id: t4, user_id: userId, category_id: c4,
      title: "Составить план подготовки к экзаменам",
      description: "Расставить приоритеты по предметам и распределить повторение по дням недели.",
      priority: "low", status: "todo", is_completed: false, due_date: _localIsoDate(7, now),
      created_at: ts(2), updated_at: ts(2),
      seedOffsetDays: 7, seedDueCustomized: false, seedRank: 2, seedCreatedCustomized: false, userModified: false,
      subtasks: [],
    },
    {
      id: t5, user_id: userId, category_id: c2,
      title: "Настроить docker-compose.yml с healthcheck",
      description: "Объединить PostgreSQL 16, FastAPI и Nginx в единый стек с изолированной сетью.",
      priority: "high", status: "done", is_completed: true, due_date: _localIsoDate(0, now),
      created_at: ts(1), updated_at: ts(1),
      seedOffsetDays: 0, seedDueCustomized: false, seedRank: 1, seedCreatedCustomized: false, userModified: false,
      subtasks: [],
    },
    {
      id: t6, user_id: userId, category_id: c3,
      title: "Покрыть серверный REST API автотестами pytest",
      description: "Проверить регистрацию, JWT, CRUD, фильтрацию и изоляцию данных пользователей.",
      priority: "medium", status: "done", is_completed: true, due_date: _localIsoDate(1, now),
      created_at: ts(0), updated_at: ts(0),
      seedOffsetDays: 1, seedDueCustomized: false, seedRank: 0, seedCreatedCustomized: false, userModified: false,
      subtasks: [],
    },
  ];
  return { categories, tasks, nextId: id, userCreated };
}

function _createInitialStore(now = new Date()) {
  const today = _localIsoDate(0, now);
  const totalSeed = 6;
  const ts = (rank) => _todayStaggeredIso(rank, totalSeed, now);
  const userCreated = ts(0);
  const demoUser = {
    id: 1,
    username: "demo_user",
    email: "demo@example.com",
    passwordHash: _hashDemoSeedPassword("demo", DEMO_DEFAULT_SALT),
    created_at: userCreated,
  };

  return {
    seededDate: today,
    nextId: 20,
    users: [demoUser],
    categories: [
      { id: 1, user_id: 1, name: "Практика", color: "#7c3aed", created_at: userCreated },
      { id: 2, user_id: 1, name: "Работа", color: "#0b6a55", created_at: userCreated },
      { id: 3, user_id: 1, name: "Учёба", color: "#2563eb", created_at: userCreated },
      { id: 4, user_id: 1, name: "Личное", color: "#b45309", created_at: userCreated },
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
      user_id: Number.isFinite(rawTask.user_id) ? rawTask.user_id : 1,
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

  const legacyUsername = (parsed.user.username || "demo_user").trim() || "demo_user";
  const isLegacyDemo = legacyUsername.toLowerCase() === "demo_user";
  let legacyEmail = (parsed.user.email || "demo@example.com").trim().toLowerCase();
  if (!isLegacyDemo && legacyEmail === "demo@example.com") {
    const safeLocal = legacyUsername.toLowerCase().replace(/[^a-z0-9._-]/g, "_") || "user";
    legacyEmail = `${safeLocal}@local.demo`;
  }

  const legacyUser = {
    id: 1,
    username: legacyUsername,
    email: legacyEmail,
    // Never silently assign the public demo password to migrated personal profiles
    passwordHash: isLegacyDemo ? _hashDemoSeedPassword("demo", DEMO_DEFAULT_SALT) : "",
    created_at: parsed.user.created_at || now.toISOString(),
  };

  const migratedCategories = parsed.categories.map((c) => ({
    ...c,
    user_id: Number.isFinite(c.user_id) ? c.user_id : 1,
  }));

  const maxCatId = migratedCategories.reduce((m, c) => Math.max(m, c.id), 0);
  const maxTaskId = migratedTasks.reduce((m, t) => Math.max(m, t.id), 0);
  const maxSubId = migratedTasks.reduce(
    (m, t) => Math.max(m, ...(t.subtasks || []).map((s) => s.id)),
    0
  );
  let nextId = Math.max(parsed.nextId, maxCatId + 1, maxTaskId + 1, maxSubId + 1, 2);

  const users = [legacyUser];
  if (!isLegacyDemo) {
    const demoId = nextId++;
    const seed = _buildSeedDataForUser(demoId, nextId, now);
    nextId = seed.nextId;
    users.push({
      id: demoId,
      username: "demo_user",
      email: "demo@example.com",
      passwordHash: _hashDemoSeedPassword("demo", DEMO_DEFAULT_SALT),
      created_at: seed.userCreated,
    });
    migratedCategories.push(...seed.categories);
    migratedTasks.push(...seed.tasks);
  }

  return {
    seededDate: parsed.seededDate || _localIsoDate(0, now),
    nextId,
    users,
    categories: migratedCategories,
    tasks: migratedTasks,
  };
}

function _isValidLegacyStore(parsed) {
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

function _isValidStore(parsed) {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray(parsed.users) ||
    parsed.users.length === 0 ||
    !Array.isArray(parsed.categories) ||
    !Array.isArray(parsed.tasks) ||
    !Number.isFinite(parsed.nextId)
  ) {
    return false;
  }

  const usersValid = parsed.users.every(
    (u) =>
      u &&
      typeof u === "object" &&
      Number.isFinite(u.id) &&
      typeof u.username === "string" &&
      typeof u.email === "string" &&
      typeof u.passwordHash === "string"
  );
  if (!usersValid) return false;

  const catsValid = parsed.categories.every(
    (c) =>
      c &&
      typeof c === "object" &&
      Number.isFinite(c.id) &&
      Number.isFinite(c.user_id) &&
      typeof c.name === "string" &&
      typeof c.color === "string"
  );
  if (!catsValid) return false;

  return parsed.tasks.every(
    (t) =>
      t &&
      typeof t === "object" &&
      Number.isFinite(t.id) &&
      Number.isFinite(t.user_id) &&
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

  const v4Res = _safeGetItem(DEMO_STORE_KEY);
  if (v4Res.ok && v4Res.value) {
    try {
      const parsed = JSON.parse(v4Res.value);
      if (_isValidStore(parsed)) {
        _memoryStore = parsed;
        _memoryAuthoritative = false;
        return _syncSeedDatesIfNeeded(parsed);
      }
    } catch (_e) {}
  }

  if (!v4Res.ok && _isValidStore(_memoryStore)) {
    return _syncSeedDatesIfNeeded(_memoryStore);
  }

  for (const legacyKey of LEGACY_DEMO_STORE_KEYS) {
    const legacyRes = _safeGetItem(legacyKey);
    if (legacyRes.ok && legacyRes.value) {
      try {
        const parsed = JSON.parse(legacyRes.value);
        if (_isValidLegacyStore(parsed)) {
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

function _requireCurrentUser(store) {
  const userId = _parseTokenUserId(api.getToken());
  if (!userId) {
    throw new ApiError("Требуется авторизация", 401);
  }
  const user = store.users.find((u) => u.id === userId);
  if (!user) {
    throw new ApiError("Требуется авторизация", 401);
  }
  return user;
}

function _publicCategory(cat) {
  return {
    id: cat.id,
    name: cat.name,
    color: cat.color,
    created_at: cat.created_at,
  };
}

function _publicSubtask(sub) {
  const { seedFixture: _sf, ...publicSub } = sub;
  return { ...publicSub };
}

function _hydrateTask(store, task) {
  const today = _localIsoDate(0);
  const category =
    store.categories.find((c) => c.id === task.category_id && c.user_id === task.user_id) || null;
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
    category: category ? _publicCategory(category) : null,
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
    const uLower = username.toLowerCase();
    const duplicate = store.users.some(
      (u) =>
        u.username.toLowerCase() === uLower ||
        u.email.toLowerCase() === uLower ||
        u.username.toLowerCase() === email ||
        u.email.toLowerCase() === email
    );
    if (duplicate) {
      throw new ApiError("Пользователь с таким именем или email уже существует", 409);
    }

    const nowIso = new Date().toISOString();
    const passwordHash = await _hashDemoPassword(password);
    const prevNextId = store.nextId;
    const prevUsersLen = store.users.length;
    const prevCatsLen = store.categories.length;

    const newUser = {
      id: store.nextId++,
      username,
      email,
      passwordHash,
      created_at: nowIso,
    };
    store.users.push(newUser);
    for (const defCat of DEFAULT_USER_CATEGORIES) {
      store.categories.push({
        id: store.nextId++,
        user_id: newUser.id,
        name: defCat.name,
        color: defCat.color,
        created_at: nowIso,
      });
    }
    if (!_saveStore(store)) {
      store.nextId = prevNextId;
      store.users.length = prevUsersLen;
      store.categories.length = prevCatsLen;
      throw new ApiError(
        "Не удалось сохранить профиль: хранилище браузера недоступно или переполнено",
        507
      );
    }

    return {
      access_token: _makeDemoToken(newUser.id),
      token_type: "bearer",
      user: _publicUser(newUser),
    };
  },

  async login(data) {
    const login = (data.login || "").trim().toLowerCase();
    const password = typeof data.password === "string" ? data.password : "";
    if (!login || !password) {
      throw new ApiError("Заполните логин и пароль", 422);
    }
    if (_utf8ByteLength(password) > 72) {
      throw new ApiError("Неверный логин или пароль", 401);
    }

    const store = _loadStore();
    const candidates = store.users.filter(
      (u) => u.username.toLowerCase() === login || u.email.toLowerCase() === login
    );
    let matched = null;
    for (const u of candidates) {
      if (await _verifyDemoPassword(password, u.passwordHash)) {
        matched = u;
        break;
      }
    }
    if (!matched) {
      throw new ApiError("Неверный логин или пароль", 401);
    }

    return {
      access_token: _makeDemoToken(matched.id),
      token_type: "bearer",
      user: _publicUser(matched),
    };
  },

  async getMe() {
    const store = _loadStore();
    return _publicUser(_requireCurrentUser(store));
  },

  async getCategories() {
    const store = _loadStore();
    const user = _requireCurrentUser(store);
    return store.categories
      .filter((c) => c.user_id === user.id)
      .map(_publicCategory)
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
    const user = _requireCurrentUser(store);
    if (
      store.categories.some(
        (c) => c.user_id === user.id && c.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      throw new ApiError("Категория с таким названием уже существует", 409);
    }
    const cat = {
      id: store.nextId++,
      user_id: user.id,
      name,
      color,
      created_at: new Date().toISOString(),
    };
    store.categories.push(cat);
    _saveStore(store);
    return _publicCategory(cat);
  },

  async deleteCategory(categoryId) {
    const store = _loadStore();
    const user = _requireCurrentUser(store);
    const exists = store.categories.some((c) => c.id === categoryId && c.user_id === user.id);
    if (!exists) {
      throw new ApiError("Категория не найдена", 404);
    }
    store.categories = store.categories.filter(
      (c) => !(c.id === categoryId && c.user_id === user.id)
    );
    store.tasks.forEach((t) => {
      if (t.user_id === user.id && t.category_id === categoryId) {
        t.category_id = null;
      }
    });
    _saveStore(store);
    return null;
  },

  async getStats() {
    const store = _loadStore();
    const user = _requireCurrentUser(store);
    const tasks = store.tasks
      .filter((t) => t.user_id === user.id)
      .map((t) => _hydrateTask(store, t));
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
    const user = _requireCurrentUser(store);
    let tasks = store.tasks
      .filter((t) => t.user_id === user.id)
      .map((t) => _hydrateTask(store, t));
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
    const user = _requireCurrentUser(store);
    const task = store.tasks.find((t) => t.id === taskId && t.user_id === user.id);
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
    const user = _requireCurrentUser(store);
    const categoryId = data.category_id || null;
    if (
      categoryId !== null &&
      !store.categories.some((c) => c.id === categoryId && c.user_id === user.id)
    ) {
      throw new ApiError("Указанная категория не найдена", 404);
    }
    const nowIso = new Date().toISOString();
    const status = data.status || "todo";
    const task = {
      id: store.nextId++,
      user_id: user.id,
      category_id: categoryId,
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
    const user = _requireCurrentUser(store);
    const task = store.tasks.find((t) => t.id === taskId && t.user_id === user.id);
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
    const nextCategoryId = data.category_id !== undefined ? data.category_id || null : task.category_id;
    if (
      nextCategoryId !== null &&
      !store.categories.some((c) => c.id === nextCategoryId && c.user_id === user.id)
    ) {
      throw new ApiError("Указанная категория не найдена", 404);
    }

    if (nextDue !== task.due_date && typeof task.seedOffsetDays === "number") {
      task.seedDueCustomized = true;
    }

    const nextStatus = data.status ?? task.status;
    Object.assign(task, {
      title: nextTitle,
      description: nextDescription,
      category_id: nextCategoryId,
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
    const user = _requireCurrentUser(store);
    const task = store.tasks.find((t) => t.id === taskId && t.user_id === user.id);
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
    const user = _requireCurrentUser(store);
    const exists = store.tasks.some((t) => t.id === taskId && t.user_id === user.id);
    if (!exists) throw new ApiError("Задача не найдена", 404);
    store.tasks = store.tasks.filter((t) => !(t.id === taskId && t.user_id === user.id));
    _saveStore(store);
    return null;
  },

  async createSubtask(taskId, title) {
    const cleaned = (title || "").trim();
    if (!cleaned || cleaned.length > 200) {
      throw new ApiError("Поле «Название подзадачи» должно содержать от 1 до 200 символов", 422);
    }
    const store = _loadStore();
    const user = _requireCurrentUser(store);
    const task = store.tasks.find((t) => t.id === taskId && t.user_id === user.id);
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
    const user = _requireCurrentUser(store);
    for (const task of store.tasks) {
      if (task.user_id !== user.id) continue;
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
    const user = _requireCurrentUser(store);
    for (const task of store.tasks) {
      if (task.user_id !== user.id) continue;
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
