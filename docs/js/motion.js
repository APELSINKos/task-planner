/*
 * Motion & Theme Engine for Task Planner.
 * Zero external dependencies: rAF-damped scroll choreography, interactive card stack,
 * IntersectionObserver SVG draw, reading progress hairline, and theme persistence.
 */

const THEME_STORAGE_KEY = "task_planner_theme";

const TRIAGE_SAMPLES = [
  {
    title: "Проверить мобильную вёрстку на 390px",
    desc: "Убедиться, что нет горизонтального скролла и все кнопки не меньше 44px.",
    category: "Практика",
    color: "#1a45c2",
    due: "Сегодня, 18:00",
    sub: "Подзадачи: 2 из 3",
  },
  {
    title: "Настроить резервное копирование PostgreSQL",
    desc: "Проверить скрипт pg_dump и тестовое восстановление базы в контейнере.",
    category: "Бэкенд",
    color: "#0f766e",
    due: "Завтра, 14:00",
    sub: "Высокий приоритет",
  },
  {
    title: "Подготовить тезисы выступления к защите",
    desc: "Выделить ключевые архитектурные решения и план живой демонстрации на 2 минуты.",
    category: "Учёба",
    color: "#7e470a",
    due: "Пятница",
    sub: "Подзадачи: 1 из 2",
  },
];

const PHASE_LABELS = [
  "01 / Сбор",
  "02 / Приоритеты",
  "03 / Подзадачи",
  "04 / Картина дня",
];

const STEP_TARGETS = [0.16, 0.44, 0.70, 0.96];

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

