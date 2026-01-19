# Test Game in Browser

## Overview
Opens the DondeLasPapasQueman game in BGA Studio browser for testing the current feature or changes.

## What this command does
1. Navigates to the BGA Studio game page for DondeLasPapasQueman
2. Opens the game interface in the browser
3. Allows you to interact with and test the current game state

## Usage
Type `/test-game-in-browser` in the chat to open the game in the browser. You can also add context like:
- `/test-game-in-browser test card selection`
- `/test-game-in-browser check reaction phase`

## Steps
1. Navigate to the BGA Studio game URL: `https://studio.boardgamearena.com/studiogame?game=DondeLasPapasQueman`
2. Wait for the page to load
3. If there's an active game table, navigate to it, otherwise the game management page will be shown
4. **If you made changes to CSS/SCSS files, click the "Reload CSS" button** (found in the debug panel on the left side of the game page)
5. Take a snapshot of the current game state
6. Report any visible issues or confirm the game is working correctly

## Notes
- The game project name is `DondeLasPapasQueman` (from `.devcontainer/devcontainer.env`)
- This opens the game in BGA Studio, not production
- Make sure you've built your changes (`npm run build`) before testing if you modified TypeScript or SCSS files
- **Important**: After making CSS/SCSS changes, you must click "Reload CSS" in the game interface for the changes to take effect, even after building
