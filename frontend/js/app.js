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

const VIEW_LABELS = {
  all: "Все задачи",
  active: "Задачи в работе",
  completed: "Выполненные задачи",
  overdue: "Просроченные задачи",
};

const state = {
  user: null,
  showingShowcase: false,
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
  workspaceRequestSeq: 0,
  tasksRequestSeq: 0,
  detailRequestSeq: 0,
  taskModalSessionSeq: 0,
  lastFocusedElement: null,
  confirmResolver: null,
};

const el = {
  brandLink: document.getElementById("brand-link"),
  topbarAnchors: document.getElementById("topbar-anchors"),
  topbarGuest: document.getElementById("topbar-guest"),
  btnTopbarDemo: document.getElementById("btn-topbar-demo"),
  btnTopbarSignin: document.getElementById("btn-topbar-signin"),
  headerActions: document.getElementById("header-actions"),
  headerUsername: document.getElementById("header-username"),
  btnToggleShowcase: document.getElementById("btn-toggle-showcase"),
  btnLogout: document.getElementById("btn-logout"),
  btnOpenCreate: document.getElementById("btn-open-create"),
  btnOpenCreateMobile: document.getElementById("btn-open-create-mobile"),
  btnEmptyCreate: document.getElementById("btn-empty-create"),
  btnHeroStart: document.getElementById("btn-hero-start"),
  btnSandboxOpen: document.getElementById("btn-sandbox-open"),
  authDemoWrap: document.getElementById("auth-demo-wrap"),
  btnAuthDemo: document.getElementById("btn-auth-demo"),
  footerApiLink: document.getElementById("footer-api-link"),

  globalError: document.getElementById("global-error"),
  globalErrorText: document.getElementById("global-error-text"),
  btnRetry: document.getElementById("btn-retry"),
  globalToast: document.getElementById("global-toast"),
  globalToastText: document.getElementById("global-toast-text"),

  landingView: document.getElementById("landing-view"),
  authView: document.getElementById("auth-view"),
  appView: document.getElementById("app-view"),
  authSegmented: document.getElementById("auth-segmented"),
  tabLogin: document.getElementById("tab-login"),
  tabRegister: document.getElementById("tab-register"),
  authError: document.getElementById("auth-error"),
  authErrorText: document.getElementById("auth-error-text"),
  loginForm: document.getElementById("login-form"),
  loginSubmitBtn: document.querySelector("#login-form button[type='submit']"),
  registerForm: document.getElementById("register-form"),
  registerSubmitBtn: document.querySelector("#register-form button[type='submit']"),

  wsDate: document.getElementById("ws-date"),
  wsGreeting: document.getElementById("ws-greeting"),
  wsProgressLabel: document.getElementById("ws-progress-label"),
  wsProgressFill: document.getElementById("ws-progress-fill"),

  statTotal: document.getElementById("stat-total"),
  statActive: document.getElementById("stat-active"),
  statCompleted: document.getElementById("stat-completed"),
  statOverdue: document.getElementById("stat-overdue"),
  navCountTotal: document.getElementById("nav-count-total"),
  navCountActive: document.getElementById("nav-count-active"),
  navCountCompleted: document.getElementById("nav-count-completed"),
  navCountOverdue: document.getElementById("nav-count-overdue"),

  categoryList: document.getElementById("category-list"),
  categoryForm: document.getElementById("category-form"),
  categorySubmitBtn: document.querySelector("#category-form button[type='submit']"),
  newCategoryName: document.getElementById("new-category-name"),
  newCategoryColor: document.getElementById("new-category-color"),

  mobileCategoryStrip: document.getElementById("mobile-category-strip"),
  btnMobileCatToggle: document.getElementById("btn-mobile-cat-toggle"),
  mobileCatDrawer: document.getElementById("mobile-cat-drawer"),
  mobileCategoryForm: document.getElementById("mobile-category-form"),
  mobileCategorySubmitBtn: document.querySelector("#mobile-category-form button[type='submit']"),
  mobileCategoryName: document.getElementById("mobile-category-name"),
  mobileCategoryColor: document.getElementById("mobile-category-color"),
  mobileCategoryManageList: document.getElementById("mobile-category-manage-list"),

  filterSearch: document.getElementById("filter-search"),
  filterStatus: document.getElementById("filter-status"),
  filterPriority: document.getElementById("filter-priority"),
  filterSort: document.getElementById("filter-sort"),
  tasksHeading: document.getElementById("tasks-heading"),
  btnResetFilters: document.getElementById("btn-reset-filters"),

  tasksLoading: document.getElementById("tasks-loading"),
  tasksEmpty: document.getElementById("tasks-empty"),
  tasksEmptyTitle: document.getElementById("tasks-empty-title"),
  tasksEmptyText: document.getElementById("tasks-empty-text"),
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
  btnSaveTask: document.getElementById("btn-save-task"),

  detailModal: document.getElementById("detail-modal"),
  detailModalTitle: document.getElementById("detail-modal-title"),
  detailBadges: document.getElementById("detail-badges"),
  detailDescription: document.getElementById("detail-description"),
  detailDates: document.getElementById("detail-dates"),
  detailSubtasksRatio: document.getElementById("detail-subtasks-ratio"),
  detailSubtasksBar: document.getElementById("detail-subtasks-bar"),
  detailSubtasksBarFill: document.getElementById("detail-subtasks-bar-fill"),
  detailSubtaskList: document.getElementById("detail-subtask-list"),
  detailSubtasksEmpty: document.getElementById("detail-subtasks-empty"),
  subtaskForm: document.getElementById("subtask-form"),
  subtaskSubmitBtn: document.querySelector("#subtask-form button[type='submit']"),
  newSubtaskTitle: document.getElementById("new-subtask-title"),
  btnDetailToggle: document.getElementById("btn-detail-toggle"),
  btnDetailEdit: document.getElementById("btn-detail-edit"),

  confirmModal: document.getElementById("confirm-modal"),
  confirmModalTitle: document.getElementById("confirm-modal-title"),
  confirmModalText: document.getElementById("confirm-modal-text"),
  btnConfirmCancel: document.getElementById("btn-confirm-cancel"),
  btnConfirmAccept: document.getElementById("btn-confirm-accept"),
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

function createInkCheckbox(checked, ariaLabel, onChange) {
  const wrap = document.createElement("label");
  wrap.className = "ink-check";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "ink-check__input";
  input.checked = Boolean(checked);
  if (ariaLabel) {
    input.setAttribute("aria-label", ariaLabel);
  }
  input.addEventListener("change", () => onChange(input));

  const box = document.createElement("span");
  box.className = "ink-check__box";
  box.setAttribute("aria-hidden", "true");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", "ink-check__svg");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "ink-check__path");
  path.setAttribute("pathLength", "1");
  path.setAttribute("d", "M3 8.5 L6.5 12 L13 4.5");

  svg.appendChild(path);
  box.appendChild(svg);
  wrap.appendChild(input);
  wrap.appendChild(box);
  return { wrap, input };
}

function setAuthTab(mode, focusTab = false) {
  const isLogin = mode === "login";
  el.authSegmented.setAttribute("data-active-index", isLogin ? "0" : "1");
  el.tabLogin.classList.toggle("segmented__btn--active", isLogin);
  el.tabRegister.classList.toggle("segmented__btn--active", !isLogin);
  el.tabLogin.setAttribute("aria-selected", String(isLogin));
  el.tabRegister.setAttribute("aria-selected", String(!isLogin));
  el.tabLogin.setAttribute("tabindex", isLogin ? "0" : "-1");
  el.tabRegister.setAttribute("tabindex", isLogin ? "-1" : "0");
  el.loginForm.hidden = !isLogin;
  el.registerForm.hidden = isLogin;
  hideAuthError();
  if (focusTab) {
    (isLogin ? el.tabLogin : el.tabRegister).focus();
  }
}

function prefersReducedMotion() {
  return Boolean(
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function scrollToAuth() {
  if (el.authView) {
    const reduceMotion = prefersReducedMotion();
    const scrollTarget = el.authView.querySelector(".auth-card") || el.authView;
    scrollTarget.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    setTimeout(() => {
      const targetInput = el.loginForm.hidden
        ? document.getElementById("reg-username")
        : document.getElementById("login-identifier");
      if (targetInput) {
        targetInput.focus();
      }
    }, reduceMotion ? 0 : 420);
  }
}

function updateTopbarMode() {
  const isLoggedIn = Boolean(state.user);
  const onLanding = !isLoggedIn || state.showingShowcase;

  el.landingView.hidden = !onLanding;
  el.appView.hidden = onLanding;
  el.topbarAnchors.hidden = !onLanding;
  el.topbarGuest.hidden = isLoggedIn;
  el.headerActions.hidden = !isLoggedIn;
  el.authView.hidden = isLoggedIn;

  if (isLoggedIn) {
    el.headerUsername.textContent = state.user.username;
    el.btnToggleShowcase.textContent = state.showingShowcase ? "К задачам" : "Обзор";
    el.btnHeroStart.textContent = "Перейти к задачам";
  } else {
    el.btnHeroStart.textContent = api.isDemoMode
      ? "Открыть демо-планировщик"
      : "Открыть планировщик";
  }

  if (window.plannerMotion && window.plannerMotion.storyController) {
    requestAnimationFrame(() => window.plannerMotion.storyController.refresh());
  }
}

function clearWorkspaceUi() {
  clearTimeout(state.searchTimer);
  state.categories = [];
  state.tasks = [];
  state.stats = null;
  state.activeDetailTaskId = null;
  state.workspaceRequestSeq += 1;
  state.tasksRequestSeq += 1;
  state.detailRequestSeq += 1;
  state.taskModalSessionSeq += 1;

  el.taskList.innerHTML = "";
  el.categoryList.innerHTML = "";
  el.mobileCategoryStrip.innerHTML = "";
  if (el.mobileCategoryManageList) {
    el.mobileCategoryManageList.innerHTML = "";
    el.mobileCategoryManageList.hidden = true;
  }
  if (el.mobileCatDrawer) {
    el.mobileCatDrawer.hidden = true;
    el.btnMobileCatToggle.setAttribute("aria-expanded", "false");
  }
  if (el.taskCategory) {
    el.taskCategory.innerHTML = "";
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "Без категории";
    el.taskCategory.appendChild(noneOpt);
  }
  if (el.taskForm) {
    el.taskForm.reset();
    el.taskId.value = "";
    el.taskFormError.hidden = true;
  }
  el.detailModalTitle.textContent = "";
  el.detailBadges.innerHTML = "";
  el.detailDescription.textContent = "";
  el.detailDates.textContent = "";
  el.detailSubtaskList.innerHTML = "";
  el.detailSubtasksRatio.textContent = "";
  el.detailSubtasksBar.hidden = true;
  el.detailSubtasksBarFill.style.transform = "scaleX(0)";
  el.detailSubtasksEmpty.hidden = true;
  el.newSubtaskTitle.value = "";

  el.tasksLoading.hidden = true;
  el.tasksEmpty.hidden = true;

  el.statTotal.textContent = "0";
  el.statActive.textContent = "0";
  el.statCompleted.textContent = "0";
  el.statOverdue.textContent = "0";
  el.navCountTotal.textContent = "0";
  el.navCountActive.textContent = "0";
  el.navCountCompleted.textContent = "0";
  el.navCountOverdue.textContent = "0";
  el.wsProgressLabel.textContent = "0 из 0 выполнено";
  el.wsProgressFill.style.transform = "scaleX(0)";
  el.headerUsername.textContent = "";
  el.wsGreeting.textContent = "Мои задачи";
}

function showAuthView(message = "", focusAuth = false) {
  state.user = null;
  state.showingShowcase = true;
  closeAllModals();
  clearWorkspaceUi();
  hideGlobalError();
  updateTopbarMode();
  if (message) {
    showAuthError(message);
  }
  if (focusAuth) {
    scrollToAuth();
  } else {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

function showAppView() {
  state.showingShowcase = false;
  updateTopbarMode();
  if (el.wsDate && window.plannerMotion) {
    el.wsDate.textContent = window.plannerMotion.formatRussianToday();
  }
  if (el.wsGreeting && state.user) {
    el.wsGreeting.textContent = `Здравствуйте, ${state.user.username}`;
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function handleApiError(err, fallbackMessage = "Произошла ошибка") {
  if (err && err.status === 401) {
    api.setToken(null);
    resetFilters();
    closeAllModals();
    showAuthView("Сессия истекла. Пожалуйста, войдите снова.", true);
    return;
  }
  showGlobalError(err?.message || fallbackMessage);
}

const modalReturnFocus = new WeakMap();

function getTopOpenModal() {
  if (!el.confirmModal.hidden) return el.confirmModal;
  if (!el.taskModal.hidden) return el.taskModal;
  if (!el.detailModal.hidden) return el.detailModal;
  return null;
}

function getFocusableElements(container) {
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll(selector)).filter((node) => {
    if (node.closest("[hidden]")) return false;
    const style = window.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function openModal(modalElement) {
  if (modalElement !== el.detailModal) {
    state.detailRequestSeq += 1;
  }
  if (document.activeElement instanceof HTMLElement && !modalElement.contains(document.activeElement)) {
    modalReturnFocus.set(modalElement, document.activeElement);
    state.lastFocusedElement = document.activeElement;
  }
  modalElement.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal(modalElement) {
  if (!modalElement || modalElement.hidden) return;
  if (document.activeElement instanceof HTMLElement && modalElement.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  modalElement.hidden = true;

  if (modalElement === el.taskModal) {
    state.taskModalSessionSeq += 1;
  }

  if (modalElement === el.detailModal) {
    state.detailRequestSeq += 1;
    state.activeDetailTaskId = null;
  }

  if (modalElement === el.confirmModal && state.confirmResolver) {
    const resolve = state.confirmResolver;
    state.confirmResolver = null;
    resolve(false);
  }

  const returnTarget = modalReturnFocus.get(modalElement) || state.lastFocusedElement;
  modalReturnFocus.delete(modalElement);

  if (el.taskModal.hidden && el.detailModal.hidden && el.confirmModal.hidden) {
    document.body.style.overflow = "";
    state.lastFocusedElement = null;
  }
  if (
    returnTarget &&
    returnTarget !== document.body &&
    document.contains(returnTarget) &&
    !returnTarget.closest("[hidden]")
  ) {
    returnTarget.focus();
  }
}

function closeAllModals() {
  closeModal(el.confirmModal);
  closeModal(el.taskModal);
  closeModal(el.detailModal);
}

function askConfirm(title, message, acceptLabel = "Удалить") {
  if (state.confirmResolver) {
    state.confirmResolver(false);
    state.confirmResolver = null;
  }
  el.confirmModalTitle.textContent = title;
  el.confirmModalText.textContent = message;
  el.btnConfirmAccept.textContent = acceptLabel;
  openModal(el.confirmModal);
  el.btnConfirmCancel.focus();

  return new Promise((resolve) => {
    state.confirmResolver = resolve;
  });
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
  syncActiveFiltersUi();
}

function hasActiveFilters() {
  return (
    state.selectedCategoryId !== null ||
    state.statusFilter !== "all" ||
    Boolean(state.priorityFilter) ||
    Boolean(state.search.trim())
  );
}

function syncActiveFiltersUi() {
  el.filterStatus.value = state.statusFilter;

  document.querySelectorAll("[data-smart]").forEach((btn) => {
    const val = btn.getAttribute("data-smart");
    const active = state.statusFilter === val && state.selectedCategoryId === null;
    btn.classList.toggle("smart-nav__item--active", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll("[data-metric-filter]").forEach((cell) => {
    const val = cell.getAttribute("data-metric-filter");
    const active = state.statusFilter === val;
    cell.classList.toggle("metrics__cell--active", active);
    cell.setAttribute("aria-pressed", String(active));
  });

  let heading = VIEW_LABELS[state.statusFilter] || "Все задачи";
  if (state.selectedCategoryId !== null) {
    const cat = state.categories.find((c) => c.id === state.selectedCategoryId);
    if (cat) {
      heading = state.statusFilter === "all" ? cat.name : `${cat.name} · ${heading.toLowerCase()}`;
    }
  }
  el.tasksHeading.textContent = heading;
  el.btnResetFilters.hidden = !hasActiveFilters();
}

function renderStats() {
  if (!state.stats) return;
  const { total, active, completed, overdue } = state.stats;
  el.statTotal.textContent = String(total);
  el.statActive.textContent = String(active);
  el.statCompleted.textContent = String(completed);
  el.statOverdue.textContent = String(overdue);

  el.navCountTotal.textContent = String(total);
  el.navCountActive.textContent = String(active);
  el.navCountCompleted.textContent = String(completed);
  el.navCountOverdue.textContent = String(overdue);

  const ratio = total > 0 ? completed / total : 0;
  el.wsProgressLabel.textContent =
    total > 0
      ? `Выполнено ${completed} из ${total} (${Math.round(ratio * 100)}%)`
      : "Задач пока нет";
  el.wsProgressFill.style.transform = `scaleX(${ratio.toFixed(4)})`;
}

function renderCategories() {
  // Desktop sidebar list
  el.categoryList.innerHTML = "";
  const allItem = document.createElement("li");
  allItem.className = "category-list__row";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `category-list__btn ${state.selectedCategoryId === null ? "category-list__btn--all-active" : ""}`;
  allBtn.setAttribute("aria-pressed", String(state.selectedCategoryId === null));
  allBtn.textContent = "Все категории";
  allBtn.addEventListener("click", () => {
    state.selectedCategoryId = null;
    renderCategories();
    syncActiveFiltersUi();
    loadTasks();
  });
  allItem.appendChild(allBtn);
  el.categoryList.appendChild(allItem);

  // Mobile horizontal strip & mobile drawer manage list
  el.mobileCategoryStrip.innerHTML = "";
  if (el.mobileCategoryManageList) {
    el.mobileCategoryManageList.innerHTML = "";
    el.mobileCategoryManageList.hidden = state.categories.length === 0;
  }
  const allPill = document.createElement("button");
  allPill.type = "button";
  allPill.className = `cat-pill ${state.selectedCategoryId === null ? "cat-pill--active" : ""}`;
  allPill.setAttribute("aria-pressed", String(state.selectedCategoryId === null));
  allPill.textContent = "Все";
  allPill.addEventListener("click", () => {
    state.selectedCategoryId = null;
    renderCategories();
    syncActiveFiltersUi();
    loadTasks();
  });
  el.mobileCategoryStrip.appendChild(allPill);

  for (const cat of state.categories) {
    // Sidebar item
    const li = document.createElement("li");
    li.className = "category-list__row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `category-list__btn ${state.selectedCategoryId === cat.id ? "category-list__btn--active" : ""}`;
    btn.setAttribute("aria-pressed", String(state.selectedCategoryId === cat.id));

    const dot = document.createElement("span");
    dot.className = "category-list__dot";
    dot.style.backgroundColor = cat.color;
    dot.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "category-list__name";
    label.textContent = cat.name;

    btn.appendChild(dot);
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      state.selectedCategoryId = cat.id;
      renderCategories();
      syncActiveFiltersUi();
      loadTasks();
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "icon-btn icon-btn--quiet";
    delBtn.textContent = "×";
    delBtn.setAttribute("aria-label", `Удалить категорию ${cat.name}`);
    delBtn.addEventListener("click", () => handleDeleteCategory(cat));

    li.appendChild(btn);
    li.appendChild(delBtn);
    el.categoryList.appendChild(li);

    // Mobile pill
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `cat-pill ${state.selectedCategoryId === cat.id ? "cat-pill--active" : ""}`;
    pill.setAttribute("aria-pressed", String(state.selectedCategoryId === cat.id));
    const pDot = document.createElement("span");
    pDot.className = "category-list__dot";
    pDot.style.backgroundColor = cat.color;
    pDot.setAttribute("aria-hidden", "true");
    pill.appendChild(pDot);
    pill.appendChild(document.createTextNode(cat.name));
    pill.addEventListener("click", () => {
      state.selectedCategoryId = cat.id;
      renderCategories();
      syncActiveFiltersUi();
      loadTasks();
    });
    el.mobileCategoryStrip.appendChild(pill);

    // Mobile drawer delete item
    if (el.mobileCategoryManageList) {
      const mLi = document.createElement("li");
      mLi.className = "mobile-cat-drawer__item";
      const mDot = document.createElement("span");
      mDot.className = "category-list__dot";
      mDot.style.backgroundColor = cat.color;
      mDot.setAttribute("aria-hidden", "true");
      const mName = document.createElement("span");
      mName.textContent = cat.name;
      const mDel = document.createElement("button");
      mDel.type = "button";
      mDel.className = "icon-btn icon-btn--quiet mobile-cat-drawer__del";
      mDel.textContent = "×";
      mDel.setAttribute("aria-label", `Удалить категорию ${cat.name}`);
      mDel.addEventListener("click", () => handleDeleteCategory(cat));
      mLi.appendChild(mDot);
      mLi.appendChild(mName);
      mLi.appendChild(mDel);
      el.mobileCategoryManageList.appendChild(mLi);
    }
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

  const activeMobilePill = el.mobileCategoryStrip.querySelector(".cat-pill--active");
  if (activeMobilePill && typeof activeMobilePill.scrollIntoView === "function") {
    activeMobilePill.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function createChip(text, modifier = "", dotColor = null) {
  const span = document.createElement("span");
  span.className = modifier ? `chip ${modifier}` : "chip";
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
    if (hasActiveFilters()) {
      el.tasksEmptyTitle.textContent = "Ничего не найдено";
      el.tasksEmptyText.textContent = "Попробуйте ослабить фильтры или создайте новую задачу.";
    } else {
      el.tasksEmptyTitle.textContent = "Список задач пока пуст";
      el.tasksEmptyText.textContent = "Добавьте первую задачу, чтобы наметить план на день.";
    }
    return;
  }
  el.tasksEmpty.hidden = true;

  state.tasks.forEach((task, index) => {
    const li = document.createElement("li");
    const prioClass = `task-row--prio-${task.priority || "medium"}`;
    li.className = `task-row ${prioClass} ${task.is_completed ? "task-row--completed" : ""}`;
    li.style.setProperty("--row-index", String(Math.min(index, 8)));

    const mainRow = document.createElement("div");
    mainRow.className = "task-row__main";

    const { wrap: checkWrap, input: checkInput } = createInkCheckbox(
      task.is_completed,
      `Отметить задачу «${task.title}» выполненной`,
      (checkboxEl) => handleToggleTask(task.id, checkboxEl)
    );
    checkInput.dataset.taskCheck = String(task.id);

    const content = document.createElement("div");
    content.className = "task-row__content";

    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "task-row__title-btn";
    titleBtn.textContent = task.title;
    titleBtn.addEventListener("click", () => openDetailModal(task.id));
    content.appendChild(titleBtn);

    if (task.description) {
      const desc = document.createElement("p");
      desc.className = "task-row__desc";
      desc.textContent =
        task.description.length > 140 ? `${task.description.slice(0, 140)}…` : task.description;
      content.appendChild(desc);
    }

    const meta = document.createElement("div");
    meta.className = "task-row__meta";

    meta.appendChild(
      createChip(PRIORITY_LABELS[task.priority] || task.priority, `chip--prio-${task.priority}`)
    );
    meta.appendChild(createChip(STATUS_LABELS[task.status] || task.status));

    if (task.category) {
      meta.appendChild(createChip(task.category.name, "", task.category.color));
    }

    if (task.due_date) {
      const dateText = `До ${formatDateRu(task.due_date)}`;
      meta.appendChild(createChip(dateText, task.is_overdue ? "chip--overdue" : ""));
    }

    if (task.subtasks && task.subtasks.length > 0) {
      const doneCount = task.subtasks.filter((s) => s.is_completed).length;
      meta.appendChild(createChip(`Подзадачи: ${doneCount}/${task.subtasks.length}`));
    }

    content.appendChild(meta);
    mainRow.appendChild(checkWrap);
    mainRow.appendChild(content);

    const actions = document.createElement("div");
    actions.className = "task-row__actions";

    const detailBtn = document.createElement("button");
    detailBtn.type = "button";
    detailBtn.className = "btn btn--secondary btn--compact";
    detailBtn.textContent = "Подробнее";
    detailBtn.addEventListener("click", () => openDetailModal(task.id));

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn--ghost btn--compact";
    editBtn.textContent = "Изменить";
    editBtn.addEventListener("click", () => openTaskModal(task));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn--danger-ghost btn--compact";
    delBtn.textContent = "Удалить";
    delBtn.addEventListener("click", () => handleDeleteTask(task));

    actions.appendChild(detailBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(mainRow);
    li.appendChild(actions);
    el.taskList.appendChild(li);
  });
}

async function loadWorkspace() {
  hideGlobalError();
  el.tasksLoading.hidden = false;
  el.tasksEmpty.hidden = true;
  const workspaceSeq = ++state.workspaceRequestSeq;
  try {
    const [categories, stats] = await Promise.all([api.getCategories(), api.getStats()]);
    if (workspaceSeq !== state.workspaceRequestSeq || !state.user) {
      return;
    }
    state.categories = categories;
    state.stats = stats;
    renderCategories();
    renderStats();
    syncActiveFiltersUi();
    await loadTasks();
  } catch (err) {
    if (workspaceSeq !== state.workspaceRequestSeq || !state.user) {
      return;
    }
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
  if (state.statusFilter === "active" || state.statusFilter === "overdue") {
    params.completed = false;
  } else if (state.statusFilter === "completed") {
    params.completed = true;
  }
  if (state.priorityFilter) params.priority = state.priorityFilter;
  if (state.selectedCategoryId !== null) params.category_id = state.selectedCategoryId;

  try {
    const [rawTasks, stats] = await Promise.all([api.getTasks(params), api.getStats()]);
    if (requestSeq !== state.tasksRequestSeq) {
      return;
    }
    state.tasks =
      state.statusFilter === "overdue" ? rawTasks.filter((t) => t.is_overdue) : rawTasks;
    state.stats = stats;
    el.tasksLoading.hidden = true;
    renderStats();
    syncActiveFiltersUi();
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
  state.taskModalSessionSeq += 1;
  if (el.btnSaveTask) el.btnSaveTask.disabled = false;
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
  if (el.btnSaveTask && el.btnSaveTask.disabled) return;
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
  const saveModalSeq = state.taskModalSessionSeq;
  if (el.btnSaveTask) el.btnSaveTask.disabled = true;
  try {
    if (existingId) {
      await api.updateTask(existingId, payload);
      showToast("Задача обновлена");
    } else {
      await api.createTask(payload);
      showToast("Задача создана");
    }
    if (saveModalSeq === state.taskModalSessionSeq) {
      closeModal(el.taskModal);
    }
    await loadTasks();
    if (
      state.activeDetailTaskId &&
      existingId === state.activeDetailTaskId &&
      !el.detailModal.hidden
    ) {
      await renderDetailTask(existingId);
    }
  } catch (err) {
    if (err.status === 401) {
      handleApiError(err);
      return;
    }
    if (saveModalSeq === state.taskModalSessionSeq) {
      el.taskFormErrorText.textContent = err.message || "Не удалось сохранить задачу";
      el.taskFormError.hidden = false;
    }
  } finally {
    if (el.btnSaveTask && saveModalSeq === state.taskModalSessionSeq) {
      el.btnSaveTask.disabled = false;
    }
  }
}

async function handleToggleTask(taskId, checkboxEl = null) {
  const restoreCheckFocus = Boolean(checkboxEl && document.activeElement === checkboxEl);
  const prevIdx = state.tasks.findIndex((t) => t.id === taskId);
  try {
    await api.toggleTask(taskId);
    await loadTasks();
    if (restoreCheckFocus) {
      const rebuilt = el.taskList.querySelector(`[data-task-check="${taskId}"]`);
      if (rebuilt) {
        rebuilt.focus({ preventScroll: true });
      } else {
        const remaining = el.taskList.querySelectorAll("[data-task-check]");
        if (remaining.length > 0) {
          const fallbackIdx = Math.max(0, Math.min(prevIdx, remaining.length - 1));
          remaining[fallbackIdx].focus({ preventScroll: true });
        } else if (el.btnEmptyCreate && !el.tasksEmpty.hidden) {
          el.btnEmptyCreate.focus({ preventScroll: true });
        }
      }
    }
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
  const confirmed = await askConfirm(
    "Удалить задачу?",
    `Задача «${task.title}» и все её подзадачи будут удалены без возможности восстановления.`,
    "Удалить задачу"
  );
  if (!confirmed) return;

  try {
    await api.deleteTask(task.id);
    showToast("Задача удалена");
    await loadTasks();
  } catch (err) {
    handleApiError(err, "Не удалось удалить задачу");
  }
}

async function handleDeleteCategory(cat) {
  const confirmed = await askConfirm(
    "Удалить категорию?",
    `Категория «${cat.name}» будет удалена. Все задачи сохранятся и перейдут в раздел без категории.`,
    "Удалить категорию"
  );
  if (!confirmed) return;

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

async function submitNewCategory(nameInput, colorInput, onSuccess, submitBtn = null) {
  if (submitBtn && submitBtn.disabled) return;
  const name = nameInput.value.trim();
  const color = colorInput.value;
  if (!name) return;
  if (submitBtn) submitBtn.disabled = true;
  try {
    await api.createCategory({ name, color });
    nameInput.value = "";
    showToast("Категория добавлена");
    if (onSuccess) onSuccess();
    await loadWorkspace();
  } catch (err) {
    handleApiError(err, "Не удалось создать категорию");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function renderDetailTask(taskId, expectedSeq = null) {
  const requestSeq = expectedSeq !== null ? expectedSeq : ++state.detailRequestSeq;
  const task = await api.getTask(taskId);
  if (requestSeq !== state.detailRequestSeq || !state.user) {
    return false;
  }
  state.activeDetailTaskId = task.id;
  el.detailModalTitle.textContent = task.title;

  el.detailBadges.innerHTML = "";
  el.detailBadges.appendChild(
    createChip(PRIORITY_LABELS[task.priority], `chip--prio-${task.priority}`)
  );
  el.detailBadges.appendChild(createChip(STATUS_LABELS[task.status]));
  if (task.category) {
    el.detailBadges.appendChild(createChip(task.category.name, "", task.category.color));
  }
  if (task.due_date) {
    el.detailBadges.appendChild(
      createChip(`Срок: ${formatDateRu(task.due_date)}`, task.is_overdue ? "chip--overdue" : "")
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
  const subtasks = task.subtasks || [];
  if (subtasks.length === 0) {
    el.detailSubtasksEmpty.hidden = false;
    el.detailSubtasksRatio.textContent = "";
    el.detailSubtasksBar.hidden = true;
  } else {
    el.detailSubtasksEmpty.hidden = true;
    const doneCount = subtasks.filter((s) => s.is_completed).length;
    el.detailSubtasksRatio.textContent = `${doneCount} из ${subtasks.length}`;
    el.detailSubtasksBar.hidden = false;
    el.detailSubtasksBarFill.style.transform = `scaleX(${(doneCount / subtasks.length).toFixed(4)})`;

    subtasks.forEach((sub, subIdx) => {
      const li = document.createElement("li");
      li.className = "subtask-list__item";

      const label = document.createElement("div");
      label.className = `subtask-list__label ${sub.is_completed ? "subtask-list__label--done" : ""}`;

      const { wrap: cbWrap, input: cbInput } = createInkCheckbox(
        sub.is_completed,
        `Отметить подзадачу «${sub.title}» выполненной`,
        async (cbEl) => {
          const hadFocus = document.activeElement === cbEl;
          try {
            await api.toggleSubtask(sub.id);
            if (state.activeDetailTaskId === task.id && !el.detailModal.hidden) {
              const rendered = await renderDetailTask(task.id);
              if (rendered && hadFocus) {
                const rebuilt = el.detailSubtaskList.querySelector(`[data-subtask-check="${sub.id}"]`);
                if (rebuilt) rebuilt.focus({ preventScroll: true });
              }
            }
            await loadTasks();
          } catch (err) {
            cbEl.checked = !cbEl.checked;
            handleApiError(err, "Не удалось обновить подзадачу");
          }
        }
      );
      cbInput.dataset.subtaskCheck = String(sub.id);

      const text = document.createElement("span");
      text.textContent = sub.title;
      label.appendChild(cbWrap);
      label.appendChild(text);

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "icon-btn icon-btn--quiet";
      delBtn.dataset.subtaskDel = String(sub.id);
      delBtn.textContent = "×";
      delBtn.setAttribute("aria-label", `Удалить подзадачу ${sub.title}`);
      delBtn.addEventListener("click", async () => {
        const hadFocus = document.activeElement === delBtn;
        try {
          await api.deleteSubtask(sub.id);
          if (state.activeDetailTaskId === task.id && !el.detailModal.hidden) {
            const rendered = await renderDetailTask(task.id);
            if (rendered && hadFocus) {
              const remainingBtns = el.detailSubtaskList.querySelectorAll("[data-subtask-del]");
              if (remainingBtns.length > 0) {
                const nextBtn = remainingBtns[Math.min(subIdx, remainingBtns.length - 1)];
                nextBtn.focus({ preventScroll: true });
              } else if (el.newSubtaskTitle) {
                el.newSubtaskTitle.focus({ preventScroll: true });
              }
            }
          }
          await loadTasks();
        } catch (err) {
          handleApiError(err, "Не удалось удалить подзадачу");
        }
      });

      li.appendChild(label);
      li.appendChild(delBtn);
      el.detailSubtaskList.appendChild(li);
    });
  }
  return true;
}

async function openDetailModal(taskId) {
  el.newSubtaskTitle.value = "";
  const requestSeq = ++state.detailRequestSeq;
  try {
    const rendered = await renderDetailTask(taskId, requestSeq);
    if (!rendered || requestSeq !== state.detailRequestSeq || !state.user || state.showingShowcase) {
      return;
    }
    openModal(el.detailModal);
    const closeBtn = el.detailModal.querySelector("[data-close-modal='detail-modal'].icon-btn");
    if (closeBtn) closeBtn.focus();
  } catch (err) {
    if (requestSeq !== state.detailRequestSeq) {
      return;
    }
    handleApiError(err, "Не удалось загрузить детали задачи");
  }
}

async function enterDemoWorkspace() {
  if (!api.isDemoMode) {
    scrollToAuth();
    return;
  }
  try {
    const result = await api.login({ login: "demo_user", password: "demo" });
    api.setToken(result.access_token);
    state.user = result.user;
    showAppView();
    showToast("Открыт интерактивный демо-режим");
    await loadWorkspace();
  } catch (err) {
    showGlobalError(err.message || "Не удалось открыть демо");
  }
}

function bindEvents() {
  el.tabLogin.addEventListener("click", () => setAuthTab("login"));
  el.tabRegister.addEventListener("click", () => setAuthTab("register"));
  el.authSegmented.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = el.loginForm.hidden ? "login" : "register";
      setAuthTab(next, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      setAuthTab("login", true);
    } else if (event.key === "End") {
      event.preventDefault();
      setAuthTab("register", true);
    }
  });

  el.brandLink.addEventListener("click", (event) => {
    if (state.user) {
      event.preventDefault();
      if (state.showingShowcase) {
        showAppView();
      } else {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
    }
  });

  el.btnTopbarSignin.addEventListener("click", (event) => {
    event.preventDefault();
    scrollToAuth();
  });

  el.btnHeroStart.addEventListener("click", () => {
    if (state.user) {
      showAppView();
    } else if (api.isDemoMode) {
      enterDemoWorkspace();
    } else {
      scrollToAuth();
    }
  });

  if (el.btnSandboxOpen) {
    el.btnSandboxOpen.addEventListener("click", () => {
      if (state.user) {
        showAppView();
      } else if (api.isDemoMode) {
        enterDemoWorkspace();
      } else {
        scrollToAuth();
      }
    });
  }

  if (el.btnTopbarDemo) {
    el.btnTopbarDemo.addEventListener("click", enterDemoWorkspace);
  }
  if (el.btnAuthDemo) {
    el.btnAuthDemo.addEventListener("click", enterDemoWorkspace);
  }

  el.btnToggleShowcase.addEventListener("click", () => {
    if (!state.user) return;
    state.showingShowcase = !state.showingShowcase;
    if (state.showingShowcase) {
      state.detailRequestSeq += 1;
      closeAllModals();
    }
    updateTopbarMode();
    window.scrollTo({ top: 0, behavior: "auto" });
  });

  el.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (el.loginSubmitBtn && el.loginSubmitBtn.disabled) return;
    hideAuthError();
    const login = document.getElementById("login-identifier").value.trim();
    const password = document.getElementById("login-password").value;
    if (!login || !password) {
      showAuthError("Заполните логин и пароль");
      return;
    }
    if (el.loginSubmitBtn) el.loginSubmitBtn.disabled = true;
    try {
      const result = await api.login({ login, password });
      api.setToken(result.access_token);
      state.user = result.user;
      showAppView();
      await loadWorkspace();
    } catch (err) {
      showAuthError(err.message || "Ошибка авторизации");
    } finally {
      if (el.loginSubmitBtn) el.loginSubmitBtn.disabled = false;
    }
  });

  el.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (el.registerSubmitBtn && el.registerSubmitBtn.disabled) return;
    hideAuthError();
    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    if (username.length < 3 || !email || password.length < 6) {
      showAuthError(
        "Проверьте корректность имени (от 3 символов), email и пароля (от 6 символов)"
      );
      return;
    }
    if (el.registerSubmitBtn) el.registerSubmitBtn.disabled = true;
    try {
      const result = await api.register({ username, email, password });
      api.setToken(result.access_token);
      state.user = result.user;
      showAppView();
      showToast("Учётная запись создана");
      await loadWorkspace();
    } catch (err) {
      showAuthError(err.message || "Не удалось зарегистрироваться");
    } finally {
      if (el.registerSubmitBtn) el.registerSubmitBtn.disabled = false;
    }
  });

  el.btnLogout.addEventListener("click", () => {
    api.setToken(null);
    resetFilters();
    closeAllModals();
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

  el.btnOpenCreate.addEventListener("click", () => {
    if (state.showingShowcase) showAppView();
    openTaskModal();
  });
  el.btnOpenCreateMobile.addEventListener("click", () => openTaskModal());
  el.btnEmptyCreate.addEventListener("click", () => openTaskModal());
  el.taskForm.addEventListener("submit", handleSaveTask);

  el.categoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitNewCategory(el.newCategoryName, el.newCategoryColor, null, el.categorySubmitBtn);
  });

  el.btnMobileCatToggle.addEventListener("click", () => {
    const willShow = el.mobileCatDrawer.hidden;
    el.mobileCatDrawer.hidden = !willShow;
    el.btnMobileCatToggle.setAttribute("aria-expanded", String(willShow));
    if (willShow) el.mobileCategoryName.focus();
  });

  el.mobileCategoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitNewCategory(
      el.mobileCategoryName,
      el.mobileCategoryColor,
      () => {
        el.mobileCatDrawer.hidden = true;
        el.btnMobileCatToggle.setAttribute("aria-expanded", "false");
      },
      el.mobileCategorySubmitBtn
    );
  });

  el.subtaskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (el.subtaskSubmitBtn && el.subtaskSubmitBtn.disabled) return;
    const title = el.newSubtaskTitle.value.trim();
    const targetTaskId = state.activeDetailTaskId;
    if (!title || !targetTaskId) return;
    if (el.subtaskSubmitBtn) el.subtaskSubmitBtn.disabled = true;
    try {
      await api.createSubtask(targetTaskId, title);
      el.newSubtaskTitle.value = "";
      if (state.activeDetailTaskId === targetTaskId && !el.detailModal.hidden) {
        await renderDetailTask(targetTaskId);
      }
      await loadTasks();
    } catch (err) {
      handleApiError(err, "Не удалось добавить подзадачу");
    } finally {
      if (el.subtaskSubmitBtn) el.subtaskSubmitBtn.disabled = false;
    }
  });

  // Smart views & clickable metrics
  document.querySelectorAll("[data-smart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.statusFilter = btn.getAttribute("data-smart");
      state.selectedCategoryId = null;
      renderCategories();
      syncActiveFiltersUi();
      loadTasks();
    });
  });

  document.querySelectorAll("[data-metric-filter]").forEach((cell) => {
    cell.addEventListener("click", () => {
      state.statusFilter = cell.getAttribute("data-metric-filter");
      syncActiveFiltersUi();
      loadTasks();
    });
  });

  el.btnResetFilters.addEventListener("click", () => {
    resetFilters();
    renderCategories();
    loadTasks();
  });

  el.filterSearch.addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      state.search = el.filterSearch.value;
      syncActiveFiltersUi();
      loadTasks();
    }, 240);
  });

  el.filterStatus.addEventListener("change", () => {
    state.statusFilter = el.filterStatus.value;
    syncActiveFiltersUi();
    loadTasks();
  });

  el.filterPriority.addEventListener("change", () => {
    state.priorityFilter = el.filterPriority.value;
    syncActiveFiltersUi();
    loadTasks();
  });

  el.filterSort.addEventListener("change", () => {
    state.sort = el.filterSort.value;
    loadTasks();
  });

  // Confirm modal actions
  el.btnConfirmCancel.addEventListener("click", () => closeModal(el.confirmModal));
  el.btnConfirmAccept.addEventListener("click", () => {
    const resolve = state.confirmResolver;
    state.confirmResolver = null;
    closeModal(el.confirmModal);
    if (resolve) resolve(true);
  });

  document.querySelectorAll("[data-close-modal]").forEach((node) => {
    node.addEventListener("click", () => {
      const targetId = node.getAttribute("data-close-modal");
      const modal = document.getElementById(targetId);
      if (modal) closeModal(modal);
    });
  });

  document.addEventListener("keydown", (event) => {
    const activeModal = getTopOpenModal();
    if (event.key === "Escape") {
      if (activeModal) {
        closeModal(activeModal);
      } else {
        state.detailRequestSeq += 1;
      }
      return;
    }

    if (event.key === "Tab" && activeModal) {
      const focusables = getFocusableElements(activeModal);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first || !activeModal.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !activeModal.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    const activeEl = document.activeElement;
    const isHiddenEl = activeEl instanceof HTMLElement && Boolean(activeEl.closest("[hidden]"));
    const nonTextInputTypes = new Set([
      "checkbox",
      "radio",
      "button",
      "submit",
      "reset",
      "color",
      "file",
      "range",
    ]);
    const isTextInput =
      activeEl instanceof HTMLInputElement &&
      !nonTextInputTypes.has((activeEl.type || "text").toLowerCase());
    const inTextField =
      !isHiddenEl &&
      (isTextInput ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable));

    // Focus search input with '/' or open new task modal with 'N' when inside workspace
    if (
      !event.repeat &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !el.appView.hidden &&
      !activeModal &&
      !inTextField
    ) {
      if (event.key === "/" || (!event.shiftKey && event.code === "Slash")) {
        event.preventDefault();
        el.filterSearch.focus();
      } else if (event.code === "KeyN") {
        event.preventDefault();
        openTaskModal();
      }
    }
  });
}

async function initSession() {
  if (api.isDemoMode) {
    el.btnTopbarDemo.hidden = false;
    el.authDemoWrap.hidden = false;
    if (el.footerApiLink) {
      el.footerApiLink.href = "https://github.com/APELSINKos/task-planner";
      el.footerApiLink.textContent = "Исходный код на GitHub";
    }
  }

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
      showAuthView("Сессия истекла. Пожалуйста, войдите снова.", true);
      return;
    }
    // Preserve token on transient server/network error so Retry recovers cleanly
    state.showingShowcase = true;
    updateTopbarMode();
    showGlobalError(
      err?.message || "Сервер временно недоступен. Нажмите «Повторить» после восстановления связи."
    );
  }
}

// Register lightweight PWA service worker when supported
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

if (window.plannerMotion) {
  window.plannerMotion.init();
}
bindEvents();
initSession();