function formatRussianToday() {
  try {
    const formatted = new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (_e) {
    return "Рабочий день";
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
      metaTheme.setAttribute("content", theme === "dark" ? "#0c1018" : "#1a45c2");
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
   APPLE-STYLE PINNED SCROLL STORY ENGINE
   ============================================================================ */
function initScrollStory() {
  const track = document.getElementById("story-track");
  const progressBar = document.getElementById("scroll-progress-fill");
  const railFill = document.getElementById("story-rail-fill");
  const phaseChip = document.getElementById("story-stage-chip");
  const expandBox = document.getElementById("stage-featured-expand");
  const stageProgressFill = document.getElementById("stage-progress-fill");
  const stageProgressPct = document.getElementById("stage-progress-pct");
  const stageSummary = document.getElementById("stage-summary");
  const ringArc = document.getElementById("stage-ring-arc");
  const landingView = document.getElementById("landing-view");

  if (!track) return { refresh: () => {} };

  const slips = Array.from(track.querySelectorAll(".stage-slip"));
  const steps = Array.from(track.querySelectorAll(".story-step"));
  const subNodes = Array.from(track.querySelectorAll(".stage-subtask"));

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stackedStepsQuery = window.matchMedia("(max-width: 1023px), (max-height: 700px)");
  let reduceMotion = reduceMotionQuery.matches;

  let targetProgress = 0;
  let currentProgress = 0;
  let reducedProgress = 1;
  let rafId = null;
  let activeStepIndex = -1;

  const SCATTER = [
    { x: -18, y: 12, rot: -2.8 },
    { x: 16, y: 78, rot: 2.5 },
    { x: -14, y: 148, rot: -2.0 },
    { x: 14, y: 214, rot: 2.2 },
  ];
  const ALIGNED_Y = [8, 66, 124, 182];
  const SORTED_Y = [66, 8, 124, 182]; // Slip 1 (high priority) rises to slot 0

  function syncStepFocusability() {
    const isStacked = !reduceMotion && stackedStepsQuery.matches;
    steps.forEach((stepEl, i) => {
      const btn = stepEl.querySelector(".story-step__trigger");
      const hiddenInStack = isStacked && i !== activeStepIndex;
      if (hiddenInStack) {
        stepEl.setAttribute("aria-hidden", "true");
        if (btn) btn.setAttribute("tabindex", "-1");
      } else {
        stepEl.removeAttribute("aria-hidden");
        if (btn) btn.setAttribute("tabindex", "0");
      }
    });
  }

  function setActiveStep(idx) {
    if (idx === activeStepIndex) return;
    activeStepIndex = idx;
    steps.forEach((stepEl, i) => {
      const isCurrent = i === idx;
      stepEl.setAttribute("data-active", String(isCurrent));
      if (isCurrent) {
        stepEl.setAttribute("aria-current", "step");
      } else {
        stepEl.removeAttribute("aria-current");
      }
    });
    syncStepFocusability();
    if (phaseChip) {
      phaseChip.textContent = PHASE_LABELS[idx] || PHASE_LABELS[0];
    }
  }

  function renderStory(p) {
    if (railFill) {
      railFill.style.transform = `scaleY(${clamp01(p).toFixed(4)})`;
    }

    // Active step index
    let stepIdx = 0;
    if (p >= 0.74) stepIdx = 3;
    else if (p >= 0.48) stepIdx = 2;
    else if (p >= 0.22) stepIdx = 1;
    setActiveStep(stepIdx);

    // Phase progress curves
    const tAlign = easeOutCubic(range01(p, 0.02, 0.22));
    const tMeta = easeOutCubic(range01(p, 0.22, 0.34));
    const tSort = easeInOutCubic(range01(p, 0.30, 0.46));
    const tDismiss = easeInOutCubic(range01(p, 0.48, 0.60));
    const tExpand = easeOutCubic(range01(p, 0.50, 0.64));
    const tSub0 = easeOutCubic(range01(p, 0.58, 0.66));
    const tSub1 = easeOutCubic(range01(p, 0.65, 0.73));
    const tSummary = easeOutCubic(range01(p, 0.75, 0.90));
    const tRing = easeOutCubic(range01(p, 0.80, 0.96));

    slips.forEach((slip, idx) => {
      const start = SCATTER[idx];
      const baseX = lerp(start.x, 0, tAlign);
      const baseRot = lerp(start.rot, 0, tAlign);
      const alignedY = lerp(start.y, ALIGNED_Y[idx], tAlign);
      let y = lerp(alignedY, SORTED_Y[idx], tSort);
      let opacity = 1;

      if (idx !== 1) {
        y += lerp(0, 26, tDismiss);
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
      expandBox.style.maxHeight = tExpand >= 0.995 ? `${fullHeight}px` : `${Math.round(lerp(0, fullHeight, tExpand))}px`;
      expandBox.style.opacity = tExpand.toFixed(3);
      expandBox.style.marginTop = `${(tExpand * 10).toFixed(1)}px`;
      expandBox.style.paddingTop = `${(tExpand * 8).toFixed(1)}px`;
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

    const doneShare = ((tSub0 + tSub1) / 3);
    if (stageProgressFill) {
      stageProgressFill.style.transform = `scaleX(${doneShare.toFixed(4)})`;
    }
    if (stageProgressPct) {
      stageProgressPct.textContent = `${Math.round(doneShare * 100)}%`;
    }

    if (stageSummary) {
      stageSummary.style.opacity = tSummary.toFixed(3);
      stageSummary.style.transform = `translate3d(0, ${lerp(22, 0, tSummary).toFixed(2)}px, 0)`;
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
    if (landingView && landingView.hidden) return;
    if (reduceMotion) {
      renderStory(reducedProgress);
      syncStepFocusability();
      return;
    }
    const rect = track.getBoundingClientRect();
    const stickyTop = 64;
    const scrollable = Math.max(1, track.offsetHeight - (window.innerHeight - stickyTop));
    targetProgress = clamp01((stickyTop - rect.top) / scrollable);
    syncStepFocusability();

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

  // Click step buttons to smoothly glide to that stage (or inspect stage directly under reduced motion)
  track.querySelectorAll("[data-jump-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-jump-step"));
      if (reduceMotion) {
        reducedProgress = STEP_TARGETS[idx] ?? 1;
        currentProgress = reducedProgress;
        targetProgress = reducedProgress;
        renderStory(reducedProgress);
        return;
      }
      const stickyTop = 64;
      const trackTop = track.getBoundingClientRect().top + window.scrollY;
      const scrollable = Math.max(1, track.offsetHeight - (window.innerHeight - stickyTop));
      const destY = trackTop - stickyTop + STEP_TARGETS[idx] * scrollable;
      window.scrollTo({ top: destY, behavior: "smooth" });
    });
  });

  window.addEventListener("scroll", computeTarget, { passive: true });
  window.addEventListener("resize", computeTarget, { passive: true });

  if (stackedStepsQuery.addEventListener) {
    stackedStepsQuery.addEventListener("change", syncStepFocusability);
  }

  if (reduceMotionQuery.addEventListener) {
    reduceMotionQuery.addEventListener("change", (ev) => {
      reduceMotion = ev.matches;
      if (reduceMotion) {
        currentProgress = reducedProgress;
        targetProgress = reducedProgress;
        renderStory(reducedProgress);
        syncStepFocusability();
      } else {
        computeTarget();
      }
    });
  }

  // Initial render
  if (reduceMotion) {
    currentProgress = reducedProgress;
    renderStory(reducedProgress);
    syncStepFocusability();
  } else {
    currentProgress = 0;
    renderStory(0);
    computeTarget();
  }

  return {
    refresh: () => {
      if (reduceMotion) {
        renderStory(reducedProgress);
        syncStepFocusability();
      } else {
        computeTarget();
      }
    },
  };
}

/* ============================================================================
   INTERACTIVE DAY-CARD TRIAGE STACK
   ============================================================================ */
function initTriageDemo() {
  const section = document.getElementById("try-demo");
  const landingView = document.getElementById("landing-view");
  const deck = document.getElementById("triage-deck");
  const card = document.getElementById("triage-card");
  const doneBox = document.getElementById("triage-done");
  const controls = document.getElementById("triage-controls");
  const counterEl = document.getElementById("triage-counter");
  const catEl = document.getElementById("triage-category");
  const titleEl = document.getElementById("triage-card-title");
  const descEl = document.getElementById("triage-card-desc");
  const dueEl = document.getElementById("triage-card-due");
  const subEl = document.getElementById("triage-card-sub");
  const statusEl = document.getElementById("triage-status");
  const marginNote = document.getElementById("triage-margin-note");
  const doneSummary = document.getElementById("triage-done-summary");
  const resetBtn = document.getElementById("btn-triage-reset");
  const openBtn = document.getElementById("btn-triage-open");

  if (!deck || !card) return;

  let index = 0;
  let busy = false;
  const counts = { done: 0, focus: 0, defer: 0 };
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function renderCard(restoreFocusOnDone = false) {
    if (index >= TRIAGE_SAMPLES.length) {
      card.hidden = true;
      doneBox.hidden = false;
      controls.hidden = true;
      doneSummary.textContent = `Выполнено: ${counts.done} · В фокусе: ${counts.focus} · На завтра: ${counts.defer}`;
      if (marginNote) marginNote.textContent = "список разобран";
      if (restoreFocusOnDone && (openBtn || resetBtn)) {
        (openBtn || resetBtn).focus();
      }
      return;
    }

    const item = TRIAGE_SAMPLES[index];
    card.hidden = false;
    doneBox.hidden = true;
    controls.hidden = false;

    counterEl.textContent = `${index + 1} из ${TRIAGE_SAMPLES.length}`;
    catEl.innerHTML = "";
    const dot = document.createElement("span");
    dot.className = "category-list__dot";
    dot.style.backgroundColor = item.color;
    dot.setAttribute("aria-hidden", "true");
    catEl.appendChild(dot);
    catEl.appendChild(document.createTextNode(item.category));

    titleEl.textContent = item.title;
    descEl.textContent = item.desc;
    dueEl.textContent = item.due;
    subEl.textContent = item.sub;
  }

  function handleAction(action) {
    if (busy || index >= TRIAGE_SAMPLES.length) return;
    const focusWasInControls = controls.contains(document.activeElement);
    counts[action] += 1;

    const messages = {
      done: "Отмечено выполненной — минус одна забота.",
      focus: "Добавлено в фокус сегодняшнего дня.",
      defer: "Спокойно перенесено на завтра.",
    };
    if (statusEl) statusEl.textContent = messages[action];
    if (marginNote) {
      const left = TRIAGE_SAMPLES.length - index - 1;
      marginNote.textContent = left > 0 ? `осталось ${left}` : "готово";
    }

    if (reduceMotion()) {
      index += 1;
      renderCard(focusWasInControls);
      return;
    }

    busy = true;
    card.style.transform = "";
    const exitClass = action === "done" ? "triage-card--exit-right" : "triage-card--exit-left";
    card.classList.add(exitClass);

    setTimeout(() => {
      index += 1;
      card.classList.remove(exitClass);
      renderCard(focusWasInControls);

      if (index < TRIAGE_SAMPLES.length) {
        card.classList.add("triage-card--enter");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            card.classList.remove("triage-card--enter");
            busy = false;
          });
        });
      } else {
        busy = false;
      }
    }, 240);
  }

  deck.querySelectorAll("[data-triage]").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn.getAttribute("data-triage")));
  });

  // Pointer/touch horizontal swipe on the active card
  let dragStartX = 0;
  let dragStartY = 0;
  let dragDx = 0;
  let dragging = false;
  let pointerId = null;

  card.addEventListener("pointerdown", (event) => {
    if (busy || reduceMotion() || event.button > 0) return;
    pointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragDx = 0;
    dragging = false;
  });

  card.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId || busy) return;
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if (!dragging) {
      if (Math.abs(dx) < 10 || Math.abs(dy) > Math.abs(dx)) return;
      dragging = true;
      card.classList.add("triage-card--dragging");
      try {
        card.setPointerCapture(event.pointerId);
      } catch (_e) {}
    }
    dragDx = dx;
    const rot = Math.max(-8, Math.min(8, dx * 0.05));
    card.style.transform = `translate3d(${dx.toFixed(1)}px, 0, 0) rotate(${rot.toFixed(2)}deg)`;
  });

  function finishDrag(event) {
    if (pointerId !== event.pointerId) return;
    const wasDragging = dragging;
    const finalDx = dragDx;
    pointerId = null;
    dragging = false;
    dragDx = 0;
    card.classList.remove("triage-card--dragging");
    if (!wasDragging) return;
    if (finalDx >= 64) {
      handleAction("done");
    } else if (finalDx <= -64) {
      handleAction("defer");
    } else {
      card.style.transform = "";
    }
  }

  card.addEventListener("pointerup", finishDrag);
  card.addEventListener("pointercancel", finishDrag);

  // Support keys 1, 2, 3 whenever triage section is visible or focused (and no input/modal is active)
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "1" && event.key !== "2" && event.key !== "3") return;
    if (landingView && landingView.hidden) return;
    if (document.querySelector(".modal:not([hidden])")) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
      (active instanceof HTMLElement && active.isContentEditable)
    ) {
      return;
    }
    const inDeck = deck.contains(active);
    let inViewport = false;
    if (section) {
      const rect = section.getBoundingClientRect();
      inViewport = rect.top < window.innerHeight * 0.85 && rect.bottom > 80;
    }
    if (!inDeck && !inViewport) return;

    event.preventDefault();
    if (event.key === "1") handleAction("done");
    else if (event.key === "2") handleAction("focus");
    else if (event.key === "3") handleAction("defer");
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      index = 0;
      counts.done = 0;
      counts.focus = 0;
      counts.defer = 0;
      if (statusEl) statusEl.textContent = "";
      if (marginNote) marginNote.textContent = "можно нажимать";
      renderCard();
      const firstAction = controls.querySelector("[data-triage]");
      if (firstAction) firstAction.focus();
    });
  }

  renderCard();
}

/* ============================================================================
   WEEKLY RHYTHM SVG CURVE TRIGGER
   ============================================================================ */
function initRhythmReveal() {
  const figure = document.getElementById("rhythm-figure");
  if (!figure) return;

  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  ) {
    figure.classList.add("rhythm__figure--visible");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          figure.classList.add("rhythm__figure--visible");
          observer.disconnect();
          break;
        }
      }
    },
    { threshold: 0.25 }
  );

  observer.observe(figure);
}

/* Expose helper namespace for app.js */
window.plannerMotion = {
  formatRussianToday,
  storyController: null,
  init() {
    initThemeToggle();
    this.storyController = initScrollStory();
    initTriageDemo();
    initRhythmReveal();

    const heroDate = document.getElementById("hero-margin-date");
    const daySheetDate = document.querySelector(".day-sheet__day");
    const todayStr = formatRussianToday();
    if (heroDate) heroDate.textContent = todayStr;
    if (daySheetDate) daySheetDate.textContent = `${todayStr}`;
  },
};
