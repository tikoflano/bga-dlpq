# Frontend libraries and frameworks

**Summary:** Available frontend libraries in BGA Studio: the core Dojo framework, official BGA JS components (Stock, Counter, bga-cards, etc.), optional TypeScript/SCSS and Vue.js, loading ESM vs Dojo modules, and third-party Type Safe Template. Use this for choosing and using client-side tech.

**Source:** [Studio](https://boardgamearena.com/doc/Studio), [BGA Studio Cookbook](https://boardgamearena.com/doc/BGA_Studio_Cookbook), [Using Typescript and Scss](https://boardgamearena.com/doc/Using_Typescript_and_Scss), [Using Vue](https://boardgamearena.com/doc/Using_Vue), [BGA Type Safe Template](https://boardgamearena.com/doc/BGA_Type_Safe_Template), [Software Versions](https://boardgamearena.com/doc/Studio#Software_Versions)

---

## Core framework: Dojo Toolkit

BGA’s client-side stack is built on **Dojo Toolkit 1.15**.

- Your game’s `Game.js` (or compiled output) runs in the same page as the BGA framework, which uses Dojo for DOM, modules, events, and UI.
- You can use Dojo APIs in your game (e.g. `dojo.place`, `dojo.query`, `dojo.string.substitute`, `dojo.declare`, `dojo/aspect`, `dijit.Tooltip`). See [Dojo reference](https://dojotoolkit.org/reference-guide/1.15/).
- Many BGA components (Stock, Counter, Zone, etc.) are built on Dojo and loaded via the legacy Dojo module path (e.g. `ebg/counter`, `ebg/stock`).

**Note:** If you use TypeScript/ES modules (see below), you can still load Dojo-based components via `importDojoLibs()`. The framework also supports newer ESM-based libraries.

---

## Official BGA JS components (frontend)

These are the official UI/game components provided by BGA. They are the main “frontend libraries” you use when building the game interface.

| Category   | Components | Doc |
|-----------|------------|-----|
| **UI**    | Counter, Draggable, ExpandableSection, Scrollmap, Stock, Zone | [05-components.md](05-components.md) |
| **Game**  | bga-animations, bga-cards, bga-dice, bga-autofit, bga-score-sheet | [05-components.md](05-components.md); full BgaCards ref: [12-component-bga-cards.md](12-component-bga-cards.md) |

- In **classic Dojo** projects they are required via `define([ "ebg/counter", "ebg/stock", ... ], ...)`.
- In **TypeScript/ES modules** you can load:
  - **New ESM libs** (e.g. bga-animations, bga-cards) with `globalThis.importEsmLib('bga-animations', '1.x')` (see [Using TypeScript and Scss](#optional-typescript--scss)).
  - **Legacy Dojo libs** (e.g. Counter, Stock) with `importDojoLibs(["ebg/counter", "ebg/stock"])`.

---

## Optional: TypeScript and SCSS

You are not required to write raw JavaScript or CSS. You can author in **TypeScript** and **SCSS** and build down to the single `Game.js` and `yourgamename.css` that BGA expects.

- **TypeScript:** Write `.ts` (e.g. in `src/` or `modules/src/`), compile to ES5 or ES modules → `Game.js` (or `modules/js/Game.js`). Use `bga-framework.d.ts` for BGA/Dojo types.
- **SCSS:** Write `.scss`, compile to a single CSS file → `yourgamename.css`.
- Setup: [Using Typescript and Scss](https://boardgamearena.com/doc/Using_Typescript_and_Scss) (package.json, rollup, tsconfig, sass, watch, exclude `node_modules` from sync).

**Using the new ESM libs (bga-*) in TypeScript:** create a small loader module and use `importEsmLib`:

```ts
// e.g. libs.ts
const BgaAnimations = await globalThis.importEsmLib('bga-animations', '1.x');
const BgaCards = await globalThis.importEsmLib('bga-cards', '1.x');
export { BgaAnimations, BgaCards };
```

**Using legacy Dojo components in TypeScript:**

```ts
const [Counter, Stock] = await importDojoLibs(["ebg/counter", "ebg/stock"]);
export { Counter, Stock };
```

With ES modules, the game instance is exposed as `gameui.GameModule` (not merged into `gameui`).

---

## Optional: Vue.js

You can use **Vue.js 3** for parts of your game UI alongside the BGA/Dojo stack.

- **Doc:** [Using Vue](https://boardgamearena.com/doc/Using_Vue).
- The wiki page states that Vue 3 can be incorporated; the live doc is short, so check the link for current setup (mounting, integration with Game.js).

---

## Third-party: BGA Type Safe Template

**BGA Type Safe Template** is a community npm package (not official BGA). It provides:

- TypeScript with types for BGA and Dojo components.
- Cookbook-style recipes and optional tooling (e.g. SCSS, VSCode extension pack, jsonc for game options/states).
- Commands: `npm run init`, `npm run build`, `npm run watch`.

**Doc:** [BGA Type Safe Template](https://boardgamearena.com/doc/BGA_Type_Safe_Template)  
**Repo:** [github.com/NevinAF/bga-ts-template](https://github.com/NevinAF/bga-ts-template)

Use this if you want a preconfigured typed project; otherwise follow [Using Typescript and Scss](https://boardgamearena.com/doc/Using_Typescript_and_Scss) for a minimal TS/SCSS setup.

---

## Icons: Font Awesome

Two versions are available in the BGA environment:

- **Font Awesome 4.7:** `<i class="fa fa-clock" />` — [icons](https://fontawesome.com/v4.7/icons/)
- **Font Awesome 6.4.0:** `<i class="fa6 fa6-clock" />` — [icons (free)](https://fontawesome.com/v6/search?o=r&m=free)

See [08-software-versions.md](08-software-versions.md).

---

## JS/CSS constraints

- **JS:** Output must be compatible with BGA’s minimization and runtime (see [Game interface logic: Game.js](https://boardgamearena.com/doc/Game_interface_logic:_Game.js) — JS minimization). TypeScript is typically compiled to ES5 or a supported ES target.
- **CSS:** Single game stylesheet; SCSS is compiled to one CSS file. External fonts are subject to [Content Security Policy](https://boardgamearena.com/doc/BGA_Studio_Cookbook) (e.g. allowed origins for `font-src`).

---

## Recipes and patterns (Cookbook)

The [BGA Studio Cookbook](https://boardgamearena.com/doc/BGA_Studio_Cookbook) contains frontend-oriented recipes:

- DOM (creating pieces, static vs dynamic, player colors in templates).
- Animation (attachToNewParent, “animation on oversurface”, scroll into view).
- Logs (injecting images/HTML, `bgaFormatText`, tooltips).
- Images (access from JS, Hi-DPI, CSS masks, image buttons).
- Fonts (thematic fonts, CSP).
- Layout (scale to fit, zoom).
- Tooltips (e.g. `dijit.Tooltip` for dynamic content).

See [07-user-guide.md](07-user-guide.md) for the Cookbook link and related tools.
