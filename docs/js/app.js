/* Main UI controller for Task Planner web application. */

const PRIORITY_LABELS = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

const STATUS_LABELS = {
  todo: "К выполнению",
  in_progress: "В работе",
  done: "Выполнено",
};

const state = {
  user: null,
  categories: [],
  tasks: [],
  stats: null,
  selectedCategoryId: null,
  statusFilter: "all",
  priorityFilter: "",
  search: "",
  sort: "created_at",
  activeDetailTaskId: null,
  searchTimer: null,
  toastTimer: null,
  tasksRequestSeq: 0,
  lastFocusedElement: null,
};

const el = {
  headerActions: document.getElementById("header-actions"),
  headerUsername: document.getElementById("header-username"),
  btnLogout: document.getElementById("btn-logout"),
  btnOpenCreate: document.getElementById("btn-open-create"),
  btnOpenCreateMobile: document.getElementById("btn-open-create-mobile"),
  btnEmptyCreate: document.getElementById("btn-empty-create"),
  globalError: document.getElementById("global-error"),
  globalErrorText: document.getElementById("global-error-text"),
  btnRetry: document.getElementById("btn-retry"),
  globalToast: document.getElementById("global-toast"),
  globalToastText: document.getElementById("global-toast-text"),

  authView: document.getElementById("auth-view"),
  appView: document.getElementById("app-view"),
  tabLogin: document.getElementById("tab-login"),
  tabRegister: document.getElementById("tab-register"),
  authError: document.getElementById("auth-error"),
  authErrorText: document.getElementById("auth-error-text"),
  loginForm: document.getElementById("login-form"),
  registerForm: document.getElementById("register-form"),

  statTotal: document.getElementById("stat-total"),
  statActive: document.getElementById("stat-active"),
  statCompleted: document.getElementById("stat-completed"),
  statOverdue: document.getElementById("stat-overdue"),

  categoryList: document.getElementById("category-list"),
  categoryForm: document.getElementById("category-form"),
  newCategoryName: document.getElementById("new-category-name"),
  newCategoryColor: document.getElementById("new-category-color"),

  filterSearch: document.getElementById("filter-search"),
  filterStatus: document.getElementById("filter-status"),
  filterPriority: document.getElementById("filter-priority"),
  filterSort: document.getElementById("filter-sort"),

  tasksLoading: document.getElementById("tasks-loading"),
  tasksEmpty: document.getElementById("tasks-empty"),
  taskList: document.getElementById("task-list"),

  taskModal: document.getElementById("task-modal"),
  taskModalTitle: document.getElementById("task-modal-title"),
  taskFormError: document.getElementById("task-form-error"),
  taskFormErrorText: document.getElementById("task-form-error-text"),
  taskForm: document.getElementById("task-form"),
  taskId: document.getElementById("task-id"),
  taskTitle: document.getElementById("task-title"),
  taskDescription: document.getElementById("task-description"),
  taskCategory: document.getElementById("task-category"),
  taskPriority: document.getElementById("task-priority"),
  taskStatus: document.getElementById("task-status"),
  taskDueDate: document.getElementById("task-due-date"),

  detailModal: document.getElementById("detail-modal"),
  detailModalTitle: document.getElementById("detail-modal-title"),
  detailBadges: document.getElementById("detail-badges"),
  detailDescription: document.getElementById("detail-description"),
  detailDates: document.getElementById("detail-dates"),
  detailSubtaskList: document.getElementById("detail-subtask-list"),
  detailSubtasksEmpty: document.getElementById("detail-subtasks-empty"),
  subtaskForm: document.getElementById("subtask-form"),
  newSubtaskTitle: document.getElementById("new-subtask-title"),
  btnDetailToggle: document.getElementById("btn-detail-toggle"),
  btnDetailEdit: document.getElementById("btn-detail-edit"),
};

function showGlobalError(message) {
  el.globalErrorText.textContent = message;
  el.globalError.hidden = false;
}

function hideGlobalError() {
  el.globalError.hidden = true;
}

function showToast(message) {
  el.globalToastText.textContent = message;
  el.globalToast.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    el.globalToast.hidden = true;
  }, 3000);
}

