(() => {
  "use strict";

  const INSTALL_KEY = "__chatgptMessageNavigatorInstalled";
  const API_KEY = "__chatgptMessageNavigator";
  const ROOT_ID = "chatgpt-message-navigator";
  const STYLE_ID = "chatgpt-message-navigator-style";
  const VERSION = "1.0.0";

  if (window[API_KEY]?.destroy) window[API_KEY].destroy();

  let root = null;
  let list = null;
  let tooltip = null;
  let scrollContainer = null;
  let messageTargets = [];
  let activeIndex = -1;
  let updateTimer = 0;
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

    root.append(list, tooltip);
    document.body.appendChild(root);
  }

  function getConversation() {
    return document.querySelector('[data-thread-find-target="conversation"]');
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

  function jumpTo(index) {
    const target = messageTargets[index];
    if (!target?.isConnected) return;
    target.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "nearest",
    });
    window.setTimeout(() => updateActive(true), 180);
  }

  function renderItems(nextBubbles) {
    messageTargets = nextBubbles;
    activeIndex = -1;
    list.replaceChildren();

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
    });
  }

  function sameMessages(next) {
    return next.length === messageTargets.length &&
      next.every((element, index) => element === messageTargets[index]);
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
      if (root?.hidden || !scrollContainer || !messageTargets.length) return;
      const viewport = scrollContainer.getBoundingClientRect();
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
    });
  }

  function detachScroll() {
    scrollContainer?.removeEventListener("scroll", updateActive);
    scrollContainer = null;
  }

  function refresh() {
    ensureRoot();
    if (!isChatGPTMode()) {
      root.hidden = true;
      hideTooltip();
      detachScroll();
      messageTargets = [];
      return;
    }

    const conversation = getConversation();
    const nextScroll = getScrollContainer(conversation);
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
    }
    if (!sameMessages(nextBubbles)) renderItems(nextBubbles);

    root.hidden = false;
    positionRoot();
    updateActive(true);
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

  function destroy() {
    clearTimeout(updateTimer);
    clearInterval(interval);
    cancelAnimationFrame(frame);
    observer.disconnect();
    detachScroll();
    window.removeEventListener("resize", positionRoot);
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
