(() => {
  "use strict";

  const INSTALL_KEY = "__chatgptMessageNavigatorInstalled";
  const API_KEY = "__chatgptMessageNavigator";
  const ROOT_ID = "chatgpt-message-navigator";
  const STYLE_ID = "chatgpt-message-navigator-style";
  const VERSION = "1.1.11";

  if (window[API_KEY]?.destroy) window[API_KEY].destroy();

  let root = null;
  let list = null;
  let tooltip = null;
  let lastWheelStepAt = 0;
  let tooltipHideTimer = 0;
  let conversationKey = "";
  let scrollContainer = null;
  let messageTargets = [];
  let activeIndex = -1;
  let selectedIndex = -1;
  let updateTimer = 0;
  let restoreLatestTimer = 0;
  let restoreLatestInterval = 0;
  let pendingLatestRestore = false;
  let frame = 0;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      z-index: 2147483000;
      display: flex;
      align-items: stretch;
      pointer-events: none;
      color: var(--color-text, #202123);
      font-family: var(--font-sans, "Segoe UI", sans-serif);
    }
    #${ROOT_ID}[hidden] { display: none !important; }
    #${ROOT_ID} .cgpt-nav-list {
      display: flex;
      max-height: min(68vh, 680px);
      width: 28px;
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
      overflow-x: hidden;
      overflow-y: auto;
      padding: 8px 5px;
      border-radius: 10px;
      scrollbar-width: none;
      pointer-events: auto;
    }
    #${ROOT_ID} .cgpt-nav-list::-webkit-scrollbar { display: none; }
    #${ROOT_ID} .cgpt-nav-item {
      display: block;
      width: 8px;
      min-height: 3px;
      height: 3px;
      margin: 0;
      padding: 0;
      flex: 0 0 3px;
      border: 0;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 27%, transparent);
      cursor: default;
      outline: none;
      transition: width 120ms ease, background-color 120ms ease, transform 120ms ease;
    }
    #${ROOT_ID} .cgpt-nav-item:hover,
    #${ROOT_ID} .cgpt-nav-item:focus-visible {
      width: 17px;
      background: color-mix(in srgb, currentColor 62%, transparent);
    }
    #${ROOT_ID} .cgpt-nav-item[data-active="true"] {
      width: 20px;
      height: 4px;
      min-height: 4px;
      flex-basis: 4px;
      background: color-mix(in srgb, currentColor 78%, transparent);
    }
    #${ROOT_ID} .cgpt-nav-item[data-selected="true"] {
      width: 20px;
      background: color-mix(in srgb, currentColor 72%, transparent);
    }
    #${ROOT_ID} .cgpt-nav-tooltip {
      position: absolute;
      left: 46px;
      width: min(330px, calc(100vw - 100px));
      padding: 8px 10px;
      border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
      border-radius: 9px;
      background: color-mix(in srgb, var(--color-background-primary, #fff) 94%, transparent);
      box-shadow: 0 8px 28px rgba(0, 0, 0, .16);
      color: var(--color-text, #202123);
      font-size: 12px;
      line-height: 1.45;
      white-space: normal;
      word-break: break-word;
      opacity: 0;
      transform: translateY(-50%) translateX(-4px);
      transition: opacity 90ms ease, transform 90ms ease;
      pointer-events: none;
    }
    #${ROOT_ID} .cgpt-nav-tooltip[data-open="true"] {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
    #${ROOT_ID} .cgpt-nav-tooltip .cgpt-nav-number {
      margin-bottom: 3px;
      color: color-mix(in srgb, currentColor 55%, transparent);
      font-size: 11px;
    }
    @media (prefers-reduced-motion: reduce) {
      #${ROOT_ID} *, #${ROOT_ID} *::before, #${ROOT_ID} *::after { transition: none !important; }
    }
  `;
  document.getElementById(STYLE_ID)?.remove();
  document.head.appendChild(style);

  function isChatGPTMode() {
    const localized = document.querySelector(
      'button[aria-label*="当前模式：ChatGPT"], button[aria-label*="current mode: ChatGPT" i]'
    );
    if (localized) return true;
    return [...document.querySelectorAll('button[aria-haspopup="menu"]')].some(
      (button) => (button.textContent || "").trim() === "ChatGPT"
    );
  }

  function ensureRoot() {
    if (root?.isConnected) return;
    root = document.createElement("nav");
    root.id = ROOT_ID;
    root.setAttribute("aria-label", "ChatGPT 历史消息导航");
    root.hidden = true;

    list = document.createElement("div");
    list.className = "cgpt-nav-list";
    list.setAttribute("role", "list");

    tooltip = document.createElement("div");
    tooltip.className = "cgpt-nav-tooltip";
    tooltip.setAttribute("role", "tooltip");

    list.addEventListener("wheel", handleNavigationWheel, { passive: false });

    root.append(list, tooltip);
    document.body.appendChild(root);
  }

  function getConversation() {
    return document.querySelector('[data-thread-find-target="conversation"]');
  }

  function getConversationKey() {
    const titleButton = [...document.querySelectorAll("button")].find((button) => {
      const rect = button.getBoundingClientRect();
      const text = (button.innerText || "").trim();
      return rect.left > 275 && rect.top >= 18 && rect.top < 83 &&
        rect.width > 50 && text && text.length < 160 &&
        !button.getAttribute("aria-label");
    });
    return (titleButton?.innerText || "").trim();
  }

  function getScrollContainer(conversation) {
    return conversation?.closest(".thread-scroll-container") ||
      conversation?.parentElement?.closest(".thread-scroll-container") ||
      [...document.querySelectorAll("div")].find((element) => {
        const css = getComputedStyle(element);
        return /(auto|scroll)/.test(css.overflowY) &&
          element.scrollHeight > element.clientHeight + 100 &&
          element.contains(conversation);
      }) || null;
  }

  function getMessageTargets(conversation) {
    const keyedUnits = [...conversation.querySelectorAll("[data-content-search-unit-key]")]
      .filter((unit) => (unit.getAttribute("data-content-search-unit-key") || "")
        .endsWith(":user"));
    const mountedByKey = new Map(keyedUnits.map((unit) => [
      unit.getAttribute("data-content-search-unit-key"),
      unit,
    ]));

    const fiberKey = Object.getOwnPropertyNames(conversation)
      .find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? conversation[fiberKey] : null;
    let entries = null;
    for (let depth = 0; fiber && depth < 30; depth += 1, fiber = fiber.return) {
      if (Array.isArray(fiber.memoizedProps?.entries)) {
        entries = fiber.memoizedProps.entries;
        break;
      }
    }

    if (entries?.length) {
      return entries.flatMap((entry, turnIndex) => {
        const userItemIndex = (entry.turn?.items || [])
          .findIndex((item) => item?.type === "user-message");
        if (userItemIndex < 0) return [];
        const item = entry.turn.items[userItemIndex];
        const turnKey = entry.turnKey || entry.id || `fallback-turn-${turnIndex}`;
        const key = `${turnKey}:${userItemIndex}:user`;
        return [{
          key,
          text: item.message || "（附件或空消息）",
          target: mountedByKey.get(key) || null,
          turnIndex,
        }];
      });
    }

    if (keyedUnits.length) {
      return keyedUnits.map((target, turnIndex) => ({
        key: target.getAttribute("data-content-search-unit-key") || `mounted-${turnIndex}`,
        text: "",
        target,
        turnIndex,
      }));
    }

    return [...conversation.querySelectorAll("h4")]
      .filter((heading) => /^(你说：?|You said:?)$/i.test((heading.textContent || "").trim()))
      .map((heading, turnIndex) => ({
        key: `heading-${turnIndex}`,
        text: "",
        target: heading.nextElementSibling || heading,
        turnIndex,
      }));
  }

  function messageText(record) {
    const raw = (record?.text || record?.target?.innerText || record?.target?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!raw) return "（附件或空消息）";
    return raw.length > 110 ? `${raw.slice(0, 110)}…` : raw;
  }

  function setTooltip(button, index, text) {
    const listRect = list.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const center = buttonRect.top + buttonRect.height / 2 - listRect.top;
    tooltip.style.top = `${Math.max(18, Math.min(listRect.height - 18, center))}px`;
    tooltip.innerHTML = "";
    const number = document.createElement("div");
    number.className = "cgpt-nav-number";
    number.textContent = `第 ${index + 1} 条提问`;
    const content = document.createElement("div");
    content.textContent = text;
    tooltip.append(number, content);
    tooltip.dataset.open = "true";
  }

  function hideTooltip() {
    window.clearTimeout(tooltipHideTimer);
    if (tooltip) tooltip.dataset.open = "false";
  }

  function previewSelection(index) {
    const button = list?.children[index];
    const record = messageTargets[index];
    if (!button || !record) return;
    window.clearTimeout(tooltipHideTimer);
    setTooltip(button, index, messageText(record));
    tooltipHideTimer = window.setTimeout(hideTooltip, 900);
  }

  function handleNavigationWheel(event) {
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    if (now - lastWheelStepAt < 130 || Math.abs(event.deltaY) < 2) return;
    lastWheelStepAt = now;
    const direction = event.deltaY > 0 ? 1 : -1;
    const base = selectedIndex >= 0 ? selectedIndex : activeIndex;
    setSelectedVisual(
      Math.max(0, Math.min(messageTargets.length - 1, base + direction)),
      true
    );
  }

  function setSelectedVisual(next, showPreview = false) {
    if (!messageTargets.length) return;
    selectedIndex = Math.max(0, Math.min(messageTargets.length - 1, next));
    [...list.children].forEach((button, index) => {
      button.dataset.selected = String(index === selectedIndex);
      if (index === selectedIndex) button.setAttribute("aria-selected", "true");
      else button.removeAttribute("aria-selected");
    });
    const selectedButton = list.children[selectedIndex];
    if (selectedButton) {
      const top = selectedButton.offsetTop;
      const bottom = top + selectedButton.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = Math.max(0, top - 8);
      else if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = bottom - list.clientHeight + 8;
      }
    }
    if (showPreview) previewSelection(selectedIndex);
  }

  function setActiveVisual(next) {
    activeIndex = next;
    [...list.children].forEach((button, index) => {
      button.dataset.active = String(index === next);
      if (index === next) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    const activeButton = list.children[next];
    if (activeButton) {
      const top = activeButton.offsetTop;
      const bottom = top + activeButton.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = Math.max(0, top - 8);
      else if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = bottom - list.clientHeight + 8;
      }
    }
  }

  function resolveRecordTarget(record) {
    if (record?.target?.isConnected) return record.target;
    if (!record?.key) return null;
    const escaped = window.CSS?.escape ? CSS.escape(record.key) : record.key.replace(/"/g, '\\"');
    const target = document.querySelector(`[data-content-search-unit-key="${escaped}"]`);
    if (target) record.target = target;
    return target;
  }

  function centerTarget(target) {
    target.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "nearest",
    });
    window.setTimeout(() => updateActive(true), 420);
  }

  function jumpTo(index) {
    const record = messageTargets[index];
    if (!record || !scrollContainer) return;
    cancelLatestRestore();
    hideTooltip();
    setSelectedVisual(index);
    setActiveVisual(index);
    const mounted = resolveRecordTarget(record);
    if (mounted) {
      centerTarget(mounted);
      return;
    }

    const maxScroll = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    const fromLatest = (messageTargets.length - 1 - index) /
      Math.max(1, messageTargets.length - 1);
    scrollContainer.scrollTo({ top: -maxScroll * fromLatest, behavior: "auto" });

    const deadline = performance.now() + 1800;
    const findTarget = () => {
      const target = resolveRecordTarget(record);
      if (target) {
        centerTarget(target);
        return;
      }
      if (performance.now() < deadline) window.setTimeout(findTarget, 60);
    };
    window.setTimeout(findTarget, 40);
  }

  function renderItems(nextBubbles) {
    messageTargets = nextBubbles;
    activeIndex = -1;
    selectedIndex = -1;
    list.replaceChildren();

    nextBubbles.forEach((record, index) => {
      const text = messageText(record);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cgpt-nav-item";
      button.dataset.index = String(index);
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-label", `跳转到第 ${index + 1} 条提问：${text}`);
      button.title = `第 ${index + 1} 条提问：${text}`;
      button.addEventListener("click", () => jumpTo(index));
      button.addEventListener("mouseenter", () => setTooltip(button, index, text));
      button.addEventListener("focus", () => setTooltip(button, index, text));
      button.addEventListener("mouseleave", hideTooltip);
      button.addEventListener("blur", hideTooltip);
      list.appendChild(button);
    });
  }

  function sameMessages(next) {
    return next.length === messageTargets.length &&
      next.every((record, index) => record.key === messageTargets[index]?.key &&
        record.text === messageTargets[index]?.text);
  }

  function isConversationReplacement(next) {
    if (!messageTargets.length || !next.length) return true;
    const currentKeys = new Set(messageTargets.map((record) => record.key));
    return !next.some((record) => currentKeys.has(record.key));
  }

  function cancelLatestRestore() {
    clearTimeout(restoreLatestTimer);
    clearInterval(restoreLatestInterval);
    restoreLatestTimer = 0;
    restoreLatestInterval = 0;
    pendingLatestRestore = false;
  }

  function guardLatestPosition() {
    if (document.visibilityState === "hidden") return false;
    const conversation = getConversation();
    const currentScroll = getScrollContainer(conversation);
    const currentTargets = conversation ? getMessageTargets(conversation) : [];
    if (!currentScroll || !currentTargets.length) return false;

    scrollContainer = currentScroll;
    setActiveVisual(currentTargets.length - 1);
    if (Math.abs(currentScroll.scrollTop) > 1) {
      currentScroll.scrollTo({ top: 0, behavior: "auto" });
    }
    return true;
  }

  function scheduleLatestRestore(delay = 140) {
    cancelLatestRestore();
    pendingLatestRestore = true;
    restoreLatestTimer = window.setTimeout(() => {
      const deadline = performance.now() + 15000;
      const tick = () => {
        guardLatestPosition();
        if (performance.now() < deadline || document.visibilityState === "hidden") return;
        clearInterval(restoreLatestInterval);
        restoreLatestInterval = 0;
        pendingLatestRestore = false;
        updateActive(true);
      };
      tick();
      restoreLatestInterval = window.setInterval(tick, 120);
    }, delay);
  }

  function positionRoot() {
    if (!root || root.hidden || !scrollContainer) return;
    const rect = scrollContainer.getBoundingClientRect();
    root.style.left = `${Math.max(8, rect.left + 16)}px`;
    root.style.top = `${Math.max(90, rect.top + rect.height / 2)}px`;
    root.style.transform = "translateY(-50%)";
  }

  function updateActive(force = false) {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (root?.hidden || !scrollContainer || !messageTargets.length ||
          document.visibilityState === "hidden" || pendingLatestRestore) return;
      const viewport = scrollContainer.getBoundingClientRect();
      if (viewport.height < 100 || viewport.width < 100) return;
      const guide = viewport.top + Math.min(viewport.height * 0.38, 360);
      let next = 0;
      let best = Number.POSITIVE_INFINITY;

      messageTargets.forEach((record, index) => {
        const target = resolveRecordTarget(record);
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const distance = Math.abs(rect.top - guide);
        if (distance < best) {
          best = distance;
          next = index;
        }
      });

      if (!force && next === activeIndex) return;
      setActiveVisual(next);
    });
  }

  function detachScroll() {
    scrollContainer?.removeEventListener("scroll", updateActive);
    scrollContainer?.removeEventListener("wheel", handleConversationUserIntent);
    scrollContainer?.removeEventListener("pointerdown", handleConversationUserIntent);
    scrollContainer?.removeEventListener("touchstart", handleConversationUserIntent);
    scrollContainer = null;
  }

  function handleConversationUserIntent() {
    if (pendingLatestRestore) cancelLatestRestore();
  }

  function refresh() {
    ensureRoot();
    if (!isChatGPTMode()) {
      root.hidden = true;
      hideTooltip();
      detachScroll();
      messageTargets = [];
      conversationKey = "";
      return;
    }

    if (document.visibilityState === "hidden") return;

    const conversation = getConversation();
    const nextScroll = getScrollContainer(conversation);
    const nextConversationKey = getConversationKey();
    const conversationKeyChanged = Boolean(
      nextConversationKey && conversationKey && nextConversationKey !== conversationKey
    );
    const conversationKeyInitialized = Boolean(nextConversationKey && !conversationKey);
    if (nextConversationKey) conversationKey = nextConversationKey;
    if (conversationKeyChanged || conversationKeyInitialized) scheduleLatestRestore();
    const nextBubbles = conversation
      ? getMessageTargets(conversation)
          .filter((record) => !record.target?.closest(`#${ROOT_ID}`))
      : [];

    if (!nextScroll || !nextBubbles.length) {
      root.hidden = true;
      return;
    }

    if (nextScroll !== scrollContainer) {
      detachScroll();
      scrollContainer = nextScroll;
      scrollContainer.addEventListener("scroll", updateActive, { passive: true });
      scrollContainer.addEventListener("wheel", handleConversationUserIntent, { passive: true });
      scrollContainer.addEventListener("pointerdown", handleConversationUserIntent, { passive: true });
      scrollContainer.addEventListener("touchstart", handleConversationUserIntent, { passive: true });
    }
    const messagesChanged = !sameMessages(nextBubbles);
    const conversationReplaced = conversationKeyChanged ||
      (messagesChanged && isConversationReplacement(nextBubbles));
    if (messagesChanged) {
      hideTooltip();
      renderItems(nextBubbles);
      setActiveVisual(nextBubbles.length - 1);
      setSelectedVisual(nextBubbles.length - 1);
      if (conversationReplaced) scheduleLatestRestore();
    }

    root.hidden = false;
    positionRoot();
    if (!pendingLatestRestore) updateActive(true);
  }

  function scheduleRefresh(delay = 120) {
    clearTimeout(updateTimer);
    updateTimer = window.setTimeout(refresh, delay);
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.every((mutation) => root?.contains(mutation.target))) return;
    scheduleRefresh();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const interval = window.setInterval(() => scheduleRefresh(0), 1200);
  window.addEventListener("resize", positionRoot);
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      if (pendingLatestRestore) scheduleLatestRestore(180);
      else scheduleRefresh(180);
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  function destroy() {
    clearTimeout(updateTimer);
    cancelLatestRestore();
    clearInterval(interval);
    cancelAnimationFrame(frame);
    observer.disconnect();
    detachScroll();
    window.removeEventListener("resize", positionRoot);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    root?.remove();
    style.remove();
    root = list = tooltip = null;
    messageTargets = [];
    delete window[INSTALL_KEY];
    delete window[API_KEY];
  }

  window[INSTALL_KEY] = VERSION;
  window[API_KEY] = { version: VERSION, refresh, destroy };
  refresh();
})();