function showAuthError(message) {
  el.authErrorText.textContent = message;
  el.authError.hidden = false;
}

function hideAuthError() {
  el.authError.hidden = true;
}

function formatDateRu(isoDate) {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function setAuthTab(mode) {
  const isLogin = mode === "login";
  el.tabLogin.classList.toggle("auth-tabs__btn--active", isLogin);
  el.tabRegister.classList.toggle("auth-tabs__btn--active", !isLogin);
  el.tabLogin.setAttribute("aria-selected", String(isLogin));
  el.tabRegister.setAttribute("aria-selected", String(!isLogin));
  el.loginForm.hidden = !isLogin;
  el.registerForm.hidden = isLogin;
  hideAuthError();
}

function showAuthView(message = "") {
  state.user = null;
  el.authView.hidden = false;
  el.appView.hidden = true;
  el.headerActions.hidden = true;
  hideGlobalError();
  if (message) {
    showAuthError(message);
  }
}

function showAppView() {
  el.authView.hidden = true;
  el.appView.hidden = false;
  el.headerActions.hidden = false;
  el.headerUsername.textContent = state.user ? state.user.username : "";
}

function handleApiError(err, fallbackMessage = "Произошла ошибка") {
  if (err && err.status === 401) {
    api.setToken(null);
    resetFilters();
    closeModal(el.taskModal);
    closeModal(el.detailModal);
    showAuthView("Сессия истекла. Пожалуйста, войдите снова.");
    return;
  }
  showGlobalError(err?.message || fallbackMessage);
}

function openModal(modalElement) {
  if (document.activeElement instanceof HTMLElement) {
    state.lastFocusedElement = document.activeElement;
  }
  modalElement.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal(modalElement) {
  if (modalElement.hidden) return;
  modalElement.hidden = true;
  if (el.taskModal.hidden && el.detailModal.hidden) {
    document.body.style.overflow = "";
    if (state.lastFocusedElement && document.contains(state.lastFocusedElement)) {
      state.lastFocusedElement.focus();
      state.lastFocusedElement = null;
    }
  }
}

function resetFilters() {
  clearTimeout(state.searchTimer);
  state.selectedCategoryId = null;
  state.statusFilter = "all";
  state.priorityFilter = "";
  state.search = "";
  state.sort = "created_at";
  el.filterSearch.value = "";
  el.filterStatus.value = "all";
  el.filterPriority.value = "";
  el.filterSort.value = "created_at";
}

function renderStats() {
  if (!state.stats) return;
  el.statTotal.textContent = String(state.stats.total);
  el.statActive.textContent = String(state.stats.active);
  el.statCompleted.textContent = String(state.stats.completed);
  el.statOverdue.textContent = String(state.stats.overdue);
}

function renderCategories() {
  el.categoryList.innerHTML = "";

  const allItem = document.createElement("li");
  allItem.className = "category-list__row";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `category-list__btn ${state.selectedCategoryId === null ? "category-list__btn--active" : ""}`;
  allBtn.textContent = "Все задачи";
  allBtn.addEventListener("click", () => {
    state.selectedCategoryId = null;
    renderCategories();
    loadTasks();
  });
  allItem.appendChild(allBtn);
  el.categoryList.appendChild(allItem);

  for (const cat of state.categories) {
    const li = document.createElement("li");
    li.className = "category-list__row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `category-list__btn ${state.selectedCategoryId === cat.id ? "category-list__btn--active" : ""}`;

    const dot = document.createElement("span");
    dot.className = "category-list__dot";
    dot.style.backgroundColor = cat.color;
    dot.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.textContent = cat.name;

    btn.appendChild(dot);
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      state.selectedCategoryId = cat.id;
      renderCategories();
      loadTasks();
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-btn";
    delBtn.textContent = "×";
    delBtn.setAttribute("aria-label", `Удалить категорию ${cat.name}`);
    delBtn.addEventListener("click", () => handleDeleteCategory(cat));

    li.appendChild(btn);
    li.appendChild(delBtn);
    el.categoryList.appendChild(li);
  }

  // Sync category options inside task modal select
  const currentVal = el.taskCategory.value;
  el.taskCategory.innerHTML = "";
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "Без категории";
  el.taskCategory.appendChild(noneOpt);

  for (const cat of state.categories) {
    const opt = document.createElement("option");
    opt.value = String(cat.id);
    opt.textContent = cat.name;
    el.taskCategory.appendChild(opt);
  }
  el.taskCategory.value = currentVal;
}

function createBadge(text, modifier = "badge--neutral", dotColor = null) {
  const span = document.createElement("span");
  span.className = `badge ${modifier}`;
  if (dotColor) {
    const dot = document.createElement("span");
    dot.className = "category-list__dot";
    dot.style.backgroundColor = dotColor;
    dot.setAttribute("aria-hidden", "true");
    span.appendChild(dot);
  }
  span.appendChild(document.createTextNode(text));
  return span;
}

function renderTasks() {
  el.taskList.innerHTML = "";

  if (state.tasks.length === 0) {
    el.tasksEmpty.hidden = false;
    return;
  }
  el.tasksEmpty.hidden = true;

  for (const task of state.tasks) {
    const li = document.createElement("li");
    li.className = `task-card ${task.is_completed ? "task-card--completed" : ""}`;

    const mainRow = document.createElement("div");
    mainRow.className = "task-card__main";

    const checkWrap = document.createElement("label");
    checkWrap.className = "task-card__check-wrap";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-card__checkbox";
    checkbox.checked = task.is_completed;
    checkbox.setAttribute("aria-label", `Отметить задачу «${task.title}» выполненной`);
    checkbox.addEventListener("change", () => handleToggleTask(task.id, checkbox));
    checkWrap.appendChild(checkbox);

    const content = document.createElement("div");
    content.className = "task-card__content";

    const title = document.createElement("h3");
    title.className = "task-card__title";
    title.textContent = task.title;
    content.appendChild(title);

    if (task.description) {
      const desc = document.createElement("p");
      desc.className = "task-card__desc";
      desc.textContent = task.description.length > 140
        ? `${task.description.slice(0, 140)}…`
        : task.description;
      content.appendChild(desc);
    }

    const meta = document.createElement("div");
    meta.className = "task-card__meta";

    meta.appendChild(createBadge(PRIORITY_LABELS[task.priority] || task.priority, `badge--priority-${task.priority}`));
    meta.appendChild(createBadge(STATUS_LABELS[task.status] || task.status, "badge--neutral"));

    if (task.category) {
      meta.appendChild(createBadge(task.category.name, "badge--neutral", task.category.color));
    }

    if (task.due_date) {
      const dateText = `До ${formatDateRu(task.due_date)}`;
      meta.appendChild(createBadge(dateText, task.is_overdue ? "badge--overdue" : "badge--neutral"));
    }

    if (task.subtasks && task.subtasks.length > 0) {
      const doneCount = task.subtasks.filter((s) => s.is_completed).length;
      meta.appendChild(createBadge(`Подзадачи: ${doneCount}/${task.subtasks.length}`, "badge--neutral"));
    }

    content.appendChild(meta);
    mainRow.appendChild(checkWrap);
    mainRow.appendChild(content);

    const actions = document.createElement("div");
    actions.className = "task-card__actions";

    const detailBtn = document.createElement("button");
    detailBtn.type = "button";
    detailBtn.className = "btn btn--secondary btn--sm";
    detailBtn.textContent = "Подробнее";
    detailBtn.addEventListener("click", () => openDetailModal(task.id));

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn--ghost btn--sm";
    editBtn.textContent = "Изменить";
    editBtn.addEventListener("click", () => openTaskModal(task));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn--danger-ghost btn--sm";
    delBtn.textContent = "Удалить";
    delBtn.addEventListener("click", () => handleDeleteTask(task));

    actions.appendChild(detailBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(mainRow);
    li.appendChild(actions);
    el.taskList.appendChild(li);
  }
}

async function loadWorkspace() {
  hideGlobalError();
  el.tasksLoading.hidden = false;
  el.tasksEmpty.hidden = true;
  try {
    const [categories, stats] = await Promise.all([api.getCategories(), api.getStats()]);
    state.categories = categories;
    state.stats = stats;
    renderCategories();
    renderStats();
    await loadTasks();
  } catch (err) {
    el.tasksLoading.hidden = true;
    handleApiError(err, "Не удалось загрузить рабочую область");
  }
}

async function loadTasks() {
  hideGlobalError();
  el.tasksLoading.hidden = false;
  el.tasksEmpty.hidden = true;

  const requestSeq = ++state.tasksRequestSeq;
  const params = {
    sort: state.sort,
    search: state.search,
  };
  if (state.statusFilter === "active") params.completed = false;
  if (state.statusFilter === "completed") params.completed = true;
  if (state.priorityFilter) params.priority = state.priorityFilter;
  if (state.selectedCategoryId !== null) params.category_id = state.selectedCategoryId;

  try {
    const [tasks, stats] = await Promise.all([api.getTasks(params), api.getStats()]);
    if (requestSeq !== state.tasksRequestSeq) {
      return;
    }
    state.tasks = tasks;
    state.stats = stats;
    el.tasksLoading.hidden = true;
    renderStats();
    renderTasks();
  } catch (err) {
    if (requestSeq !== state.tasksRequestSeq) {
      return;
    }
    el.tasksLoading.hidden = true;
    handleApiError(err, "Не удалось загрузить задачи");
  }
}

function openTaskModal(task = null) {
  el.taskFormError.hidden = true;
  el.taskForm.reset();
  renderCategories();

  if (task) {
    el.taskModalTitle.textContent = "Редактировать задачу";
    el.taskId.value = String(task.id);
    el.taskTitle.value = task.title;
    el.taskDescription.value = task.description || "";
    el.taskCategory.value = task.category_id ? String(task.category_id) : "";
    el.taskPriority.value = task.priority;
    el.taskStatus.value = task.status;
    el.taskDueDate.value = task.due_date || "";
  } else {
    el.taskModalTitle.textContent = "Новая задача";
    el.taskId.value = "";
    el.taskPriority.value = "medium";
    el.taskStatus.value = "todo";
    if (state.selectedCategoryId !== null) {
      el.taskCategory.value = String(state.selectedCategoryId);
    }
  }

  openModal(el.taskModal);
  el.taskTitle.focus();
}

async function handleSaveTask(event) {
  event.preventDefault();
  el.taskFormError.hidden = true;

  const title = el.taskTitle.value.trim();
  if (!title) {
    el.taskFormErrorText.textContent = "Введите название задачи";
    el.taskFormError.hidden = false;
    el.taskTitle.focus();
    return;
  }

  const payload = {
    title,
    description: el.taskDescription.value.trim() || null,
    category_id: el.taskCategory.value ? Number(el.taskCategory.value) : null,
    priority: el.taskPriority.value,
    status: el.taskStatus.value,
    due_date: el.taskDueDate.value || null,
  };

  const existingId = el.taskId.value ? Number(el.taskId.value) : null;
  try {
    if (existingId) {
      await api.updateTask(existingId, payload);
      showToast("Задача обновлена");
    } else {
      await api.createTask(payload);
      showToast("Задача создана");
    }
    closeModal(el.taskModal);
    await loadTasks();
    if (state.activeDetailTaskId && existingId === state.activeDetailTaskId && !el.detailModal.hidden) {
      await openDetailModal(existingId);
    }
  } catch (err) {
    if (err.status === 401) {
      handleApiError(err);
      return;
    }
    el.taskFormErrorText.textContent = err.message || "Не удалось сохранить задачу";
    el.taskFormError.hidden = false;
  }
}

async function handleToggleTask(taskId, checkboxEl = null) {
  try {
    await api.toggleTask(taskId);
    await loadTasks();
    if (state.activeDetailTaskId === taskId && !el.detailModal.hidden) {
      await renderDetailTask(taskId);
    }
  } catch (err) {
    if (checkboxEl) {
      checkboxEl.checked = !checkboxEl.checked;
    }
    handleApiError(err, "Не удалось обновить статус задачи");
  }
}

async function handleDeleteTask(task) {
  if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
  try {
    await api.deleteTask(task.id);
    showToast("Задача удалена");
    await loadTasks();
  } catch (err) {
    handleApiError(err, "Не удалось удалить задачу");
  }
}

async function handleDeleteCategory(cat) {
  if (!window.confirm(`Удалить категорию «${cat.name}»? Задачи сохранятся без категории.`)) return;
  try {
    await api.deleteCategory(cat.id);
    if (state.selectedCategoryId === cat.id) {
      state.selectedCategoryId = null;
    }
    showToast("Категория удалена");
    await loadWorkspace();
  } catch (err) {
    handleApiError(err, "Не удалось удалить категорию");
  }
}

async function renderDetailTask(taskId) {
  const task = await api.getTask(taskId);
  state.activeDetailTaskId = task.id;
  el.detailModalTitle.textContent = task.title;

  el.detailBadges.innerHTML = "";
  el.detailBadges.appendChild(createBadge(PRIORITY_LABELS[task.priority], `badge--priority-${task.priority}`));
  el.detailBadges.appendChild(createBadge(STATUS_LABELS[task.status], "badge--neutral"));
  if (task.category) {
    el.detailBadges.appendChild(createBadge(task.category.name, "badge--neutral", task.category.color));
  }
  if (task.due_date) {
    el.detailBadges.appendChild(
      createBadge(`Срок: ${formatDateRu(task.due_date)}`, task.is_overdue ? "badge--overdue" : "badge--neutral")
    );
  }

  el.detailDescription.textContent = task.description || "Описание не указано.";
  el.detailDates.textContent = `Создано: ${new Date(task.created_at).toLocaleString("ru-RU")}`;

  el.btnDetailToggle.textContent = task.is_completed ? "Вернуть в работу" : "Отметить выполненной";
  el.btnDetailToggle.onclick = () => handleToggleTask(task.id);
  el.btnDetailEdit.onclick = () => {
    closeModal(el.detailModal);
    openTaskModal(task);
  };

  el.detailSubtaskList.innerHTML = "";
  if (!task.subtasks || task.subtasks.length === 0) {
    el.detailSubtasksEmpty.hidden = false;
  } else {
    el.detailSubtasksEmpty.hidden = true;
    for (const sub of task.subtasks) {
      const li = document.createElement("li");
      li.className = "subtask-list__item";

      const label = document.createElement("label");
      label.className = `subtask-list__label ${sub.is_completed ? "subtask-list__label--done" : ""}`;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "task-card__checkbox";
      cb.checked = sub.is_completed;
      cb.addEventListener("change", async () => {
        try {
          await api.toggleSubtask(sub.id);
          await renderDetailTask(task.id);
          await loadTasks();
        } catch (err) {
          cb.checked = !cb.checked;
          handleApiError(err, "Не удалось обновить подзадачу");
        }
      });

      const text = document.createElement("span");
      text.textContent = sub.title;
      label.appendChild(cb);
      label.appendChild(text);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "icon-btn";
      delBtn.textContent = "×";
      delBtn.setAttribute("aria-label", `Удалить подзадачу ${sub.title}`);
      delBtn.addEventListener("click", async () => {
        try {
          await api.deleteSubtask(sub.id);
          await renderDetailTask(task.id);
          await loadTasks();
        } catch (err) {
          handleApiError(err, "Не удалось удалить подзадачу");
        }
      });

      li.appendChild(label);
      li.appendChild(delBtn);
      el.detailSubtaskList.appendChild(li);
    }
  }
}

async function openDetailModal(taskId) {
  try {
    await renderDetailTask(taskId);
    openModal(el.detailModal);
    const closeBtn = el.detailModal.querySelector("[data-close-modal='detail-modal'].icon-btn");
    if (closeBtn) closeBtn.focus();
  } catch (err) {
    handleApiError(err, "Не удалось загрузить детали задачи");
  }
}

function bindEvents() {
  el.tabLogin.addEventListener("click", () => setAuthTab("login"));
  el.tabRegister.addEventListener("click", () => setAuthTab("register"));

  el.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAuthError();
    const login = document.getElementById("login-identifier").value.trim();
    const password = document.getElementById("login-password").value;
    if (!login || !password) {
      showAuthError("Заполните логин и пароль");
      return;
    }
    try {
      const result = await api.login({ login, password });
      api.setToken(result.access_token);
      state.user = result.user;
      showAppView();
      await loadWorkspace();
    } catch (err) {
      showAuthError(err.message || "Ошибка авторизации");
    }
  });

  el.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideAuthError();
    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    if (username.length < 3 || !email || password.length < 6) {
      showAuthError("Проверьте корректность имени (от 3 символов), email и пароля (от 6 символов)");
      return;
    }
    try {
      const result = await api.register({ username, email, password });
      api.setToken(result.access_token);
      state.user = result.user;
      showAppView();
      showToast("Учётная запись создана");
      await loadWorkspace();
    } catch (err) {
      showAuthError(err.message || "Не удалось зарегистрироваться");
    }
  });

  el.btnLogout.addEventListener("click", () => {
    api.setToken(null);
    resetFilters();
    el.loginForm.reset();
    el.registerForm.reset();
    showAuthView();
  });

  el.btnRetry.addEventListener("click", () => {
    if (!state.user && api.getToken()) {
      initSession();
    } else {
      loadWorkspace();
    }
  });
  el.btnOpenCreate.addEventListener("click", () => openTaskModal());
  el.btnOpenCreateMobile.addEventListener("click", () => openTaskModal());
  el.btnEmptyCreate.addEventListener("click", () => openTaskModal());
  el.taskForm.addEventListener("submit", handleSaveTask);

  el.categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = el.newCategoryName.value.trim();
    const color = el.newCategoryColor.value;
    if (!name) return;
    try {
      await api.createCategory({ name, color });
      el.newCategoryName.value = "";
      showToast("Категория добавлена");
      await loadWorkspace();
    } catch (err) {
      handleApiError(err, "Не удалось создать категорию");
    }
  });

  el.subtaskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = el.newSubtaskTitle.value.trim();
    if (!title || !state.activeDetailTaskId) return;
    try {
      await api.createSubtask(state.activeDetailTaskId, title);
      el.newSubtaskTitle.value = "";
      await renderDetailTask(state.activeDetailTaskId);
      await loadTasks();
    } catch (err) {
      handleApiError(err, "Не удалось добавить подзадачу");
    }
  });

  el.filterSearch.addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      state.search = el.filterSearch.value;
      loadTasks();
    }, 250);
  });

  el.filterStatus.addEventListener("change", () => {
    state.statusFilter = el.filterStatus.value;
    loadTasks();
  });

  el.filterPriority.addEventListener("change", () => {
    state.priorityFilter = el.filterPriority.value;
    loadTasks();
  });

  el.filterSort.addEventListener("change", () => {
    state.sort = el.filterSort.value;
    loadTasks();
  });

  document.querySelectorAll("[data-close-modal]").forEach((node) => {
    node.addEventListener("click", () => {
      const targetId = node.getAttribute("data-close-modal");
      const modal = document.getElementById(targetId);
      if (modal) closeModal(modal);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!el.taskModal.hidden) closeModal(el.taskModal);
      if (!el.detailModal.hidden) closeModal(el.detailModal);
    }
  });
}

async function initSession() {
  const token = api.getToken();
  if (!token) {
    showAuthView();
    return;
  }

  hideGlobalError();
  try {
    state.user = await api.getMe();
    showAppView();
    await loadWorkspace();
  } catch (err) {
    if (err && err.status === 401) {
      api.setToken(null);
      resetFilters();
      showAuthView("Сессия истекла. Пожалуйста, войдите снова.");
    } else {
      el.authView.hidden = true;
      el.appView.hidden = false;
      el.headerActions.hidden = false;
      el.tasksLoading.hidden = true;
      showGlobalError(err?.message || "Сервер временно недоступен. Попробуйте повторить запрос.");
    }
  }
}

async function initApp() {
  bindEvents();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  await initSession();
}

initApp();
