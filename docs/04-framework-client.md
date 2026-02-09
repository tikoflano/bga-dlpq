# Framework reference – Game interface (client side)

**Summary:** Client-side pieces of the BGA framework: Game.js, CSS, view/template, game art, and mobile. For available frontend libraries (Dojo, BGA components, TypeScript, Vue), see [11-frontend-libraries.md](11-frontend-libraries.md).

**Source:** [Studio • Board Game Arena – Game interface (Client side)](https://boardgamearena.com/doc/Studio)

---

## Game interface logic: Game.js

- **Doc:** [Game interface logic: Game.js](https://boardgamearena.com/doc/Game_interface_logic:_Game.js)
- Client-side logic: UI updates, animations, handling notifications from the server, user input. May be generated from TypeScript (e.g. built from `modules/src/`).

## Game interface stylesheet: yourgamename.css

- **Doc:** [Game interface stylesheet: yourgamename.css](https://boardgamearena.com/doc/Game_interface_stylesheet:_yourgamename.css)
- Game-specific CSS. May be compiled from SCSS (e.g. in `modules/src/`).

## Game layout: view and template

- **X.view.php** – Dynamic layout (PHP): structure, blocks, data passed to template.
- **X_X.tpl** – Static layout (template): HTML structure of the game area.
- **Doc:** [Game layout: view and template](https://boardgamearena.com/doc/Game_layout:_view_and_template:_yourgamename.view.php_and_yourgamename_yourgamename.tpl)

## Game art: img directory

- **Doc:** [Game art: img directory](https://boardgamearena.com/doc/Game_art:_img_directory)
- Images (cards, tokens, boards, etc.) referenced from CSS and JS.

## Your game mobile version

- **Doc:** [Your game mobile version](https://boardgamearena.com/doc/Your_game_mobile_version)
- Guidelines and hooks for making the game playable on mobile (responsive layout, touch, etc.).
