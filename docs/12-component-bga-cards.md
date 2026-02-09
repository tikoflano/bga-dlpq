# BgaCards component

**Summary:** Full reference for the **bga-cards** JavaScript component: loading (ESM and legacy), CardManager and stock types, API overview, card data and sprite markup, two-faced cards, PHP Deck integration, asynchronicity, TypeScript, and versioning. For the live demo and full API docs, use the links below.

**Source:** [BgaCards • Board Game Arena](https://boardgamearena.com/doc/BgaCards)

**Demo (interactive + source in dev tools):** [bga-cards demo](https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/demo/index.html)  
**API reference (full):** [bga-cards API docs](https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/docs/index.html)  
**TypeScript definitions:** [bga-cards.d.ts](https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/dist/bga-cards.d.ts)

---

## Overview

**bga-cards** is a JavaScript component to display and animate cards. It handles:

- Moving cards between stocks (with slide animations)
- Flipping and rotating cards
- Multiple stock types (deck, hand, line, grid, slot, etc.)

Example games: **Frenchtarot** (JS), **Verso** (TypeScript). The [Tutorial hearts](https://en.doc.boardgamearena.com/Tutorial_hearts) also uses bga-cards.

**Dependency:** bga-cards uses **bga-animations**; you must load bga-animations first and pass an animation manager to the card manager.

---

## Loading the library

### ESM (recommended)

```javascript
const BgaAnimations = await importEsmLib('bga-animations', '1.x'); // required first
const BgaCards = await importEsmLib('bga-cards', '1.x');
```

### Legacy (Dojo define)

```javascript
define([
    "dojo", "dojo/_base/declare",
    "ebg/core/gamegui",
    "ebg/counter",
    getLibUrl('bga-animations', '1.x'),  // required first
    getLibUrl('bga-cards', '1.x'),
], function (dojo, declare, gamegui, counter, BgaAnimations, BgaCards) {
    // BgaAnimations and BgaCards order must match the define array
    // ...
});
```

---

## Setup

### 1. Animation manager

Create once and reuse if you already use bga-animations elsewhere:

```javascript
this.animationManager = new BgaAnimations.Manager({
    animationsActive: () => this.bga.gameui.bgaAnimationsActive(),
});
```

### 2. Card manager

One **CardManager** per card type (or logical group). It builds card HTML and links stocks so cards can slide from one stock to another.

```javascript
this.cardsManager = new BgaCards.Manager({
    animationManager: this.animationManager,
    type: 'mygame-card',
    getId: (card) => card.id,
    setupFrontDiv: (card, div) => {
        div.style.background = 'blue';  // or sprite/CSS
        this.bga.gameui.addTooltipHtml(div.id, `tooltip of ${card.type}`);
    },
});
```

Important settings (see API for full **CardManagerSettings**):

- **animationManager** – required
- **type** – card type (e.g. CSS class base)
- **getId(card)** – unique id for the card
- **setupFrontDiv(card, div)** – configure front face (background, sprite, data attributes, tooltips)
- **setupBackDiv(card, div)** – optional, for two-faced cards
- **isCardVisible(card)** – optional; which side is shown (default uses `card.type`; often set to `() => true` for always front)

### 3. Stocks

Create stocks with the **manager** and a **container element** (empty HTML element). The manager registers each stock so cards can move between them.

```javascript
// In setup():
this.cardStock = new BgaCards.LineStock(this.cardsManager, document.getElementById('card-stock'));
this.cardStock.addCards(gamedatas.cards);
```

Card objects should look like: `{ id: 1, type: 3, type_arg: 2, location: 'table', location_arg: 0 }` (adjust to your game).

---

## Stock types (API reference)

All extend **CardStock**. Use the one that matches your layout:

| Class | Use case |
|-------|----------|
| **LineStock** | Single row/line of cards |
| **HandStock** | Player hand (horizontal layout) |
| **Deck** | Face-down draw pile |
| **AllVisibleDeck** | Deck with all cards visible (e.g. face-up) |
| **DiscardDeck** | Discard pile |
| **GridStock** | Grid of cards |
| **SlotStock** | Fixed slots (e.g. board positions) |
| **ScrollableStock** | Scrollable list of cards |
| **ManualPositionStock** | Manually positioned cards |
| **VoidStock** | Invisible holder (e.g. for removal); some animations missing (see below) |

Full API: [bga-cards API – Modules](https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/docs/index.html).

---

## CardManager – main methods

| Method | Description |
|--------|-------------|
| **addStock(stock)** | Register a stock with the manager |
| **removeStock(stock)** | Unregister |
| **createCardElement(card, initialSide?)** | Create card DOM (front/back/auto) |
| **flipCard(card, settings?)** | Flip the card |
| **setCardVisible(card, visible?, settings?)** | Show front or back |
| **placeCard(card)** / **placeCards(cards)** | Place using each stock’s **autoPlace** settings |
| **removeCard(card, settings?)** | Remove card (optional animation settings) |
| **getCardElement(card)** | Get DOM element for a card |
| **getCardStock(card)** | Get stock containing the card |
| **setLastPlayedCard(card, color?, cardClass?)** | Mark last played (visual highlight) |
| **updateCardInformations(card, settings?)** | Update card data (e.g. after reveal) |

---

## CardStock – main methods and callbacks

| Method | Description |
|--------|-------------|
| **addCard(card, settings?)** | Add one card (returns Promise) |
| **addCards(cards, settings?, shift?)** | Add many (shift = ms delay or chain) |
| **removeCard(card, settings?)** | Remove one |
| **removeCards(cards, settings?)** | Remove many |
| **removeAll(settings?)** | Clear stock |
| **getCards()** | Current cards in stock |
| **contains(card)** | Whether card is in stock |
| **setSelectableCards(cards?)** | Which cards are selectable (default all) |
| **setSelectionMode(mode, selectableCards?)** | 'none' \| 'single' \| 'multiple' |
| **getSelection()** | Selected cards |
| **setSort(sort?)** | Custom sort function |
| **flipCard(card, settings?)** | Flip card in this stock |

Optional **CardStockSettings** and callbacks:

- **onCardAdded(card)**
- **onCardRemoved(card)**
- **onCardClick(card)**
- **onCardCountChange(cardCount)**
- **onSelectionChange(selection, lastChange)**

**AddCardSettings** / **RemoveCardSettings** can include animation options (e.g. **fadeOut**, **slideTo**).

---

## Card data format

- **id** – unique (number or string).
- **type** / **type_arg** – often used for sprite position or card kind; bga-cards does not require them but many examples use them.
- Other fields (e.g. **location**, **location_arg**) are up to your game.

For **addCards** you must pass an **array**. PHP Deck’s `getCardsInLocation()` returns a **map** by default; use `array_values(...)` in PHP or `Object.values(this.gamedatas.hand)` in JS. See [PHP Deck integration](#php-deck-integration) below.

---

## Sprite markup (card images)

Card images are not automatic; you set them in **setupFrontDiv** (and **setupBackDiv** if needed).

**Option 1 – inline style (sprite):**

```javascript
setupFrontDiv: (card, div) => {
    div.style.backgroundPositionX = `calc(100% / 14 * (${card.type_arg} - 2))`; // columns
    div.style.backgroundPositionY = `calc(100% / 3 * (${card.type} - 1))`;      // rows
}
```

**Option 2 – data attributes + CSS:**

```javascript
setupFrontDiv: (card, div) => {
    div.dataset.type = card.type;     // e.g. suit 1..4
    div.dataset.typeArg = card.type_arg; // e.g. value 2..14
}
```

Then target in CSS, e.g. `.card[data-type="1"][data-type-arg="12"] { ... }`.

---

## Two-faced cards (front/back)

- Implement **setupBackDiv(card, div)** in the manager.
- Control which side is shown with **isCardVisible(card)**. Default is `(card) => card.type`, which is easy to misuse; often you want `() => true` (always front) or a custom rule.
- Use **flipCard** / **setCardVisible** for flip animations.

---

## VoidStock

As of 1.0.7, **VoidStock** does not support some animations (e.g. shrink, fadeOut). You can get similar effects by not using VoidStock and using **RemoveCardSettings** on **removeCards** instead, e.g.:

```javascript
await this.lineStock.removeCards(cards, {
    fadeOut: true,
    slideTo: $(`otherhand_${playerId}`),
});
```

---

## PHP Deck integration

Two common issues:

1. **Array vs map:** `$this->cards->getCardsInLocation('hand', $player_id)` returns a **map** (id → card). bga-cards **addCards** expects an **array**. In PHP: `$result['hand'] = array_values($this->cards->getCardsInLocation(...));` or in JS: `this.handStock.addCards(Object.values(this.gamedatas.hand));`.

2. **Types:** PHP may send **strings** for `type`/`type_arg`; **BgaCards.sort** and others expect **numbers**. Use a converter (e.g. **remapToBgaCard** in the [Hearts tutorial](https://en.doc.boardgamearena.com/Tutorial_hearts)) on data from `getAllDatas` and from notifications.

---

## Asynchronicity

Many add/remove methods are **async** (return **Promise**):

- **addCard** / **addCards** / **removeCard** / **removeCards** / **removeAll**.
- If you **addCards** in **setup()** and then call **setSelectableCards** in **onEnteringState()**, the selection may apply before cards are in the DOM. Use **await** on add/remove, or defer selection (e.g. **setTimeout**) so it runs after the cards are added.

---

## BgaCards.sort

Utility for sorting cards (e.g. by type/type_arg). Expects numeric fields; if your data comes from PHP as strings, use a custom sort or normalize card objects first.

---

## Using with TypeScript

- **d.ts:** Download [bga-cards.d.ts](https://x.boardgamearena.net/data/game-libs/bga-cards/1.x/dist/bga-cards.d.ts) into your game folder. You may need to remove the last line (export) depending on your build.
- If your game class is not declared inside the Dojo **define** callback, you can avoid “ReferenceError: BgaAnimations is not defined” by assigning to window:

```javascript
(window as any).BgaAnimations = BgaAnimations;
(window as any).BgaCards = BgaCards;
```

---

## Versioning and changelog

- The library uses **semver**; requiring **1.x** gets the latest 1.x fixes without breaking changes.
- Changelog is on the wiki: [BgaCards](https://boardgamearena.com/doc/BgaCards#Changelog). Recent entries:
  - **1.0.10:** GridStockSettings fix, slot stock demo, multi-select fix, getLastPlayedCardStyle fix
  - **1.0.9:** VoidStock.addCards signature
  - **1.0.8:** Slot & card selection override
  - **1.0.7:** HandStock blinking, deck count, removeCard.fadeOut without slideTo

For the full list and breaking changes, check the [BgaCards](https://boardgamearena.com/doc/BgaCards) wiki page.
