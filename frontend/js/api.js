/* REST API client using Fetch API, async/await, and Bearer JWT authentication. */

const TOKEN_STORAGE_KEY = "task_planner_jwt";
let _memoryToken = null;
let _memoryAuthoritative = false;

function _safeStorageGet(key) {
  try {
    return { ok: true, value: localStorage.getItem(key) };
  } catch (_e) {
    return { ok: false, value: null };
  }
}

function _safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (_e) {
    return { ok: false };
  }
}

function _safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
    return { ok: true };
  } catch (_e) {
    return { ok: false };
  }
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const api = {
  getToken() {
    if (_memoryAuthoritative) {
      return _memoryToken;
    }
    const res = _safeStorageGet(TOKEN_STORAGE_KEY);
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
      ? _safeStorageSet(TOKEN_STORAGE_KEY, normalized)
      : _safeStorageRemove(TOKEN_STORAGE_KEY);
    _memoryAuthoritative = !res.ok;
  },

  async request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = this.getToken();

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response;
    try {
      response = await fetch(`/api${path}`, {
        method: options.method || "GET",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (_networkErr) {
      throw new ApiError("Не удалось подключиться к серверу. Проверьте соединение.", 0);
    }

    if (response.status === 204) {
      return null;
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (_parseErr) {
      payload = null;
    }

    if (!response.ok) {
      let message = `Ошибка сервера (${response.status})`;
      if (payload && typeof payload.detail === "string") {
        message = payload.detail;
      } else if (payload && Array.isArray(payload.detail) && payload.detail.length > 0) {
        message = payload.detail.map((item) => item.msg || "Ошибка валидации").join("; ");
      }
      throw new ApiError(message, response.status);
    }

    return payload;
  },

  register(data) {
    return this.request("/auth/register", { method: "POST", body: data });
  },

  login(data) {
    return this.request("/auth/login", { method: "POST", body: data });
  },

  getMe() {
    return this.request("/auth/me");
  },

  getCategories() {
    return this.request("/categories");
  },

  createCategory(data) {
    return this.request("/categories", { method: "POST", body: data });
  },

  deleteCategory(categoryId) {
    return this.request(`/categories/${categoryId}`, { method: "DELETE" });
  },

  getStats() {
    return this.request("/tasks/stats");
  },

  getTasks(params = {}) {
    const query = new URLSearchParams();
    if (params.completed !== undefined && params.completed !== null) {
      query.set("completed", String(params.completed));
    }
    if (params.status) {
      query.set("status", params.status);
    }
    if (params.priority) {
      query.set("priority", params.priority);
    }
    if (params.category_id) {
      query.set("category_id", String(params.category_id));
    }
    if (params.search && params.search.trim()) {
      query.set("search", params.search.trim());
    }
    if (params.sort) {
      query.set("sort", params.sort);
    }
    const qs = query.toString();
    return this.request(qs ? `/tasks?${qs}` : "/tasks");
  },

  getTask(taskId) {
    return this.request(`/tasks/${taskId}`);
  },

  createTask(data) {
    return this.request("/tasks", { method: "POST", body: data });
  },

  updateTask(taskId, data) {
    return this.request(`/tasks/${taskId}`, { method: "PUT", body: data });
  },

  toggleTask(taskId) {
    return this.request(`/tasks/${taskId}/toggle`, { method: "PATCH" });
  },

  deleteTask(taskId) {
    return this.request(`/tasks/${taskId}`, { method: "DELETE" });
  },

  createSubtask(taskId, title) {
    return this.request(`/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: { title },
    });
  },

  toggleSubtask(subtaskId) {
    return this.request(`/subtasks/${subtaskId}/toggle`, { method: "PATCH" });
  },

  deleteSubtask(subtaskId) {
    return this.request(`/subtasks/${subtaskId}`, { method: "DELETE" });
  },
};
