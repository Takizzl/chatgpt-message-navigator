(() => {
  "use strict";

  const INSTALL_KEY = "__chatgptMessageNavigatorInstalled";
  const API_KEY = "__chatgptMessageNavigator";
  const ROOT_ID = "chatgpt-message-navigator";
  const STYLE_ID = "chatgpt-message-navigator-style";
  const VERSION = "1.1.4";

  if (window[API_KEY]?.destroy) window[API_KEY].destroy();

  let root = null;
  let list = null;
  let tooltip = null;
  let panel = null;
  let panelList = null;
  let panelCount = null;
  let panelScrollbar = null;
  let panelThumb = null;
  let lastWheelStepAt = 0;
  let conversationKey = "";
  let scrollContainer = null;
  let messageTargets = [];
  let activeIndex = -1;
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
      align-items: center;
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
      cursor: pointer;
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
    #${ROOT_ID} .cgpt-nav-tooltip {
      position: absolute;
      left: 33px;
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
    #${ROOT_ID}:hover .cgpt-nav-tooltip,
    #${ROOT_ID}:focus-within .cgpt-nav-tooltip { opacity: 0 !important; }
    #${ROOT_ID} .cgpt-nav-panel {
      position: absolute;
      left: 32px;
      top: 50%;
      display: flex;
      width: min(390px, calc(100vw - 100px));
      max-height: min(82vh, 860px);
      flex-direction: column;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
      border-radius: 14px;
      background: color-mix(in srgb, var(--color-background-primary, #fff) 96%, transparent);
      box-shadow: 0 14px 38px rgba(0, 0, 0, .18);
      color: var(--color-text, #202123);
      opacity: 0;
      visibility: hidden;
      transform: translateY(-50%) translateX(-6px);
      transition: opacity 120ms ease, transform 120ms ease, visibility 120ms ease;
      pointer-events: auto;
    }
    #${ROOT_ID}:hover .cgpt-nav-panel,
    #${ROOT_ID}:focus-within .cgpt-nav-panel {
      opacity: 1;
      visibility: visible;
      transform: translateY(-50%) translateX(0);
    }
    #${ROOT_ID} .cgpt-nav-panel-header {
      display: flex;
      min-height: 42px;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 12px;
      border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      color: color-mix(in srgb, currentColor 68%, transparent);
      font-size: 12px;
      font-weight: 600;
    }
    #${ROOT_ID} .cgpt-nav-panel-hint {
      font-size: 11px;
      font-weight: 400;
      opacity: .72;
    }
    #${ROOT_ID} .cgpt-nav-panel-list {
      display: flex;
      max-height: calc(min(82vh, 860px) - 43px);
      flex-direction: column;
      gap: 2px;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 7px;
      scrollbar-width: none;
    }
    #${ROOT_ID} .cgpt-nav-panel-list::-webkit-scrollbar { display: none; }
    #${ROOT_ID} .cgpt-nav-panel-body {
      display: grid;
      min-height: 0;
      grid-template-columns: minmax(0, 1fr) 16px;
    }
    #${ROOT_ID} .cgpt-nav-scrollbar {
      position: relative;
      min-height: 48px;
      margin: 8px 4px 8px 0;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 8%, transparent);
      cursor: pointer;
      touch-action: none;
    }
    #${ROOT_ID} .cgpt-nav-scrollbar-thumb {
      position: absolute;
      top: 0;
      left: 3px;
      width: 7px;
      min-height: 28px;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 34%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 7%, transparent);
      cursor: grab;
      transition: background-color 100ms ease;
    }
    #${ROOT_ID} .cgpt-nav-scrollbar:hover .cgpt-nav-scrollbar-thumb,
    #${ROOT_ID} .cgpt-nav-scrollbar-thumb:active {
      background: color-mix(in srgb, currentColor 55%, transparent);
    }
    #${ROOT_ID} .cgpt-nav-scrollbar-thumb:active { cursor: grabbing; }
    }
    #${ROOT_ID} .cgpt-nav-panel-item {
      display: grid;
      width: 100%;
      min-height: 34px;
      grid-template-columns: 28px minmax(0, 1fr);
      align-items: center;
      gap: 4px;
      padding: 5px 9px 5px 5px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      text-align: left;
    }
    #${ROOT_ID} .cgpt-nav-panel-item:hover,
    #${ROOT_ID} .cgpt-nav-panel-item:focus-visible {
      background: color-mix(in srgb, currentColor 8%, transparent);
      outline: none;
    }
    #${ROOT_ID} .cgpt-nav-panel-item[data-active="true"] {
      background: color-mix(in srgb, currentColor 10%, transparent);
    }
    #${ROOT_ID} .cgpt-nav-panel-index {
      color: color-mix(in srgb, currentColor 46%, transparent);
      font-size: 10px;
      text-align: right;
    }
    #${ROOT_ID} .cgpt-nav-panel-text {
      min-width: 0;
      overflow: hidden;
      font-size: 12px;
      line-height: 1.4;
      text-overflow: ellipsis;
      white-space: nowrap;
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

    panel = document.createElement("section");
    panel.className = "cgpt-nav-panel";
    panel.setAttribute("aria-label", "全部历史提问");

    const panelHeader = document.createElement("div");
    panelHeader.className = "cgpt-nav-panel-header";
    panelCount = document.createElement("span");
    const panelHint = document.createElement("span");
    panelHint.className = "cgpt-nav-panel-hint";
    panelHint.textContent = "滚轮 / 拖动右侧滑块";
    panelHeader.append(panelCount, panelHint);

    panelList = document.createElement("div");
    panelList.className = "cgpt-nav-panel-list";
    panelList.setAttribute("role", "list");
    panelList.addEventListener("scroll", syncPanelScrollbar, { passive: true });
    panelList.addEventListener("wheel", handleNavigationWheel, { passive: false });
    list.addEventListener("wheel", handleNavigationWheel, { passive: false });

    const panelBody = document.createElement("div");
    panelBody.className = "cgpt-nav-panel-body";
    panelScrollbar = document.createElement("div");
    panelScrollbar.className = "cgpt-nav-scrollbar";
    panelScrollbar.setAttribute("role", "scrollbar");
    panelScrollbar.setAttribute("aria-label", "历史提问位置");
    panelScrollbar.setAttribute("aria-orientation", "vertical");
    panelThumb = document.createElement("div");
    panelThumb.className = "cgpt-nav-scrollbar-thumb";
    panelScrollbar.appendChild(panelThumb);
    panelScrollbar.addEventListener("pointerdown", startScrollbarDrag);
    panelBody.append(panelList, panelScrollbar);

    panel.append(panelHeader, panelBody);

    root.append(list, tooltip, panel);
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

  function getUserMessageTargets(conversation) {
    const keyedUnits = [...conversation.querySelectorAll("[data-content-search-unit-key]")]
      .filter((unit) => (unit.getAttribute("data-content-search-unit-key") || "").endsWith(":user"));
    if (keyedUnits.length) return keyedUnits;

    return [...conversation.querySelectorAll("h4")]
      .filter((heading) => /^(你说：?|You said:?)$/i.test((heading.textContent || "").trim()))
      .map((heading) => heading.nextElementSibling || heading);
  }

  function messageText(target) {
    const raw = (target.innerText || target.textContent || "")
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
    if (tooltip) tooltip.dataset.open = "false";
  }

  function handleNavigationWheel(event) {
    event.preventDefault();
    event.stopPropagation();
    const maxScroll = Math.max(0, panelList.scrollHeight - panelList.clientHeight);
    if (maxScroll > 1) {
      panelList.scrollTop += event.deltaY;
      syncPanelScrollbar();
      return;
    }

    const now = performance.now();
    if (now - lastWheelStepAt < 130 || Math.abs(event.deltaY) < 2) return;
    lastWheelStepAt = now;
    const direction = event.deltaY > 0 ? 1 : -1;
    jumpTo(Math.max(0, Math.min(messageTargets.length - 1, activeIndex + direction)));
  }

  function setScrollbarPosition(clientY, grabOffset) {
    if (!panelScrollbar || !panelThumb || !messageTargets.length) return;
    const trackRect = panelScrollbar.getBoundingClientRect();
    const thumbHeight = panelThumb.offsetHeight;
    const travel = Math.max(1, trackRect.height - thumbHeight);
    const ratio = Math.max(0, Math.min(1,
      (clientY - trackRect.top - grabOffset) / travel
    ));
    const maxScroll = Math.max(0, panelList.scrollHeight - panelList.clientHeight);
    if (maxScroll > 1) {
      panelList.scrollTop = ratio * maxScroll;
    } else {
      jumpTo(Math.round(ratio * Math.max(0, messageTargets.length - 1)));
    }
    syncPanelScrollbar();
  }

  function startScrollbarDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    const thumbRect = panelThumb.getBoundingClientRect();
    const grabOffset = event.target === panelThumb
      ? Math.max(0, Math.min(thumbRect.height, event.clientY - thumbRect.top))
      : thumbRect.height / 2;
    setScrollbarPosition(event.clientY, grabOffset);

    const move = (moveEvent) => {
      moveEvent.preventDefault();
      setScrollbarPosition(moveEvent.clientY, grabOffset);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }

  function syncPanelScrollbar() {
    if (!panelScrollbar || !panelThumb || !panelList) return;
    const trackHeight = panelScrollbar.clientHeight;
    if (!trackHeight) return;
    const maxScroll = Math.max(0, panelList.scrollHeight - panelList.clientHeight);
    const hasOverflow = maxScroll > 1;
    const thumbHeight = hasOverflow
      ? Math.max(28, trackHeight * panelList.clientHeight / panelList.scrollHeight)
      : Math.max(28, Math.min(48, trackHeight * 0.28));
    const travel = Math.max(0, trackHeight - thumbHeight);
    const ratio = hasOverflow
      ? panelList.scrollTop / maxScroll
      : activeIndex / Math.max(1, messageTargets.length - 1);
    panelThumb.style.height = `${thumbHeight}px`;
    panelThumb.style.transform = `translateY(${Math.max(0, Math.min(travel, ratio * travel))}px)`;
    panelScrollbar.setAttribute("aria-valuemin", "1");
    panelScrollbar.setAttribute("aria-valuemax", String(Math.max(1, messageTargets.length)));
    panelScrollbar.setAttribute("aria-valuenow", String(Math.max(1, activeIndex + 1)));
  }

  function setActiveVisual(next) {
    activeIndex = next;
    [...list.children].forEach((button, index) => {
      button.dataset.active = String(index === next);
      if (index === next) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    [...panelList.children].forEach((button, index) => {
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
    const activePanelButton = panelList.children[next];
    if (activePanelButton) {
      const top = activePanelButton.offsetTop;
      const bottom = top + activePanelButton.offsetHeight;
      if (top < panelList.scrollTop) panelList.scrollTop = Math.max(0, top - 7);
      else if (bottom > panelList.scrollTop + panelList.clientHeight) {
        panelList.scrollTop = bottom - panelList.clientHeight + 7;
      }
    }
    syncPanelScrollbar();
  }

  function jumpTo(index) {
    const target = messageTargets[index];
    if (!target?.isConnected) return;
    cancelLatestRestore();
    setActiveVisual(index);
    target.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "nearest",
    });
    window.setTimeout(() => updateActive(true), 420);
  }

  function renderItems(nextBubbles) {
    messageTargets = nextBubbles;
    activeIndex = -1;
    list.replaceChildren();
    panelList.replaceChildren();
    panelCount.textContent = `全部提问 · ${nextBubbles.length}`;

    nextBubbles.forEach((bubble, index) => {
      const text = messageText(bubble);
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

      const panelButton = document.createElement("button");
      panelButton.type = "button";
      panelButton.className = "cgpt-nav-panel-item";
      panelButton.dataset.index = String(index);
      panelButton.setAttribute("role", "listitem");
      panelButton.setAttribute("aria-label", `跳转到第 ${index + 1} 条提问：${text}`);
      const number = document.createElement("span");
      number.className = "cgpt-nav-panel-index";
      number.textContent = String(index + 1);
      const label = document.createElement("span");
      label.className = "cgpt-nav-panel-text";
      label.textContent = text;
      panelButton.append(number, label);
      panelButton.addEventListener("click", () => jumpTo(index));
      panelList.appendChild(panelButton);
    });
    requestAnimationFrame(syncPanelScrollbar);
  }

  function sameMessages(next) {
    return next.length === messageTargets.length &&
      next.every((element, index) => element === messageTargets[index]);
  }

  function isConversationReplacement(next) {
    if (!messageTargets.length || !next.length) return true;
    return !next.some((element) => messageTargets.includes(element));
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
    const currentTargets = conversation ? getUserMessageTargets(conversation) : [];
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

      messageTargets.forEach((target, index) => {
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
      ? getUserMessageTargets(conversation)
          .filter((target) => !target.closest(`#${ROOT_ID}`))
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
      renderItems(nextBubbles);
      setActiveVisual(nextBubbles.length - 1);
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
    root = list = tooltip = panel = panelList = panelCount = panelScrollbar = panelThumb = null;
    messageTargets = [];
    delete window[INSTALL_KEY];
    delete window[API_KEY];
  }

  window[INSTALL_KEY] = VERSION;
  window[API_KEY] = { version: VERSION, refresh, destroy };
  refresh();
})();
