---
name: visual-debug-with-playwright
description: Open a URL in Playwright MCP and attach a temporary durable inspector overlay for visual UI debugging. Use when the user wants to point at live elements in a browser, identify clicked DOM nodes, or keep an Alt-hover/Alt-click inspector working across navigations without changing app code.
---

# Visual Debug With Playwright

Open the requested page in Playwright MCP, install the durable inspector, and use `Alt`-hover plus `Alt`-click to identify elements visually. The inspector can also open a floating feedback panel in the page so the user can submit requested UI changes directly from the browser.

## Quick Start

1. Derive the absolute path to `scripts/install_durable_inspector.browser.js` from the installed skill location.
2. Open the target URL with `functions.mcp__playwright__browser_navigate`.
3. As soon as `browser_navigate` returns, immediately call `functions.mcp__playwright__browser_run_code` with a tiny loader that uses Playwright's `path` option to load `scripts/install_durable_inspector.browser.js`. Do not insert commentary, snapshots, health checks, or extra reads between those two tool calls.

Use this exact loader template, replacing `ABSOLUTE_PATH_TO_INSTALLER` with the resolved skill-local path:

```js
async (page) => {
  const inspectorPath = 'ABSOLUTE_PATH_TO_INSTALLER';
  await page.context().addInitScript({ path: inspectorPath });
  await page.addScriptTag({ path: inspectorPath });
  return {
    installed: true,
    inspectorPath,
    href: page.url(),
  };
}
```

Example:

```js
async (page) => {
  const inspectorPath = '/Users/example/.codex/skills/visual-debug-with-playwright/scripts/install_durable_inspector.browser.js';
  await page.context().addInitScript({ path: inspectorPath });
  await page.addScriptTag({ path: inspectorPath });
  return {
    installed: true,
    inspectorPath,
    href: page.url(),
  };
}
```

4. Tell the user:
   - Hold `Alt` to show the hover box and label.
   - Hold `Alt` and press the mouse to turn the box green.
   - Hold `Alt` and click to pin the selected element and open the feedback panel. Focus should land in the feedback input automatically.
   - Type feedback in the panel and press `Submit`, or use `Cmd/Ctrl+Enter`.
   - After submit, the panel closes and the browser shows a popup telling them to ask Codex to check the feedback.
5. After the user clicks, read the result with `functions.mcp__playwright__browser_evaluate` using:

```js
() => window.__codexLastAltClick || null
```

6. After the user submits browser feedback, read it with either:

```js
() => window.__codexLastFeedbackSubmission || null
```

or fetch the recent queue with:

```js
() => window.__codexFeedbackSubmissions || []
```

You can also fetch recent console messages and look for the `__CODEX_FEEDBACK_SUBMIT__` marker.
7. Wait for the user to ask Codex to check the submitted feedback before acting on it. Exact phrasing does not matter; requests like `check feedback`, `check my feedback`, or similar wording should all count. Once they ask, immediately make the requested change if the intent is clear. Only ask a follow-up question when the feedback is ambiguous, incomplete, or risky to apply without clarification.

## Workflow

### Open and install

- Navigate first, then inject the durable inspector immediately.
- Treat `browser_navigate` -> `browser_run_code` as an atomic pair once the installer path is already known.
- Use the browser installer script instead of rewriting the overlay logic from scratch.
- If the agent needs exact syntax, copy the loader template from `Quick Start` rather than inventing a new wrapper.
- Do not pause between `browser_navigate` and `browser_run_code` for commentary, snapshots, screenshots, health checks, route inspection, or any other exploratory step.
- Load the installer through Playwright's `path` option instead of inlining the installer contents into `browser_run_code`.
- Do not wait for auth redirects, app hydration, or a "final" route before injecting. The installer already handles DOM-ready bootstrap and can survive normal client-side navigation.
- Reuse the same Playwright MCP tab when possible.

### Fast path

When the user asks to start visual debugging, prefer this order:

1. Start the local server if needed.
2. Resolve the absolute path to `scripts/install_durable_inspector.browser.js`.
3. Open the page in Playwright.
4. Inject the installer immediately after navigation completes with a tiny `browser_run_code` loader that uses `page.context().addInitScript({ path })` and `page.addScriptTag({ path })`.
5. Only after injection, do any snapshot, screenshot, health check, or extra inspection.

If the page is already open in Playwright, skip directly to the resolved path and immediate injection.

### Timing rule

- Minimize wall-clock time between having the installer path available and calling `functions.mcp__playwright__browser_run_code`.
- Do not stop to summarize what loaded, inspect the DOM, or confirm the route before injection. Those checks belong after the inspector is live.
- Avoid copying the full installer body through the model when Playwright can load it directly from disk by path.

### Read the selected element

- Prefer `functions.mcp__playwright__browser_evaluate` with `() => window.__codexLastAltClick || null`.
- Use `functions.mcp__playwright__browser_console_messages` only if you need the raw console log for confirmation.
- Report the element's tag, text, role, classes, selector hint, and bounds in a compact format.

### Read submitted feedback

- When the user asks to check the feedback, read the latest submission and treat that as the handoff to begin work.
- If the requested UI change is clear, proceed to implement it immediately instead of asking for confirmation.
- Ask a follow-up question only when the requested change is ambiguous, conflicts with existing constraints, or has meaningful product risk the user has not resolved.
- Prefer `functions.mcp__playwright__browser_evaluate` with `() => window.__codexLastFeedbackSubmission || null`.
- To inspect the recent browser-side queue, use `() => window.__codexFeedbackSubmissions || []`.
- If you want an append-only signal, fetch console messages and look for `__CODEX_FEEDBACK_SUBMIT__`.
- Treat the stored payload as the source of truth for the element, feedback text, page URL, submission time, and `submissionId`.

### Health check after navigation

If the user says the inspector stopped working, verify whether it is still attached:

```js
() => ({
  href: location.href,
  hasCleanup: typeof window.__codexInspectorCleanup === 'function',
  overlay: !!document.getElementById('__codex-hover-overlay'),
  readyState: document.readyState,
})
```

- If `hasCleanup` is false or `overlay` is false, run the installer again.
- The installer already uses a DOM-ready bootstrap, so reinjection is usually enough after a hard reload or context reset.
- The feedback panel is also session-only and should reappear after reinjection.

## Guardrails

- Keep this session-only. Do not modify the app code unless the user explicitly asks for a permanent implementation.
- Explain that the inspector lives only in the current Playwright browser session.
- Reinstall the inspector after opening a fresh tab, fresh context, or new Playwright session.
- Do not rely on this skill for external inspector windows launched outside MCP; use it for the MCP Playwright browser session.

## Resources

- Browser installer: `scripts/install_durable_inspector.browser.js`
