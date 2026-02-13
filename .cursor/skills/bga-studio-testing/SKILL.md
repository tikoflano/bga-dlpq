---
name: bga-studio-testing
description: Uses Chrome DevTools MCP (NOT cursor-ide-browser) to open Chrome, navigate to BGA Studio, and launch or test a board game. Use chrome-devtools-navigate_page, chrome-devtools-take_snapshot, chrome-devtools-click, chrome-devtools-evaluate_script. Do NOT use browser_* tools or xdg-open. Use when the user wants to test the game in BGA Studio, run the game in a browser, verify UI changes, or launch a new game session.
---

# BGA Studio Testing

Guides the agent to test BGA Studio games using the **Chrome DevTools MCP** (server name: `chrome-devtools`, configured in `.cursor/mcp.json`). Opens the game in Chrome, launches new games, and supports save/restore workflows.

## Required: Use Chrome DevTools MCP (NOT cursor-ide-browser)

**Use ONLY the `chrome-devtools` MCP server.** Do NOT use cursor-ide-browser MCP — that opens an internal/embedded browser. This skill requires Chrome DevTools MCP, which controls a real Chrome browser.

All tool names are prefixed with `chrome-devtools-` (matching the server name in `.cursor/mcp.json`):

- **Navigation:** `chrome-devtools-navigate_page`, `chrome-devtools-list_pages`, `chrome-devtools-select_page`, `chrome-devtools-new_page`, `chrome-devtools-close_page`, `chrome-devtools-wait_for`
- **Input:** `chrome-devtools-click`, `chrome-devtools-fill`, `chrome-devtools-fill_form`, `chrome-devtools-hover`, `chrome-devtools-press_key`, `chrome-devtools-drag`
- **Debugging:** `chrome-devtools-evaluate_script`, `chrome-devtools-take_snapshot`, `chrome-devtools-take_screenshot`, `chrome-devtools-list_console_messages`, `chrome-devtools-get_console_message`
- **Dialogs:** `chrome-devtools-handle_dialog`

**Do NOT use:** `cursor-ide-browser-browser_navigate`, `cursor-ide-browser-browser_snapshot`, `cursor-ide-browser-browser_click`, or any `cursor-ide-browser-*` tool.
**Do NOT use:** `xdg-open`, `open`, or terminal commands to open URLs.

## Prerequisites

- **Chrome DevTools MCP server** must be enabled in Cursor (configured in `.cursor/mcp.json`)
- User must be logged into BGA Studio (https://studio.boardgamearena.com)
- Game project name: **DondeLasPapasQueman** (from this repo)

## Workflow: Launch New Game

### 1. Navigate to Game Panel

1. Use `chrome-devtools-list_pages` to check for existing pages; use `chrome-devtools-select_page` if needed
2. Use `chrome-devtools-navigate_page` with `url: "https://studio.boardgamearena.com/gamepanel?game=dondelaspapasqueman"`
3. Use `chrome-devtools-wait_for` with text like "Express start" or "Realtime" to ensure the page has loaded

### 2. Launch a New Game

The game panel URL already shows the correct page. From there:

1. Call `chrome-devtools-take_snapshot` to get page structure and element `uid`s
2. Find the **player number** dropdown and select the number of players:
   - Default: **2** players
   - If the user specified a number in their request (e.g. "test with 3 players"), use that instead
   - Use `chrome-devtools-fill` with the dropdown's `uid` and the desired value (e.g. `"2"`)
3. Click **Express start** using `chrome-devtools-evaluate_script`:
   ```javascript
   () => {
     const el = document.querySelector(".bga-split-button--diagonal [slot='labelRight']");
     if (el) el.click();
   }
   ```
   This selector is verified to work. Do not use snapshot + click — the element may not appear in the a11y tree.

### 3. After Launch

- Call `chrome-devtools-take_snapshot` to confirm the game loaded
- If CSS/SCSS was changed: find and click **Reload CSS** in the debug panel (left side) using `chrome-devtools-take_snapshot` to get its `uid`, then `chrome-devtools-click`

## Build Before Testing

If TypeScript or SCSS was modified, run `npm run build` before testing. The game loads compiled `Game.js` and `dondelaspapasqueman.css` from the server.

## Save & Restore (Future Extension)

BGA Studio provides 3 save slots at the bottom of the game area. See [reference.md](reference.md) for save/restore workflow details to implement in a future skill extension.

## Key URLs

| Purpose | URL |
|---------|-----|
| Game panel (start new game) | `https://studio.boardgamearena.com/gamepanel?game=dondelaspapasqueman` |
| Stop hanging game | `https://studio.boardgamearena.com/#!table?table=TABLE_ID` |

## Notes

- Use `chrome-devtools-take_snapshot` to get element `uid`s before `chrome-devtools-click` or `chrome-devtools-fill` (except Express start, which uses `chrome-devtools-evaluate_script`)
- Native dialogs: use `chrome-devtools-handle_dialog` with action "accept" or "dismiss"
- Chrome DevTools MCP starts Chrome automatically when a tool is first used
- The MCP server is configured in `.cursor/mcp.json` under the key `chrome-devtools`
