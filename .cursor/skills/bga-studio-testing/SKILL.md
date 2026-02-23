---
name: bga-studio-testing
description: Uses Chrome DevTools MCP (NOT cursor-ide-browser) to open Chrome, navigate to BGA Studio, launch games, open each player's view in a separate tab, read game state from status bar/gamedatas, switch to the active player's tab to perform actions, and save/restore game state for iterative debugging of card resolution and action handling. Use chrome-devtools-navigate_page, take_snapshot, click, evaluate_script, new_page, select_page. Do NOT use browser_* tools or xdg-open. Use when testing BGA Studio games, verifying UI, debugging card effects, or running multi-player test flows.
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

### 4. Open Each Player's View in a Separate Tab

After the game loads, open one tab per player so you can switch to the active player's view when testing:

1. Get the current table URL with `chrome-devtools-evaluate_script`:
   ```javascript
   () => window.location.href
   ```
2. Get player IDs from the game: use `chrome-devtools-evaluate_script` with `() => (typeof game !== 'undefined' ? game : window.game)?.gamedatas?.playerorder || []` to get the list (e.g. `[12345, 12346]`).
3. For each player ID, open a new tab with `chrome-devtools-new_page`:
   - URL: append `&testuser=` + player ID to the current URL (e.g. `...&testuser=12345`)
   - For hash URLs like `#!table?table=12345`, append inside the hash: `#!table?table=12345&testuser=12345`
   - BGA Studio uses `testuser` to view the table as that player ([docs](https://en.doc.boardgamearena.com/Tools_and_tips_of_BGA_Studio#Switching_between_users))
4. Use `chrome-devtools-list_pages` to get each tab's `pageId` and URL; the URL's `testuser` param identifies the player (e.g. `testuser=12345` → that player's view)

### 5. Testing: Read Game State and Switch to Active Player's Tab

When testing the game, determine whose turn it is and perform actions in that player's tab:

1. **Read game state** from any tab showing the game. Use `chrome-devtools-evaluate_script`:
   ```javascript
   () => {
     const g = typeof game !== 'undefined' ? game : (window.game || window['game']);
     if (!g?.gamedatas?.gamestate) return null;
     const gs = g.gamedatas.gamestate;
     return {
       stateName: gs.name,
       activePlayer: gs.active_player,
       activePlayers: gs.args?.active_players || (gs.active_player ? [gs.active_player] : []),
       playerorder: g.gamedatas?.playerorder || []
     };
   }
   ```
   - `activePlayer`: single active player (ACTIVE_PLAYER states like PlayerTurn, DiscardPhase)
   - `activePlayers`: for MULTIPLE_ACTIVE_PLAYER states (e.g. ReactionPhase)

2. **Alternative: read from status bar** — The status bar shows text like "Player X must play" or "Your turn". Use `chrome-devtools-take_snapshot` and look for the status bar section; parse the text to identify the active player name, then map it to a player ID via `gamedatas.players`.

3. **Switch to the active player's tab** — Use `chrome-devtools-select_page` with the `pageId` of the tab that has `testuser=<active_player_id>`.

4. **Perform actions** — In that tab, take a snapshot, find the action buttons (e.g. "End Turn", "Discard and Draw 3", "Confirm Selection"), and use `chrome-devtools-click` with the button's `uid`.

5. **Repeat** — After each action, the game state may change. Re-read the game state and switch to the new active player's tab before the next action.

## Error Monitoring

**CRITICAL: Always check for errors after every action and report them to the user immediately.** Errors can block game progression (e.g. stuck in a state) and indicate bugs that need fixing.

### Where Errors Appear

Errors show up in the **game log area** on the sidebar, mixed in with normal game log entries. They appear as red text or with the prefix "Unexpected error:". Example:

```
Unexpected error: The counter value cannot be under 0 (player counter: golden_potatoes, value: -1, min: 0) (reference: GS1 14/02 00:41:48)
```

### How to Check for Errors

After each action (playing a card, skipping reaction, selecting target, etc.), check for errors using `chrome-devtools-evaluate_script`:

```javascript
() => {
  // Check for error text in the game log area
  const logEl = document.getElementById('logs');
  if (!logEl) return { errors: [] };
  const errorEls = logEl.querySelectorAll('.log_replayable, .roundedbox');
  const errors = [];
  errorEls.forEach(el => {
    const text = el.textContent?.trim() || '';
    if (text.toLowerCase().includes('unexpected error') || text.toLowerCase().includes('error:')) {
      errors.push(text);
    }
  });
  return { errors };
}
```

Alternatively, look for error text in the `chrome-devtools-take_snapshot` output — error messages appear as `StaticText` nodes containing "Unexpected error" or "error:".

### What to Do When Errors Are Found

1. **Stop playing** — Do not continue performing game actions when errors are present. The game may be in a broken state.
2. **Report the error immediately** — Tell the user the exact error message, which action triggered it, and the current game state (state name, active player, what was attempted).
3. **Discuss with the user** — The error likely indicates a bug in the game code. Wait for the user to decide whether to:
   - Investigate and fix the bug in the codebase
   - Reload and retry
   - Start a new game after fixing

### Common Error Patterns

- **Counter errors** (e.g. "counter value cannot be under 0") — Usually a bug in state transition logic where a counter is decremented incorrectly.
- **State transition errors** — The game gets stuck in a state (e.g. ReactionPhase) because a server-side error prevented the transition.
- **Missing argument errors** — An action was called without required parameters.

## Build Before Testing

If TypeScript or SCSS was modified, run `npm run build` before testing. The game loads compiled `Game.js` and `dondelaspapasqueman.css` from the server.

## Save & Restore Game State

BGA Studio provides **3 save slots** and a **Load Previous State** button at the bottom of the game area. Use these to snapshot the game at a specific point, then restore it after testing — essential for iterating on card resolution logic and action handling.

### When to Use Save/Restore

**Proactively save state** in these scenarios:
- **Before testing card resolution changes** — Save right before playing the card being debugged, so you can fix code and reload to the same point without replaying the entire game.
- **Before complex action sequences** — If the test requires multiple steps (play card → reaction phase → discard → etc.), save before the first step so the full sequence can be retried.
- **When the user asks to test a specific interaction** — Save at the point where the interaction is about to happen.
- **Before risky actions** — If unsure whether a code change works, save first so recovery is instant.

### Save/Restore UI Elements

The debug panel at the bottom of the game area contains paired save/load buttons for 3 slots, plus a special "Load Previous State" button:

| Element | Selector | CSS Classes | Purpose |
|---------|----------|-------------|---------|
| SAVE 1 | `#debug_save1` | `debug_save bgabutton bgabutton_gray` | Save to slot 1 |
| LOAD 1 | `#debug_load1` | `debug_load bgabutton bgabutton_blue` | Load from slot 1 |
| SAVE 2 | `#debug_save2` | `debug_save bgabutton bgabutton_gray` | Save to slot 2 |
| LOAD 2 | `#debug_load2` | `debug_load bgabutton bgabutton_blue` | Load from slot 2 |
| SAVE 3 | `#debug_save3` | `debug_save bgabutton bgabutton_gray` | Save to slot 3 |
| LOAD 3 | `#debug_load3` | `debug_load bgabutton bgabutton_blue` | Load from slot 3 |
| LOAD PREVIOUS STATE | `#debug_load4` | `debug_load bgabutton bgabutton_blue` | Undo to previous server-side state |

### How to Save

Click the save button using `chrome-devtools-evaluate_script`:

```javascript
() => {
  const btn = document.getElementById('debug_save1');
  if (btn) btn.click();
  return 'Saved to slot 1';
}
```

Replace `debug_save1` with `debug_save2` or `debug_save3` for other slots.

After clicking, wait briefly for the server to confirm. The save is server-side, so it persists even if you reload the page.

### How to Load/Restore

Click the load button using `chrome-devtools-evaluate_script`:

```javascript
() => {
  const btn = document.getElementById('debug_load1');
  if (btn) btn.click();
  return 'Loading slot 1';
}
```

Replace `debug_load1` with `debug_load2` or `debug_load3` for other slots.

**After loading**, the page will reload to restore the game state. You must:
1. Wait for the page to finish reloading — use `chrome-devtools-wait_for` with text that appears in the game (e.g. a player name, or "Your turn")
2. **Do this for ALL player tabs** — Each tab must be reloaded to reflect the restored state. Either:
   - Navigate each tab to its URL again using `chrome-devtools-navigate_page`, or
   - Reload each tab using `chrome-devtools-evaluate_script` with `() => { location.reload(); }` after selecting it
3. Re-read the game state to confirm the restore worked

### Load Previous State

`#debug_load4` ("LOAD PREVIOUS STATE") rolls back to the previous server-side game state (one step back). Useful for quick undo of the last action without needing a save slot.

### Recommended Save/Restore Workflow for Debugging Card Resolution

When the user is debugging how a specific card or action resolves:

1. **Play the game** until reaching the point just before the action/card in question
2. **Save to slot 1**: click `#debug_save1`
3. **Perform the action** (play the card, trigger the effect, etc.)
4. **Check results** — Read game state, check counters, check for errors
5. **If there's a bug**:
   a. Report the error/unexpected behavior to the user
   b. The user fixes the code and runs `npm run build`
   c. **Load from slot 1**: click `#debug_load1` to restore back to the pre-action state
   d. Wait for reload, refresh all player tabs
   e. **Reload CSS** if SCSS changed (click `#bga-reload-css`)
   f. **Retry the action** to verify the fix
6. **Repeat** steps 3-5 until the behavior is correct

### Slot Usage Convention

- **Slot 1** — Primary save point: the state you keep restoring to during active debugging
- **Slot 2** — Secondary checkpoint: a further-back point in case you need to replay more context
- **Slot 3** — Spare slot for ad-hoc saves

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
