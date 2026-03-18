(() => {
  const win = window;

  const attachInspector = () => {
    if (!document.documentElement) {
      return false;
    }

    const existing = win.__codexInspectorCleanup;
    if (typeof existing === 'function') {
      existing();
    }

    const overlay = document.createElement('div');
    overlay.id = '__codex-hover-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      pointerEvents: 'none',
      border: '2px solid #ff4d4f',
      background: 'rgba(255, 77, 79, 0.08)',
      boxSizing: 'border-box',
      zIndex: '2147483646',
      display: 'none',
      transition: 'border-color 80ms ease, background-color 80ms ease',
    });

    const label = document.createElement('div');
    label.id = '__codex-hover-label';
    Object.assign(label.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      pointerEvents: 'none',
      padding: '4px 6px',
      borderRadius: '4px',
      background: '#111',
      color: '#fff',
      font: '12px/1.2 monospace',
      zIndex: '2147483647',
      display: 'none',
      maxWidth: '50vw',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    });

    const feedbackPanel = document.createElement('div');
    feedbackPanel.id = '__codex-feedback-panel';
    Object.assign(feedbackPanel.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      width: '320px',
      maxWidth: 'calc(100vw - 32px)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(17,17,17,0.12)',
      background: 'rgba(255,255,255,0.96)',
      color: '#111',
      font: '12px/1.4 system-ui, sans-serif',
      zIndex: '2147483647',
      display: 'none',
      boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
      backdropFilter: 'blur(8px)',
    });

    const feedbackHeader = document.createElement('div');
    Object.assign(feedbackHeader.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      marginBottom: '8px',
    });

    const feedbackTitle = document.createElement('div');
    feedbackTitle.textContent = 'Send feedback';
    Object.assign(feedbackTitle.style, {
      fontWeight: '600',
      fontSize: '13px',
    });

    const feedbackClose = document.createElement('button');
    feedbackClose.type = 'button';
    feedbackClose.textContent = 'Close';
    Object.assign(feedbackClose.style, {
      border: 'none',
      background: 'transparent',
      color: '#555',
      cursor: 'pointer',
      padding: '0',
      font: 'inherit',
    });

    const feedbackSelection = document.createElement('div');
    Object.assign(feedbackSelection.style, {
      marginBottom: '8px',
      padding: '8px',
      borderRadius: '8px',
      background: 'rgba(0,0,0,0.04)',
      color: '#333',
      font: '12px/1.35 monospace',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });

    const feedbackTextarea = document.createElement('textarea');
    feedbackTextarea.placeholder = 'Describe the issue or change you want here...';
    Object.assign(feedbackTextarea.style, {
      width: '100%',
      minHeight: '96px',
      resize: 'vertical',
      borderRadius: '8px',
      border: '1px solid rgba(17,17,17,0.16)',
      padding: '8px 10px',
      boxSizing: 'border-box',
      font: '13px/1.45 system-ui, sans-serif',
      color: '#111',
      background: '#fff',
    });

    const feedbackFooter = document.createElement('div');
    Object.assign(feedbackFooter.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      marginTop: '8px',
    });

    const feedbackStatus = document.createElement('div');
    Object.assign(feedbackStatus.style, {
      color: '#666',
      minHeight: '18px',
      flex: '1 1 auto',
    });

    const feedbackSubmit = document.createElement('button');
    feedbackSubmit.type = 'button';
    feedbackSubmit.textContent = 'Submit';
    Object.assign(feedbackSubmit.style, {
      border: 'none',
      borderRadius: '8px',
      background: '#111',
      color: '#fff',
      cursor: 'pointer',
      padding: '8px 12px',
      font: '600 12px/1.2 system-ui, sans-serif',
    });

    const feedbackNotice = document.createElement('div');
    feedbackNotice.id = '__codex-feedback-notice';
    Object.assign(feedbackNotice.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      width: '320px',
      maxWidth: 'calc(100vw - 32px)',
      padding: '12px',
      borderRadius: '10px',
      border: '1px solid rgba(17,17,17,0.12)',
      background: 'rgba(17,17,17,0.96)',
      color: '#fff',
      font: '13px/1.45 system-ui, sans-serif',
      zIndex: '2147483647',
      display: 'none',
      boxShadow: '0 10px 30px rgba(0,0,0,0.24)',
      cursor: 'pointer',
    });

    const feedbackNoticeText = document.createElement('div');

    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(label);
    feedbackHeader.appendChild(feedbackTitle);
    feedbackHeader.appendChild(feedbackClose);
    feedbackFooter.appendChild(feedbackStatus);
    feedbackFooter.appendChild(feedbackSubmit);
    feedbackPanel.appendChild(feedbackHeader);
    feedbackPanel.appendChild(feedbackSelection);
    feedbackPanel.appendChild(feedbackTextarea);
    feedbackPanel.appendChild(feedbackFooter);
    document.documentElement.appendChild(feedbackPanel);
    feedbackNotice.appendChild(feedbackNoticeText);
    document.documentElement.appendChild(feedbackNotice);
    win.__codexFeedbackSubmitSeq = typeof win.__codexFeedbackSubmitSeq === 'number' ? win.__codexFeedbackSubmitSeq : 0;
    win.__codexFeedbackSubmissions = Array.isArray(win.__codexFeedbackSubmissions) ? win.__codexFeedbackSubmissions : [];
    let lastHref = location.href;
    let feedbackNoticeTimer = null;

    const setOverlayIdle = () => {
      overlay.style.borderColor = '#ff4d4f';
      overlay.style.background = 'rgba(255, 77, 79, 0.08)';
    };

    const setOverlayActive = () => {
      overlay.style.borderColor = '#52c41a';
      overlay.style.background = 'rgba(82, 196, 26, 0.12)';
    };

    const hideInspector = () => {
      overlay.style.display = 'none';
      label.style.display = 'none';
      setOverlayIdle();
    };

    const hideFeedbackPanel = () => {
      feedbackPanel.style.display = 'none';
      feedbackStatus.textContent = '';
    };

    const showFeedbackPanel = () => {
      hideFeedbackNotice();
      feedbackPanel.style.display = 'block';
      window.requestAnimationFrame(() => {
        feedbackTextarea.focus();
      });
    };

    const hideFeedbackNotice = () => {
      if (feedbackNoticeTimer !== null) {
        window.clearTimeout(feedbackNoticeTimer);
        feedbackNoticeTimer = null;
      }
      feedbackNotice.style.display = 'none';
    };

    const showFeedbackNotice = (message) => {
      hideFeedbackNotice();
      feedbackNoticeText.textContent = message;
      feedbackNotice.style.display = 'block';
      feedbackNoticeTimer = window.setTimeout(() => {
        feedbackNoticeTimer = null;
        feedbackNotice.style.display = 'none';
      }, 5000);
    };

    const clearPinnedSelection = () => {
      win.__codexPinnedAltElement = null;
      win.__codexPinnedAltClick = null;
      win.__codexLastAltClick = null;
      feedbackSelection.textContent = 'No element selected yet.';
      feedbackTextarea.value = '';
      hideFeedbackPanel();
      hideFeedbackNotice();
      hideInspector();
    };

    const isInspectorUi = (target) =>
      target instanceof Element &&
      (target === overlay || target === label || target === feedbackPanel || feedbackPanel.contains(target));

    const describe = (el) => {
      if (!(el instanceof Element)) {
        return 'unknown';
      }
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes = Array.from(el.classList || [])
        .slice(0, 3)
        .map((className) => `.${className}`)
        .join('');
      const role = el.getAttribute('role');
      return [tag + id + classes, role ? `[role=${role}]` : ''].filter(Boolean).join(' ');
    };

    const getDetails = (el) => {
      if (!(el instanceof Element)) {
        return null;
      }
      const rect = el.getBoundingClientRect();
      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: Array.from(el.classList || []),
        role: el.getAttribute('role'),
        name: el.getAttribute('aria-label') || el.getAttribute('name') || null,
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 300),
        href: 'href' in el ? el.getAttribute('href') : null,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        selectorHint: describe(el),
      };
    };

    const showInspectorFor = (el, active = false) => {
      if (!(el instanceof Element)) {
        hideInspector();
        return;
      }
      const rect = el.getBoundingClientRect();
      overlay.style.display = 'block';
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      if (active) {
        setOverlayActive();
      } else {
        setOverlayIdle();
      }

      label.textContent = describe(el);
      label.style.display = 'block';
      const labelTop = Math.max(4, rect.top - 28);
      const labelLeft = Math.min(window.innerWidth - 260, Math.max(4, rect.left));
      label.style.top = `${labelTop}px`;
      label.style.left = `${labelLeft}px`;
    };

    const updateFeedbackSelection = (details) => {
      feedbackSelection.textContent = details?.selectorHint || 'No element selected yet.';
    };

    const restorePinnedSelection = () => {
      const pinnedEl = win.__codexPinnedAltElement;
      if (!(pinnedEl instanceof Element) || !document.contains(pinnedEl)) {
        win.__codexPinnedAltElement = null;
        win.__codexPinnedAltClick = null;
        feedbackSelection.textContent = 'No element selected yet.';
        hideFeedbackPanel();
        hideInspector();
        return;
      }
      showInspectorFor(pinnedEl, true);
    };

    const refreshPinnedSelection = () => {
      if (win.__codexAltPressed) {
        return;
      }
      restorePinnedSelection();
    };

    const handleLocationMaybeChanged = () => {
      if (location.href === lastHref) {
        return;
      }
      lastHref = location.href;
      clearPinnedSelection();
      win.__codexFeedbackSubmissions = [];
      delete win.__codexLastFeedbackSubmission;
    };

    const wrapHistoryMethod = (methodName) => {
      const original = history[methodName];
      const wrapped = function (...args) {
        const result = original.apply(this, args);
        window.setTimeout(handleLocationMaybeChanged, 0);
        return result;
      };
      history[methodName] = wrapped;
      return () => {
        history[methodName] = original;
      };
    };

    const restorePushState = wrapHistoryMethod('pushState');
    const restoreReplaceState = wrapHistoryMethod('replaceState');

    const mouseTrack = (event) => {
      win.__codexLastMouseX = event.clientX;
      win.__codexLastMouseY = event.clientY;
    };

    const move = (event) => {
      if (!event.altKey) {
        restorePinnedSelection();
        return;
      }
      const el = event.target instanceof Element ? event.target : null;
      if (!el || isInspectorUi(el)) {
        return;
      }
      showInspectorFor(el, event.buttons === 1);
    };

    const keyDown = (event) => {
      if (event.key !== 'Alt') {
        return;
      }
      win.__codexAltPressed = true;
      const el = document.elementFromPoint(win.__codexLastMouseX ?? 0, win.__codexLastMouseY ?? 0);
      if (el instanceof Element) {
        showInspectorFor(el, false);
      }
    };

    const keyUp = (event) => {
      if (event.key === 'Alt') {
        win.__codexAltPressed = false;
        restorePinnedSelection();
      }
    };

    const leave = () => {
      restorePinnedSelection();
    };

    const mouseDown = (event) => {
      if (!event.altKey) {
        return;
      }
      const el = event.target instanceof Element ? event.target : null;
      if (el && !isInspectorUi(el)) {
        showInspectorFor(el, true);
      }
    };

    const mouseUp = (event) => {
      if (!event.altKey) {
        restorePinnedSelection();
        return;
      }
      const el = event.target instanceof Element ? event.target : null;
      if (el && !isInspectorUi(el)) {
        showInspectorFor(el, false);
      }
    };

    const click = (event) => {
      if (!event.altKey) {
        return;
      }
      const el = event.target instanceof Element ? event.target : null;
      if (!el || isInspectorUi(el)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const details = getDetails(el);
      win.__codexLastAltClick = details;
      win.__codexPinnedAltClick = details;
      win.__codexPinnedAltElement = el;
      feedbackTextarea.value = '';
      feedbackStatus.textContent = '';
      updateFeedbackSelection(details);
      showFeedbackPanel();
      console.log('__CODEX_ALT_CLICK__ ' + JSON.stringify(details));
      showInspectorFor(el, true);
    };

    const submitFeedback = () => {
      const feedback = feedbackTextarea.value.trim();
      const element = win.__codexPinnedAltClick || win.__codexLastAltClick || null;
      if (!element) {
        feedbackStatus.textContent = 'Select an element first.';
        return;
      }
      if (!feedback) {
        feedbackStatus.textContent = 'Enter feedback before submitting.';
        return;
      }

      const payload = {
        submissionId: ++win.__codexFeedbackSubmitSeq,
        href: location.href,
        submittedAt: new Date().toISOString(),
        feedback,
        element,
      };
      win.__codexLastFeedbackSubmission = payload;
      win.__codexFeedbackSubmissions = [...win.__codexFeedbackSubmissions, payload].slice(-20);
      console.log('__CODEX_FEEDBACK_SUBMIT__ ' + JSON.stringify(payload));
      hideFeedbackPanel();
      showFeedbackNotice('Feedback submitted. Type "check feedback" in Codex.');
    };

    const handleFeedbackTextareaKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        submitFeedback();
      }
    };

    document.addEventListener('mousemove', mouseTrack, true);
    document.addEventListener('mousemove', move, true);
    document.addEventListener('mouseleave', leave, true);
    document.addEventListener('keydown', keyDown, true);
    document.addEventListener('keyup', keyUp, true);
    document.addEventListener('mousedown', mouseDown, true);
    document.addEventListener('mouseup', mouseUp, true);
    document.addEventListener('click', click, true);
    document.addEventListener('scroll', refreshPinnedSelection, true);
    window.addEventListener('resize', refreshPinnedSelection, true);
    window.addEventListener('popstate', handleLocationMaybeChanged, true);
    window.addEventListener('hashchange', handleLocationMaybeChanged, true);
    feedbackClose.addEventListener('click', hideFeedbackPanel, true);
    feedbackNotice.addEventListener('click', hideFeedbackNotice, true);
    feedbackSubmit.addEventListener('click', submitFeedback, true);
    feedbackTextarea.addEventListener('keydown', handleFeedbackTextareaKeyDown, true);
    feedbackSelection.textContent = 'No element selected yet.';

    win.__codexInspectorCleanup = () => {
      document.removeEventListener('mousemove', mouseTrack, true);
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseleave', leave, true);
      document.removeEventListener('keydown', keyDown, true);
      document.removeEventListener('keyup', keyUp, true);
      document.removeEventListener('mousedown', mouseDown, true);
      document.removeEventListener('mouseup', mouseUp, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('scroll', refreshPinnedSelection, true);
      window.removeEventListener('resize', refreshPinnedSelection, true);
      window.removeEventListener('popstate', handleLocationMaybeChanged, true);
      window.removeEventListener('hashchange', handleLocationMaybeChanged, true);
      feedbackClose.removeEventListener('click', hideFeedbackPanel, true);
      feedbackNotice.removeEventListener('click', hideFeedbackNotice, true);
      feedbackSubmit.removeEventListener('click', submitFeedback, true);
      feedbackTextarea.removeEventListener('keydown', handleFeedbackTextareaKeyDown, true);
      restorePushState();
      restoreReplaceState();
      overlay.remove();
      label.remove();
      feedbackPanel.remove();
      feedbackNotice.remove();
      delete win.__codexAltPressed;
      delete win.__codexPinnedAltElement;
      delete win.__codexPinnedAltClick;
      delete win.__codexFeedbackSubmitSeq;
      delete win.__codexFeedbackSubmissions;
      delete win.__codexLastFeedbackSubmission;
      delete win.__codexInspectorCleanup;
    };

    return true;
  };

  if (!attachInspector()) {
    const onReady = () => {
      if (attachInspector()) {
        document.removeEventListener('DOMContentLoaded', onReady, true);
        window.removeEventListener('load', onReady, true);
      }
    };
    document.addEventListener('DOMContentLoaded', onReady, true);
    window.addEventListener('load', onReady, true);
  }
})();
