/*
 * Motion, Theme & Interactive Sandbox Engine for Task Planner.
 * Zero external dependencies: rAF-damped 3-phase scroll reel, subtle hero depth,
 * interactive day-focus checklist sandbox, reading progress hairline, and theme sync.
 */

const THEME_STORAGE_KEY = "task_planner_theme";

const PHASE_META = [
  {
    chip: "01 · Сбор",
    caption:
      "Задачи из заметок, чатов и почты выравниваются в один чистый список с категориями и сроками.",
  },
  {
    chip: "02 · Приоритеты и шаги",
    caption:
      "Высокий приоритет выходит наверх, а крупная задача раскрывается в пошаговый чек-лист подзадач.",
  },
  {
    chip: "03 · Картина дня",
    caption:
      "Счётчики и круговой прогресс обновляются автоматически — всегда видно, что закрыто и что в работе.",
  },
];

const STEP_TARGETS = [0.24, 0.68, 0.96];

const SHORT_WEEKDAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const SHORT_MONTHS_RU = [
  "янв.",
  "февр.",
  "мар.",
  "апр.",
  "мая",
  "июн.",
  "июл.",
  "авг.",
  "сент.",
  "окт.",
  "нояб.",
  "дек.",
];

function getLocalDateWithOffset(offsetDays = 0, baseDate = new Date()) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function getLocalIsoDate(offsetDays = 0, baseDate = new Date()) {
  const d = getLocalDateWithOffset(offsetDays, baseDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatShortFutureWeekday(offsetDays, baseDate = new Date()) {
  const d = getLocalDateWithOffset(offsetDays, baseDate);
  return SHORT_WEEKDAYS_RU[d.getDay()] || "Скоро";
}

function formatShortFutureDate(offsetDays, baseDate = new Date()) {
  const d = getLocalDateWithOffset(offsetDays, baseDate);
  const wd = SHORT_WEEKDAYS_RU[d.getDay()];
  const mon = SHORT_MONTHS_RU[d.getMonth()];
  return `${wd}, ${d.getDate()} ${mon}`;
}

function getTimeSlot(now = new Date()) {
  const hour = now.getHours();
  if (hour < 17) return "day";
  if (hour < 21) return "evening";
  return "late";
}

function getUrgentDueLabel(now = new Date()) {
  const slot = getTimeSlot(now);
  if (slot === "day") return "Сегодня, 18:00";
  if (slot === "evening") return "Сегодня, 22:00";
  return "Завтра, 10:00";
}

function getSecondaryDueLabel(now = new Date()) {
  if (getTimeSlot(now) === "late") {
    return `${formatShortFutureDate(2, now)}, 14:00`;
  }
  return "Завтра, 14:00";
}

function getUpcomingDueLabel(now = new Date()) {
  const offset = getTimeSlot(now) === "late" ? 4 : 3;
  return formatShortFutureDate(offset, now);
}

function buildInitialSandboxTasks(now = new Date()) {
  return [
    {
      id: "sb-1",
      title: "Спроектировать реляционную схему PostgreSQL в 3НФ",
      category: "Бэкенд",
      color: "#0b6a55",
      priority: "medium",
      due: "Выполнено",
      done: true,
      subtasks: [],
    },
    {
      id: "sb-2",
      title: "Подготовить защиту практики и живое демо",
      category: "Практика",
      color: "#7c3aed",
      priority: "high",
      due: getUrgentDueLabel(now),
      done: false,
      subtasks: [
        { id: "sb-2a", title: "Проверить адаптив на 390px и тёмную тему", done: true },
        { id: "sb-2b", title: "Прогнать pytest и Docker healthcheck", done: false },
      ],
    },
    {
      id: "sb-3",
      title: "Настроить резервное копирование через pg_dump",
      category: "Бэкенд",
      color: "#0b6a55",
      priority: "medium",
      due: getSecondaryDueLabel(now),
      done: false,
      subtasks: [],
    },
    {
      id: "sb-4",
      title: "Собрать тезисы выступления на 2 минуты",
      category: "Учёба",
      color: "#2563eb",
      priority: "low",
      due: getUpcomingDueLabel(now),
      done: false,
      subtasks: [],
    },
  ];
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function range01(progress, start, end) {
  if (end <= start) return progress >= end ? 1 : 0;
  return clamp01((progress - start) / (end - start));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function formatRussianToday(baseDate = new Date()) {
  try {
    const formatted = new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(baseDate);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (_e) {
    return "Сегодня";
  }
}

/* ============================================================================
   THEME CONTROLLER
   ============================================================================ */
function initThemeToggle() {
  const btn = document.getElementById("btn-theme-toggle");
  if (!btn) return;

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      btn.setAttribute("aria-label", "Включить светлую тему");
      btn.setAttribute("title", "Светлая тема");
    } else {
      document.documentElement.removeAttribute("data-theme");
      btn.setAttribute("aria-label", "Включить тёмную тему");
      btn.setAttribute("title", "Тёмная тема");
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", theme === "dark" ? "#0c100f" : "#0b6a55");
    }
  }

  const currentIsDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(currentIsDark ? "dark" : "light");

  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (_e) {}
    applyTheme(next);
  });
}

/* ============================================================================
   APPLE-STYLE 3-PHASE PINNED SCROLL REEL + HERO DEPTH
   ============================================================================ */
function initScrollStory() {
  const track = document.getElementById("story-track");
  const progressBar = document.getElementById("scroll-progress-fill");
  const phaseChip = document.getElementById("story-stage-chip");
  const phaseCaption = document.getElementById("story-phase-caption");
  const expandBox = document.getElementById("stage-featured-expand");
  const stageProgressFill = document.getElementById("stage-progress-fill");
  const stageProgressPct = document.getElementById("stage-progress-pct");
  const stageSummary = document.getElementById("stage-summary");
  const ringArc = document.getElementById("stage-ring-arc");
  const landingView = document.getElementById("landing-view");
  const heroStage = document.getElementById("hero-stage");
  const heroWindow = document.getElementById("hero-window");

  if (!track) return { refresh: () => {} };

  const slips = Array.from(track.querySelectorAll(".stage-slip"));
  const tabs = Array.from(track.querySelectorAll(".reel-tab"));
  const tabFills = tabs.map((tab) => tab.querySelector(".reel-tab__meter-fill"));
  const subNodes = Array.from(track.querySelectorAll(".stage-subtask"));

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = reduceMotionQuery.matches;

  let targetProgress = 0;
  let currentProgress = 0;
  let reducedProgress = STEP_TARGETS[2];
  let rafId = null;
  let activeStepIndex = -1;

  const SCATTER = [
    { x: -16, y: 12, rot: -2.1 },
    { x: 14, y: 76, rot: 1.9 },
    { x: -12, y: 142, rot: -1.6 },
    { x: 12, y: 206, rot: 1.8 },
  ];
  const ALIGNED_Y = [8, 66, 124, 182];
  const SORTED_Y = [66, 8, 124, 182];

  function setActiveStep(idx) {
    if (idx === activeStepIndex) return;
    activeStepIndex = idx;
    tabs.forEach((tabEl, i) => {
      const isCurrent = i === idx;
      tabEl.setAttribute("data-active", String(isCurrent));
      if (isCurrent) {
        tabEl.setAttribute("aria-current", "step");
      } else {
        tabEl.removeAttribute("aria-current");
      }
    });
    const meta = PHASE_META[idx] || PHASE_META[0];
    if (phaseChip) phaseChip.textContent = meta.chip;
    if (phaseCaption) phaseCaption.textContent = meta.caption;
  }

  function updateHeroDepth() {
    if (!heroStage || !heroWindow) return;
    if (reduceMotion || (landingView && landingView.hidden) || window.innerWidth < 768) {
      heroWindow.style.transform = "";
      return;
    }
    const rect = heroStage.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    const norm = clamp01((vh - rect.top) / (vh + rect.height));
    const shiftY = lerp(10, -10, norm);
    const scale = lerp(0.988, 1.008, Math.sin(norm * Math.PI));
    heroWindow.style.transform = `translate3d(0, ${shiftY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
  }

  function renderStory(p) {
    // Active phase: 3 evenly paced bands
    let stepIdx = 0;
    if (p >= 0.72) stepIdx = 2;
    else if (p >= 0.34) stepIdx = 1;
    setActiveStep(stepIdx);

    // Per-tab inline progress fill
    const phaseBounds = [
      [0.0, 0.34],
      [0.34, 0.72],
      [0.72, 1.0],
    ];
    tabFills.forEach((fill, idx) => {
      if (!fill) return;
      const [s, e] = phaseBounds[idx];
      const val = idx < stepIdx ? 1 : idx > stepIdx ? 0 : range01(p, s, e);
      fill.style.transform = `scaleX(${val.toFixed(4)})`;
    });

    // Choreography curves across the 3 phases
    const tAlign = easeOutCubic(range01(p, 0.02, 0.24));
    const tMeta = easeOutCubic(range01(p, 0.16, 0.32));
    const tSort = easeInOutCubic(range01(p, 0.32, 0.45));
    const tDismiss = easeInOutCubic(range01(p, 0.41, 0.52));
    const tExpand = easeOutCubic(range01(p, 0.43, 0.55));
    const tSub0 = easeOutCubic(range01(p, 0.50, 0.59));
    const tSub1 = easeOutCubic(range01(p, 0.57, 0.66));
    const tSummary = easeOutCubic(range01(p, 0.74, 0.89));
    const tRing = easeOutCubic(range01(p, 0.79, 0.96));

    slips.forEach((slip, idx) => {
      const start = SCATTER[idx];
      const baseX = lerp(start.x, 0, tAlign);
      const baseRot = lerp(start.rot, 0, tAlign);
      const alignedY = lerp(start.y, ALIGNED_Y[idx], tAlign);
      let y = lerp(alignedY, SORTED_Y[idx], tSort);
      let opacity = 1;

      if (idx !== 1) {
        y += lerp(0, 22, tDismiss);
        opacity = lerp(1, 0, tDismiss);
      } else {
        y = lerp(y, 4, tExpand);
      }

      slip.style.transform = `translate3d(${baseX.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${baseRot.toFixed(2)}deg)`;
      slip.style.opacity = opacity.toFixed(3);
      slip.style.setProperty("--dot-scale", tMeta.toFixed(3));
      slip.style.setProperty("--bar-scale", tMeta.toFixed(3));
      slip.style.setProperty("--prio-opacity", tMeta.toFixed(3));
    });

    if (expandBox) {
      const fullHeight = Math.max(156, expandBox.scrollHeight + 12);
      expandBox.style.maxHeight =
        tExpand >= 0.995 ? `${fullHeight}px` : `${Math.round(lerp(0, fullHeight, tExpand))}px`;
      expandBox.style.opacity = tExpand.toFixed(3);
      expandBox.style.marginTop = `${(tExpand * 10).toFixed(1)}px`;
      expandBox.style.paddingTop = `${(tExpand * 10).toFixed(1)}px`;
      expandBox.style.borderTopWidth = tExpand > 0.05 ? "1px" : "0px";
    }

    if (subNodes[0]) {
      subNodes[0].style.setProperty("--check-offset", (1 - tSub0).toFixed(3));
      subNodes[0].setAttribute("data-checked", String(tSub0 > 0.65));
    }
    if (subNodes[1]) {
      subNodes[1].style.setProperty("--check-offset", (1 - tSub1).toFixed(3));
      subNodes[1].setAttribute("data-checked", String(tSub1 > 0.65));
    }
    if (subNodes[2]) {
      subNodes[2].style.setProperty("--check-offset", "1");
      subNodes[2].setAttribute("data-checked", "false");
    }

    const doneShare = (tSub0 + tSub1) / 3;
    if (stageProgressFill) {
      stageProgressFill.style.transform = `scaleX(${doneShare.toFixed(4)})`;
    }
    if (stageProgressPct) {
      stageProgressPct.textContent = `${Math.round(doneShare * 100)}%`;
    }

    if (stageSummary) {
      stageSummary.style.opacity = tSummary.toFixed(3);
      stageSummary.style.transform = `translate3d(0, ${lerp(20, 0, tSummary).toFixed(2)}px, 0)`;
    }
    if (ringArc) {
      const arcTarget = lerp(1, 0.33, tRing);
      ringArc.style.strokeDashoffset = arcTarget.toFixed(4);
    }
  }

  function updateReadingProgress() {
    if (!progressBar) return;
    if (landingView && landingView.hidden) {
      progressBar.style.transform = "scaleX(0)";
      return;
    }
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = clamp01(window.scrollY / maxScroll);
    progressBar.style.transform = `scaleX(${ratio.toFixed(4)})`;
  }

  function computeTarget() {
    updateReadingProgress();
    updateHeroDepth();
    if (landingView && landingView.hidden) return;
    if (reduceMotion) {
      renderStory(reducedProgress);
      return;
    }
    const rect = track.getBoundingClientRect();
    const stickyTop = 72;
    const scrollable = Math.max(1, track.offsetHeight - (window.innerHeight - stickyTop));
    targetProgress = clamp01((stickyTop - rect.top) / scrollable);

    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function tick() {
    const diff = targetProgress - currentProgress;
    if (Math.abs(diff) < 0.0005) {
      currentProgress = targetProgress;
      renderStory(currentProgress);
      rafId = null;
      return;
    }
    currentProgress += diff * 0.16;
    renderStory(currentProgress);
    rafId = requestAnimationFrame(tick);
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-jump-step"));
      const target = STEP_TARGETS[idx] ?? 0.94;
      if (reduceMotion) {
        reducedProgress = target;
        currentProgress = target;
        targetProgress = target;
        renderStory(target);
        return;
      }
      const stickyTop = 72;
      const trackTop = track.getBoundingClientRect().top + window.scrollY;
      const scrollable = Math.max(1, track.offsetHeight - (window.innerHeight - stickyTop));
      const destY = trackTop - stickyTop + target * scrollable;
      window.scrollTo({ top: destY, behavior: "smooth" });
    });
  });

  window.addEventListener("scroll", computeTarget, { passive: true });
  window.addEventListener("resize", computeTarget, { passive: true });

  if (reduceMotionQuery.addEventListener) {
    reduceMotionQuery.addEventListener("change", (ev) => {
      reduceMotion = ev.matches;
      if (reduceMotion) {
        currentProgress = reducedProgress;
        targetProgress = reducedProgress;
        renderStory(reducedProgress);
        updateHeroDepth();
      } else {
        computeTarget();
      }
    });
  }

  if (reduceMotion) {
    currentProgress = reducedProgress;
    renderStory(reducedProgress);
  } else {
    currentProgress = 0;
    renderStory(0);
    computeTarget();
  }

  return {
    refresh: () => {
      if (reduceMotion) {
        updateReadingProgress();
        renderStory(reducedProgress);
        updateHeroDepth();
      } else {
        computeTarget();
      }
    },
  };
}

/* ============================================================================
   INTERACTIVE DAY-FOCUS SANDBOX (NATIVE TASK PLANNER MICRO-DEMO)
   ============================================================================ */
function initSandboxDemo() {
  const listEl = document.getElementById("sandbox-list");
  const filtersEl = document.getElementById("sandbox-filters");
  const pctEl = document.getElementById("sandbox-pct");
  const fillEl = document.getElementById("sandbox-fill");
  const summaryEl = document.getElementById("sandbox-summary");
  const statusEl = document.getElementById("sandbox-status");
  const resetBtn = document.getElementById("btn-sandbox-reset");

  if (!listEl) return { refreshDates: () => {} };

  function cloneInitial(now = new Date()) {
    return buildInitialSandboxTasks(now).map((t) => ({
      ...t,
      subtasks: t.subtasks.map((s) => ({ ...s })),
    }));
  }

  let items = cloneInitial();
  let activeCategory = "all";

  function makeTickSvg() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("class", "ink-check__svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "ink-check__path");
    path.setAttribute("pathLength", "1");
    path.setAttribute("d", "M3 8.5 L6.5 12 L13 4.5");
    svg.appendChild(path);
    return svg;
  }

  function updateMeter(announcement = "") {
    const total = items.length;
    const doneCount = items.filter((t) => t.done).length;
    const ratio = total > 0 ? doneCount / total : 0;
    const pct = Math.round(ratio * 100);

    if (pctEl) pctEl.textContent = `${pct}%`;
    if (fillEl) fillEl.style.transform = `scaleX(${ratio.toFixed(4)})`;
    if (summaryEl) {
      summaryEl.textContent =
        doneCount === total
          ? "Все задачи примера выполнены — отличный ритм!"
          : `Выполнено ${doneCount} из ${total} задач`;
    }
    if (statusEl && announcement) {
      statusEl.textContent = announcement;
    }
  }

  function renderSandbox(restoreKey = null) {
    listEl.innerHTML = "";
    const visible =
      activeCategory === "all"
        ? items
        : items.filter((t) => t.category === activeCategory);

    visible.forEach((task) => {
      const li = document.createElement("li");
      li.className = `sandbox-item sandbox-item--prio-${task.priority} ${
        task.done ? "sandbox-item--done" : ""
      }`;

      const top = document.createElement("div");
      top.className = "sandbox-item__row";

      const checkLabel = document.createElement("label");
      checkLabel.className = "ink-check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "ink-check__input";
      cb.dataset.sandboxFocus = `task:${task.id}`;
      cb.checked = task.done;
      cb.setAttribute("aria-label", `Отметить задачу «${task.title}»`);
      cb.addEventListener("change", () => {
        const hadFocus = document.activeElement === cb;
        task.done = cb.checked;
        if (task.subtasks.length > 0) {
          task.subtasks.forEach((s) => {
            s.done = task.done;
          });
        }
        renderSandbox(hadFocus ? cb.dataset.sandboxFocus : null);
        updateMeter(
          task.done
            ? `Задача «${task.title}» выполнена.`
            : `Задача «${task.title}» возвращена в работу.`
        );
      });
      const box = document.createElement("span");
      box.className = "ink-check__box";
      box.setAttribute("aria-hidden", "true");
      box.appendChild(makeTickSvg());
      checkLabel.appendChild(cb);
      checkLabel.appendChild(box);

      const content = document.createElement("div");
      content.className = "sandbox-item__body";

      const title = document.createElement("span");
      title.className = "sandbox-item__title";
      title.textContent = task.title;
      content.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "sandbox-item__meta";

      const catChip = document.createElement("span");
      catChip.className = "sandbox-chip";
      const dot = document.createElement("span");
      dot.className = "category-list__dot";
      dot.style.backgroundColor = task.color;
      dot.setAttribute("aria-hidden", "true");
      catChip.appendChild(dot);
      catChip.appendChild(document.createTextNode(task.category));
      meta.appendChild(catChip);

      const dueChip = document.createElement("span");
      dueChip.className = "sandbox-chip";
      dueChip.textContent = task.done ? "Готово" : task.due;
      meta.appendChild(dueChip);

      if (task.subtasks.length > 0) {
        const subDone = task.subtasks.filter((s) => s.done).length;
        const subChip = document.createElement("span");
        subChip.className = "sandbox-chip sandbox-chip--accent";
        subChip.textContent = `Подзадачи ${subDone}/${task.subtasks.length}`;
        meta.appendChild(subChip);
      }

      content.appendChild(meta);
      top.appendChild(checkLabel);
      top.appendChild(content);
      li.appendChild(top);

      if (task.subtasks.length > 0) {
        const subList = document.createElement("ul");
        subList.className = "sandbox-subtasks";
        subList.setAttribute("aria-label", `Подзадачи для ${task.title}`);
        task.subtasks.forEach((sub) => {
          const sLi = document.createElement("li");
          sLi.className = `sandbox-subtask ${sub.done ? "sandbox-subtask--done" : ""}`;

          const sLabel = document.createElement("label");
          sLabel.className = "sandbox-subtask__label";

          const sCbWrap = document.createElement("span");
          sCbWrap.className = "ink-check ink-check--sm";
          const sCb = document.createElement("input");
          sCb.type = "checkbox";
          sCb.className = "ink-check__input";
          sCb.dataset.sandboxFocus = `sub:${sub.id}`;
          sCb.checked = sub.done;
          sCb.addEventListener("change", () => {
            const hadFocus = document.activeElement === sCb;
            sub.done = sCb.checked;
            task.done = task.subtasks.every((s) => s.done);
            renderSandbox(hadFocus ? sCb.dataset.sandboxFocus : null);
            updateMeter(
              sub.done
                ? `Шаг «${sub.title}» отмечен выполненным.`
                : `Шаг «${sub.title}» снова в работе.`
            );
          });
          const sBox = document.createElement("span");
          sBox.className = "ink-check__box";
          sBox.setAttribute("aria-hidden", "true");
          sBox.appendChild(makeTickSvg());
          sCbWrap.appendChild(sCb);
          sCbWrap.appendChild(sBox);

          const sTitle = document.createElement("span");
          sTitle.className = "sandbox-subtask__text";
          sTitle.textContent = sub.title;

          sLabel.appendChild(sCbWrap);
          sLabel.appendChild(sTitle);
          sLi.appendChild(sLabel);
          subList.appendChild(sLi);
        });
        li.appendChild(subList);
      }

      listEl.appendChild(li);
    });

    if (restoreKey) {
      const target = listEl.querySelector(`[data-sandbox-focus="${restoreKey}"]`);
      if (target) target.focus({ preventScroll: true });
    }
  }

  if (filtersEl) {
    filtersEl.querySelectorAll("[data-sandbox-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.getAttribute("data-sandbox-cat") || "all";
        filtersEl.querySelectorAll("[data-sandbox-cat]").forEach((other) => {
          const isAct = other === btn;
          other.classList.toggle("sandbox-pill--active", isAct);
          other.setAttribute("aria-pressed", String(isAct));
        });
        renderSandbox();
      });
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      items = cloneInitial();
      activeCategory = "all";
      if (filtersEl) {
        filtersEl.querySelectorAll("[data-sandbox-cat]").forEach((btn) => {
          const isAll = btn.getAttribute("data-sandbox-cat") === "all";
          btn.classList.toggle("sandbox-pill--active", isAll);
          btn.setAttribute("aria-pressed", String(isAll));
        });
      }
      renderSandbox();
      updateMeter("Пример возвращён в исходное состояние.");
    });
  }

  renderSandbox();
  updateMeter();

  return {
    refreshDates(now = new Date()) {
      const freshById = new Map(buildInitialSandboxTasks(now).map((t) => [t.id, t.due]));
      let changed = false;
      items.forEach((task) => {
        const nextDue = freshById.get(task.id);
        if (nextDue && task.due !== nextDue) {
          task.due = nextDue;
          changed = true;
        }
      });
      if (changed) {
        const activeFocus =
          document.activeElement instanceof HTMLElement && listEl.contains(document.activeElement)
            ? document.activeElement.dataset.sandboxFocus || null
            : null;
        renderSandbox(activeFocus);
      }
    },
  };
}

function syncStaticDateLabels(now = new Date()) {
  const todayLabel = formatRussianToday(now);
  const heroDate = document.getElementById("hero-today-date");
  if (heroDate) {
    heroDate.textContent = todayLabel;
  }

  const wsDate = document.getElementById("ws-date");
  if (wsDate) {
    wsDate.textContent = todayLabel;
  }

  const heroUrgent = document.getElementById("hero-urgent-pill");
  if (heroUrgent) {
    heroUrgent.textContent = getUrgentDueLabel(now);
  }

  document.querySelectorAll("[data-reel-day-offset]").forEach((node) => {
    const offset = Number(node.getAttribute("data-reel-day-offset"));
    const cat = node.getAttribute("data-reel-cat") || "";
    if (!Number.isFinite(offset)) return;
    const wd = formatShortFutureWeekday(offset, now);
    node.textContent = cat ? `${cat} · ${wd}` : wd;
  });
}

/* Expose helper namespace for app.js */
window.plannerMotion = {
  formatRussianToday,
  getLocalIsoDate,
  getTimeSlot,
  storyController: null,
  sandboxController: null,
  syncLiveDates(now = new Date()) {
    syncStaticDateLabels(now);
    if (this.sandboxController) {
      this.sandboxController.refreshDates(now);
    }
  },
  init() {
    initThemeToggle();
    this.storyController = initScrollStory();
    this.sandboxController = initSandboxDemo();
    this.syncLiveDates();
  },
};
