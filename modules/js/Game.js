/**
 * Decode card_type_arg to get name_index, value, and isAlarm
 * Format: name_index * 10000 + value * 100 + (isAlarm ? 1 : 0)
 * Value range: 0-3 (potato cards always have value 0)
 */
function decodeCardTypeArg(typeArg) {
    const isAlarm = typeArg % 100 === 1;
    const value = Math.floor((typeArg % 10000) / 100);
    const nameIndex = Math.floor(typeArg / 10000);
    return { name_index: nameIndex, value, isAlarm };
}
const CARD_NAMES = {
    potato: {
        1: _("potato"),
        2: _("duchesses potatoes"),
        3: _("french fries"),
    },
    action: {
        1: _("No dude"),
        2: _("I told you no dude"),
        3: _("Get off the pony"),
        4: _("Lend me a buck"),
        5: _("Runaway potatoes"),
        6: _("Harry Potato"),
        7: _("Pope Potato"),
        8: _("Look ahead"),
        9: _("The potato of the year"),
        10: _("Potato of destiny"),
        11: _("Potato Dawan"),
        12: _("Jump to the side"),
        13: _("Papageddon"),
        14: _("Spider potato"),
    },
    wildcard: {
        1: _("Wildcard"),
    },
};
/**
 * Get card name by type and name_index.
 */
function getCardName(card) {
    const decoded = decodeCardTypeArg(card.type_arg || 0);
    return CARD_NAMES[card.type]?.[decoded.name_index] || _("Unknown Card");
}
function getCardValue(card) {
    const decoded = decodeCardTypeArg(card.type_arg || 0);
    return decoded.value;
}
/**
 * Check if a card is an interrupt card (No dude or I told you no dude).
 */
function isInterruptCard(card) {
    if (card.type !== "action")
        return false;
    const decoded = decodeCardTypeArg(card.type_arg || 0);
    // name_index 1 = "No dude", name_index 2 = "I told you no dude"
    return decoded.name_index === 1 || decoded.name_index === 2;
}
function escapeHtml(text) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
function toHtmlText(text) {
    // Escape then convert newlines to <br/> for tooltip readability.
    return escapeHtml(text).replaceAll("\n", "<br/>");
}
function getPotatoThreesomeReward(nameIndex) {
    // Based on GAME_RULES.md placeholder rules.
    // potato -> 1, duchesses potatoes -> 2, french fries -> 3
    if (nameIndex === 1)
        return 1;
    if (nameIndex === 2)
        return 2;
    if (nameIndex === 3)
        return 3;
    return 0;
}
function getActionCardEffectText(nameIndex) {
    // Placeholder texts based on ACTION_CARDS.md / GAME_RULES.md.
    switch (nameIndex) {
        case 1:
            return _("Interrupt card.\nCancels a regular card or another “No dude”.\nCannot cancel “I told you no dude” or threesomes.");
        case 2:
            return _("Interrupt card.\nCancels anything: regular cards, “No dude”, “I told you no dude”, and threesomes.");
        case 3:
            return _("Steal 1 golden potato from a target player.");
        case 4:
            return _("Steal 1 card from a target player (blind selection).");
        case 5:
            return _("Each other player returns 1 random card from their hand to the deck. Then shuffle the deck.");
        case 6:
            return _("Draw 2 cards from the deck.");
        case 7:
            return _("Choose a target and name a card. If they have it, steal 1 copy of that card.");
        case 8:
            return _("Destroy 1 golden potato from a target player.");
        case 9:
            return _("Gain 1 golden potato from the supply.");
        case 10:
            return _("Target discards their entire hand, then draws 2 new cards.");
        case 11:
            return _("See an opponent's hand and steal a card from it.");
        case 12:
            return _("Draw 1 card. The next player skips their turn.");
        case 13:
            return _("Reverse turn order. Steal 1 card from the next player (blind selection).");
        case 14:
            return _("Choose 2 players. Those players exchange hands (can include you).");
        default:
            return _("No tooltip text yet for this card.");
    }
}
/**
 * Return HTML for a card tooltip. Tooltip visibility is controlled by BGA's
 * built-in “Display tooltips” preference.
 */
function getCardTooltipHtml(card) {
    const decoded = decodeCardTypeArg(card.type_arg || 0);
    const title = getCardName(card);
    let body = "";
    const meta = [];
    if (card.type === "potato") {
        const reward = getPotatoThreesomeReward(decoded.name_index);
        body =
            reward > 0
                ? _("Potato card.\nCollect 3 matching potatoes (wildcards allowed) to gain ${n} golden potatoes.")
                    .replace("${n}", String(reward))
                : _("Potato card.\nCollect 3 matching potatoes (wildcards allowed) to gain golden potatoes.");
        meta.push(_("Cannot be played by itself."));
        return `
      <div class="dlpq-tooltip">
        <div class="dlpq-tooltip-title">${escapeHtml(title)}</div>
        <div class="dlpq-tooltip-body">${toHtmlText(body)}</div>
        <div class="dlpq-tooltip-meta">${meta.map((m) => `<div>${toHtmlText(m)}</div>`).join("")}</div>
      </div>
    `;
    }
    if (card.type === "wildcard") {
        body = _("Wildcard.\nCounts as any potato for potato threesomes.");
        meta.push(_("Cannot be played by itself."));
        return `
      <div class="dlpq-tooltip">
        <div class="dlpq-tooltip-title">${escapeHtml(title)}</div>
        <div class="dlpq-tooltip-body">${toHtmlText(body)}</div>
        <div class="dlpq-tooltip-meta">${meta.map((m) => `<div>${toHtmlText(m)}</div>`).join("")}</div>
      </div>
    `;
    }
    // Action cards
    body = getActionCardEffectText(decoded.name_index);
    if (decoded.value > 0) {
        meta.push(_("Value: ${n}").replace("${n}", String(decoded.value)));
    }
    else {
        meta.push(_("Value: 0"));
    }
    if (decoded.isAlarm) {
        meta.push(_("Alarm: if not interrupted, your turn ends after the reaction phase."));
    }
    if (decoded.name_index === 1 || decoded.name_index === 2) {
        meta.push(_("Playable during reaction phase only."));
    }
    return `
    <div class="dlpq-tooltip">
      <div class="dlpq-tooltip-title">${escapeHtml(title)}</div>
      <div class="dlpq-tooltip-body">${toHtmlText(body)}</div>
      <div class="dlpq-tooltip-meta">${meta.map((m) => `<div>${toHtmlText(m)}</div>`).join("")}</div>
    </div>
  `;
}
function getValidPlayFromSelection(hand, selectedCardIds) {
    const byId = new Map((hand || []).map((c) => [c.id, c]));
    const selected = selectedCardIds.map((id) => byId.get(id)).filter((c) => !!c);
    if (selected.length === 1) {
        const card = selected[0];
        const decoded = decodeCardTypeArg(card.type_arg || 0);
        // Potato cards, wildcards, and interrupt cards cannot be played by themselves.
        if (card.type === "potato" || card.type === "wildcard" || isInterruptCard(card)) {
            return null;
        }
        const cardName = getCardName(card);
        const label = decoded.isAlarm
            ? _("Play ${card_name} and end turn").replace("${card_name}", cardName)
            : _("Play ${card_name}").replace("${card_name}", cardName);
        return { kind: "single", cardId: card.id, label };
    }
    if (selected.length !== 3) {
        return null;
    }
    const wildcards = selected.filter((c) => c.type === "wildcard");
    const potatoes = selected.filter((c) => c.type === "potato");
    // 3 wildcards => threesome of french fries
    if (wildcards.length === 3) {
        const label = _("Play threesome of ${threesome_name}").replace("${threesome_name}", _("french fries"));
        return { kind: "threesome_potato", cardIds: selectedCardIds.slice(), label };
    }
    // Potato threesome with 0-2 wildcards (potatoes must share the same name)
    if (potatoes.length + wildcards.length === 3 && wildcards.length <= 2 && potatoes.length >= 1) {
        const potatoNames = potatoes.map((c) => decodeCardTypeArg(c.type_arg || 0).name_index);
        const uniquePotatoNames = Array.from(new Set(potatoNames));
        if (uniquePotatoNames.length === 1) {
            const threesomeName = getCardName(potatoes[0]);
            const label = _("Play threesome of ${threesome_name}").replace("${threesome_name}", threesomeName);
            return { kind: "threesome_potato", cardIds: selectedCardIds.slice(), label };
        }
    }
    // 3 cards of any type with value == 3 each
    const allValue3 = selected.every((c) => getCardValue(c) === 3);
    if (allValue3) {
        return { kind: "threesome_value3", cardIds: selectedCardIds.slice(), label: _("Play threesome") };
    }
    return null;
}

let BgaAnimations$1;
let BgaCards$1;
class Game {
    static setBgaLibs(animations, cards) {
        BgaAnimations$1 = animations;
        BgaCards$1 = cards;
    }
    constructor(bga) {
        this.opponentHandStocks = new Map();
        this.goldenPotatoStocks = new Map();
        // ReactionPhase double-send guard
        this.reactionActionSent = false;
        // TargetSelection state
        this.selectedTargets = [];
        // Revealed card cache (for steal-card effects)
        this.revealedCardsById = new Map();
        // ========================================================================
        //  ReactionPhase state
        // ========================================================================
        this.reactionCountdownId = null;
        this.reactionAutoSkipId = null;
        this.reactionSkipButton = null;
        this.reactionTimeSeconds = 7;
        // ========================================================================
        //  CardSelection state (Pope Potato / Potato Dawan pick-a-card)
        // ========================================================================
        this.cardSelectionState = null;
        console.log("dondelaspapasqueman constructor");
        this.bga = bga;
    }
    getGamedatas() {
        return this.gamedatas;
    }
    async setup(gamedatas) {
        console.log("Starting game setup", gamedatas);
        this.gamedatas = gamedatas;
        this.bga.gameArea.getElement().insertAdjacentHTML("beforeend", `
      <div id="dlpq-table">
        <div id="dlpq-opponents-hands"></div>
        <div id="dlpq-common-area">
          <div id="dlpq-deck"></div>
          <div id="dlpq-discard"></div>
          <div id="dlpq-golden-potato-pile-wrap">
            <div id="dlpq-golden-potato-pile"></div>
          </div>
        </div>
        <div id="dlpq-hand-wrap" class="whiteblock">
          <div class="dlpq-hand-row">
            <div class="dlpq-hand-section">
              <div id="dlpq-hand"></div>
            </div>
            <div class="dlpq-golden-potato-section" id="dlpq-my-golden-potato-section"></div>
          </div>
        </div>
      </div>
      `);
        this.initCardManager();
        this.initHandStock(gamedatas.hand || []);
        this.initDrawDeck(gamedatas.deckCount || 0);
        this.initDiscardPile(gamedatas.discardPileCards || []);
        this.initGoldenPotatoPile();
        await this.initOpponentHands();
        this.setupPlayerPanelCounters();
        this.setupNotifications();
        // Re-enter current state after setup (critical for reload: framework may call onEnteringState before setup completes)
        const gamestate = this.gamedatas.gamestate;
        if (gamestate?.name) {
            setTimeout(() => {
                this.onEnteringState(gamestate.name, gamestate);
            }, 100);
        }
        console.log("Ending game setup");
    }
    // ========================================================================
    //  Card Manager & Stocks
    // ========================================================================
    initCardManager() {
        this.animationManager = new BgaAnimations$1.Manager({
            animationsActive: () => this.bga.gameui.bgaAnimationsActive(),
        });
        const cardWidth = 120;
        const cardHeight = 168;
        this.cardsManager = new BgaCards$1.Manager({
            animationManager: this.animationManager,
            type: "dlpq-card",
            getId: (card) => `dlpq-card-${card.id}`,
            cardWidth,
            cardHeight,
            cardBorderRadius: "8px",
            isCardVisible: (card) => !!card.type,
            setupDiv: (card, div) => {
                if (card.type) {
                    div.dataset.cardType = card.type;
                }
            },
            setupFrontDiv: (card, div) => {
                if (!card.type)
                    return;
                if (card.type === "golden_potato") {
                    div.dataset.cardType = "golden_potato";
                    div.innerHTML = `
            <div class="dlpq-golden-potato-label">${_("Golden potato")}</div>
            <div class="dlpq-golden-potato-icon">\u{1F954}</div>
          `;
                    this.bga.gameui.addTooltipHtml(div.id, _("Golden potato"));
                    return;
                }
                const decoded = decodeCardTypeArg(card.type_arg || 0);
                const name = getCardName(card);
                const value = getCardValue(card);
                div.dataset.cardType = card.type;
                div.innerHTML = `
          ${decoded.isAlarm ? '<div class="dlpq-alarm-dot" title="' + _("Alarm") + '"></div>' : ""}
          <div class="dlpq-card-type-label">${card.type}</div>
          <div class="dlpq-card-name">${name}</div>
          <div class="dlpq-card-value">${_("Value")}: ${value}</div>
        `;
                this.bga.gameui.addTooltipHtml(div.id, getCardTooltipHtml(card));
            },
            setupBackDiv: (card, div) => {
                if (card.type === "golden_potato") {
                    div.dataset.cardType = "golden_potato";
                    div.classList.add("dlpq-golden-potato-back");
                    div.innerHTML = `
            <div class="dlpq-golden-potato-label">${_("Golden potato")}</div>
            <div class="dlpq-golden-potato-back-icons">\u{1F954}\u{1F954}</div>
          `;
                    this.bga.gameui.addTooltipHtml(div.id, _("Golden potato"));
                    return;
                }
                div.innerHTML = "";
            },
            fakeCardGenerator: (deckId) => ({ id: `${deckId}-fake-top` }),
        });
    }
    initHandStock(hand) {
        this.handStock = new BgaCards$1.HandStock(this.cardsManager, document.getElementById("dlpq-hand"), {
            cardOverlap: "60px",
            cardShift: "15px",
            inclination: 4,
        });
        if (hand.length > 0) {
            this.handStock.addCards(hand);
        }
    }
    initDrawDeck(deckCount) {
        this.drawDeck = new BgaCards$1.Deck(this.cardsManager, document.getElementById("dlpq-deck"), {
            cardNumber: deckCount,
            counter: {
                show: true,
                position: "bottom",
                extraClasses: "round",
            },
            autoUpdateCardNumber: false,
        });
    }
    initDiscardPile(cards) {
        this.discardPile = new BgaCards$1.DiscardDeck(this.cardsManager, document.getElementById("dlpq-discard"), {
            maxRotation: 15,
            maxHorizontalShift: 8,
            maxVerticalShift: 8,
        });
        // Cards arrive bottom-to-top; only the last one is the "top" card.
        const topIndex = cards.length - 1;
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const isTop = i === topIndex;
            this.discardPile.addCard(card).then(() => {
                this.applyDeterministicTransform(card);
                if (!isTop) {
                    this.removeDiscardTooltip(card);
                }
            });
        }
    }
    initGoldenPotatoPile() {
        const pileEl = document.getElementById("dlpq-golden-potato-pile");
        this.goldenPotatoPile = new BgaCards$1.Deck(this.cardsManager, pileEl, {
            counter: { show: true, position: "bottom", extraClasses: "round" },
            fakeCardGenerator: (deckId) => ({ id: `${deckId}-fake-top`, type: "golden_potato" }),
        });
        const playerCount = Object.keys(this.gamedatas.players || {}).length;
        const maxPerPlayer = playerCount <= 3 ? 8 : playerCount <= 5 ? 6 : 5;
        const totalNeeded = maxPerPlayer * playerCount + 10;
        const pileCards = [];
        for (let i = 0; i < totalNeeded; i++) {
            pileCards.push({
                id: 900000 + i,
                type: "golden_potato",
            });
        }
        this.goldenPotatoPile.addCards(pileCards);
    }
    returnGoldenPotatoToPile(card) {
        this.goldenPotatoPile.addCard(card);
    }
    async initOpponentHands() {
        const container = document.getElementById("dlpq-opponents-hands");
        const myId = this.myPlayerId();
        const playerorder = this.gamedatas.playerorder;
        const playerIds = playerorder
            ? playerorder.map((p) => Number(p)).filter((id) => id > 0 && id !== myId)
            : Object.keys(this.gamedatas.players || {})
                .map(Number)
                .filter((id) => id !== myId);
        for (const playerId of playerIds) {
            const player = this.gamedatas.players?.[playerId];
            if (!player)
                continue;
            const name = player.name ?? "";
            const color = player.color ?? "";
            const handCount = Number(player.handCount ?? 0);
            const area = document.createElement("div");
            area.className = "dlpq-opponent-hand-area whiteblock";
            area.dataset.playerId = String(playerId);
            if (color) {
                area.style.borderLeftColor = `#${color}`;
                area.style.borderLeftWidth = "4px";
                area.style.borderLeftStyle = "solid";
            }
            const nameStyle = color ? ` style="color: #${color}"` : "";
            area.innerHTML = `
        <span class="dlpq-opponent-name"${nameStyle}>${this.escapeHtml(name)}</span>
        <div class="dlpq-opponent-hand-row">
          <div class="dlpq-opponent-hand-cards" id="dlpq-opponent-hand-${playerId}"></div>
          <div class="dlpq-golden-potato-cards" id="dlpq-golden-potatoes-${playerId}">
            <div class="dlpq-golden-potato-empty"></div>
          </div>
        </div>
      `;
            container.appendChild(area);
            const cardsEl = document.getElementById(`dlpq-opponent-hand-${playerId}`);
            const stock = new BgaCards$1.LineStock(this.cardsManager, cardsEl, {
                direction: "row",
                gap: "0",
            });
            this.opponentHandStocks.set(playerId, stock);
            const fakeCards = [];
            for (let i = 0; i < handCount; i++) {
                fakeCards.push({
                    id: -(playerId * 10000 + i),
                });
            }
            if (fakeCards.length > 0) {
                stock.addCards(fakeCards);
            }
            const goldenPotatoEl = document.getElementById(`dlpq-golden-potatoes-${playerId}`);
            const gpStock = new BgaCards$1.LineStock(this.cardsManager, goldenPotatoEl, {
                direction: "row",
                gap: "0",
            });
            this.goldenPotatoStocks.set(playerId, gpStock);
            const gpCount = Number(player.golden_potatoes ?? player.score ?? 0);
            for (let i = 0; i < gpCount; i++) {
                const card = this.goldenPotatoPile.getTopCard();
                if (card)
                    await gpStock.addCard(card, { fromStock: this.goldenPotatoPile });
            }
            this.setGoldenPotatoEmptyState(playerId, gpCount === 0);
        }
        await this.initMyGoldenPotatoStock();
    }
    async initMyGoldenPotatoStock() {
        const myId = this.myPlayerId();
        const gpSection = document.getElementById("dlpq-my-golden-potato-section");
        gpSection.innerHTML = `
      <div class="dlpq-golden-potato-cards" id="dlpq-golden-potatoes-${myId}">
        <div class="dlpq-golden-potato-empty"></div>
      </div>
    `;
        const goldenPotatoEl = document.getElementById(`dlpq-golden-potatoes-${myId}`);
        const gpStock = new BgaCards$1.LineStock(this.cardsManager, goldenPotatoEl, {
            direction: "row",
            gap: "0",
        });
        this.goldenPotatoStocks.set(myId, gpStock);
        const player = this.gamedatas.players?.[myId];
        const gpCount = Number(player?.golden_potatoes ?? player?.score ?? 0);
        for (let i = 0; i < gpCount; i++) {
            const card = this.goldenPotatoPile.getTopCard();
            if (card)
                await gpStock.addCard(card, { fromStock: this.goldenPotatoPile });
        }
        this.setGoldenPotatoEmptyState(myId, gpCount === 0);
    }
    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
    applyDeterministicTransform(card) {
        const el = this.cardsManager.getCardElement(card);
        if (!el)
            return;
        const id = Math.abs(Number(card.id));
        const seed = (id * 2654435761) >>> 0;
        const rot = ((seed % 1000) / 1000 - 0.5) * 2 * 15;
        const dx = (((seed >>> 10) % 1000) / 1000 - 0.5) * 2 * 8;
        const dy = (((seed >>> 20) % 1000) / 1000 - 0.5) * 2 * 8;
        el.style.setProperty("--discard-deck-rotate", `${rot}deg`);
        el.style.setProperty("--discard-deck-left", `${dx}px`);
        el.style.setProperty("--discard-deck-top", `${dy}px`);
    }
    removeDiscardTooltip(card) {
        const el = this.cardsManager.getCardElement(card);
        if (!el)
            return;
        const front = el.querySelector(".front");
        if (front?.id) {
            this.bga.gameui.removeTooltip(front.id);
        }
    }
    // ========================================================================
    //  Hand / Deck helpers (used by notifications)
    // ========================================================================
    removeCardFromHand(cardId) {
        const card = this.handStock
            .getCards()
            .find((c) => Number(c.id) === Number(cardId));
        if (card) {
            this.handStock.removeCard(card);
        }
        this.syncHandToGamedata();
    }
    addCardToHand(card) {
        this.handStock.addCard(card);
        this.syncHandToGamedata();
    }
    /**
     * Adds a card to hand with animation from the draw deck.
     */
    async addCardToHandWithDrawAnimation(card) {
        await this.handStock.addCard(card, {
            fromElement: this.drawDeck.element,
        });
        this.syncHandToGamedata();
    }
    /**
     * Adds a card to hand with animation from the target's hand (for steal effects).
     * When target is another player, animates from their opponent hand stock.
     */
    async addCardToHandWithStealAnimation(card, targetPlayerId) {
        if (targetPlayerId === null || targetPlayerId === this.myPlayerId()) {
            this.addCardToHand(card);
            return;
        }
        const opponentStock = this.opponentHandStocks.get(targetPlayerId);
        if (!opponentStock) {
            this.addCardToHand(card);
            return;
        }
        const cards = opponentStock.getCards();
        if (cards.length === 0) {
            this.addCardToHand(card);
            return;
        }
        // Use a card from the opponent stock as animation source (real or fake card back)
        const sourceCard = cards.find((c) => Number(c.id) === Number(card.id)) ?? cards[0];
        const sourceEl = opponentStock.getCardElement(sourceCard);
        await this.handStock.addCard(card, { fromElement: sourceEl });
        await opponentStock.removeCard(sourceCard);
        this.syncHandToGamedata();
    }
    replaceHand(cards) {
        const current = this.handStock.getCards();
        const newIds = new Set(cards.map((c) => c.id));
        const currentIds = new Set(current.map((c) => c.id));
        const toRemove = current.filter((c) => !newIds.has(c.id));
        const toAdd = cards.filter((c) => !currentIds.has(c.id));
        for (const card of toRemove) {
            this.handStock.removeCard(card);
        }
        if (toAdd.length > 0) {
            this.handStock.addCards(toAdd);
        }
        this.gamedatas.hand = cards;
    }
    syncHandToGamedata() {
        this.gamedatas.hand = this.handStock.getCards();
    }
    setDeckCount(count) {
        const c = Math.max(0, count);
        this.gamedatas.deckCount = c;
        this.drawDeck.setCardNumber(c);
    }
    decDeckCount(delta) {
        const current = typeof this.gamedatas.deckCount === "number"
            ? this.gamedatas.deckCount
            : 0;
        this.setDeckCount(current - delta);
    }
    // ========================================================================
    //  Player panel counters
    // ========================================================================
    setupPlayerPanelCounters() {
        const winThreshold = this.getWinThreshold();
        const players = this.gamedatas.players || {};
        for (const playerIdStr in players) {
            const playerId = Number(playerIdStr);
            const player = players[playerId];
            const goldenPotatoes = Number(player.golden_potatoes ?? player.score ?? 0);
            const handCount = Number(player.handCount ?? 0);
            const panelElement = this.bga.playerPanels.getElement(playerId);
            if (!panelElement)
                continue;
            let countersContainer = panelElement.querySelector(".player-counters-container");
            if (!countersContainer) {
                countersContainer = document.createElement("div");
                countersContainer.className = "player-counters-container";
                panelElement.appendChild(countersContainer);
            }
            countersContainer.innerHTML = `
        <div class="golden-potato-counter">
          <span class="golden-potato-icon">\u{1F954}</span>
          <span class="golden-potato-count">${goldenPotatoes}/${winThreshold}</span>
        </div>
        <div class="card-count-counter${handCount > 7 ? " over-limit" : ""}">
          <span class="card-count-icon">\u{1F0CF}</span>
          <span class="card-count-number">${handCount}/7</span>
        </div>
      `;
        }
    }
    updatePlayerPanelCounter(playerId) {
        const winThreshold = this.getWinThreshold();
        const player = this.gamedatas.players?.[playerId];
        if (!player)
            return;
        const goldenPotatoes = Number(player.golden_potatoes ?? player.score ?? 0);
        const panelElement = this.bga.playerPanels.getElement(playerId);
        if (!panelElement)
            return;
        const countSpan = panelElement.querySelector(".golden-potato-count");
        if (countSpan) {
            countSpan.textContent = `${goldenPotatoes}/${winThreshold}`;
        }
    }
    updatePlayerCardCount(playerId) {
        const player = this.gamedatas.players?.[playerId];
        if (!player)
            return;
        const handCount = Number(player.handCount ?? 0);
        const panelElement = this.bga.playerPanels.getElement(playerId);
        if (!panelElement)
            return;
        const countSpan = panelElement.querySelector(".card-count-number");
        if (countSpan) {
            countSpan.textContent = `${handCount}/7`;
        }
        const counterEl = panelElement.querySelector(".card-count-counter");
        if (counterEl) {
            counterEl.classList.toggle("over-limit", handCount > 7);
        }
        if (playerId !== this.myPlayerId()) {
            this.updateOpponentHandDisplay(playerId);
        }
    }
    updateOpponentHandDisplay(playerId) {
        const stock = this.opponentHandStocks.get(playerId);
        if (!stock)
            return;
        const handCount = Number(this.gamedatas.players?.[playerId]?.handCount ?? 0);
        const currentCards = stock.getCards();
        const currentCount = currentCards.length;
        if (currentCount < handCount) {
            const toAdd = handCount - currentCount;
            for (let i = 0; i < toAdd; i++) {
                const fakeCard = {
                    id: -(playerId * 10000 + currentCount + i),
                };
                stock.addCard(fakeCard);
            }
        }
        else if (currentCount > handCount) {
            const toRemove = currentCount - handCount;
            const cardsToRemove = currentCards.slice(-toRemove);
            for (const card of cardsToRemove) {
                stock.removeCard(card);
            }
        }
    }
    async applyGoldenPotatoesDelta(playerId, delta) {
        const p = this.gamedatas.players?.[playerId];
        if (!p)
            return;
        const current = Number(p.golden_potatoes ?? p.score ?? 0);
        const next = Math.max(0, current + delta);
        p.golden_potatoes = next;
        p.score = next;
        this.updatePlayerPanelCounter(playerId);
        await this.updateGoldenPotatoDisplay(playerId);
    }
    async updateGoldenPotatoDisplay(playerId) {
        const stock = this.goldenPotatoStocks.get(playerId);
        if (!stock)
            return;
        const gpCount = Number(this.gamedatas.players?.[playerId]?.golden_potatoes ??
            this.gamedatas.players?.[playerId]?.score ??
            0);
        const currentCards = stock.getCards();
        const currentCount = currentCards.length;
        if (currentCount < gpCount) {
            // Hide placeholder before adding so the card animates to the correct position
            this.setGoldenPotatoEmptyState(playerId, false);
            const toAdd = gpCount - currentCount;
            for (let i = 0; i < toAdd; i++) {
                const card = this.goldenPotatoPile.getTopCard();
                if (card) {
                    await stock.addCard(card, { fromStock: this.goldenPotatoPile });
                }
            }
        }
        else if (currentCount > gpCount) {
            const toRemove = currentCount - gpCount;
            const cardsToRemove = currentCards.slice(-toRemove);
            for (const card of cardsToRemove) {
                stock.removeCard(card);
                this.returnGoldenPotatoToPile(card);
            }
        }
        this.setGoldenPotatoEmptyState(playerId, gpCount === 0);
    }
    setGoldenPotatoEmptyState(playerId, isEmpty) {
        const container = document.getElementById(`dlpq-golden-potatoes-${playerId}`);
        if (!container)
            return;
        container.classList.toggle("empty", isEmpty);
    }
    getWinThreshold() {
        if (this.gamedatas.winThreshold !== undefined) {
            return this.gamedatas.winThreshold;
        }
        const playerCount = Object.keys(this.gamedatas.players || {}).length;
        return playerCount <= 3 ? 8 : playerCount <= 5 ? 6 : 5;
    }
    // ========================================================================
    //  Revealed card cache
    // ========================================================================
    cacheRevealedCard(card) {
        this.revealedCardsById.set(card.id, card);
    }
    getRevealedCardFromCache(cardId) {
        return this.revealedCardsById.get(cardId);
    }
    // ========================================================================
    //  Utility
    // ========================================================================
    asInt(value) {
        if (typeof value === "number" && Number.isFinite(value))
            return value;
        if (typeof value === "string" && value.trim() !== "") {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }
    myPlayerId() {
        return this.bga.players.getCurrentPlayerId();
    }
    // ========================================================================
    //  State machine
    // ========================================================================
    onEnteringState(stateName, args) {
        console.log("Entering state:", stateName, args);
        switch (stateName) {
            case "PlayerTurn":
                this.enterPlayerTurn(args);
                break;
            case "ReactionPhase":
                this.enterReactionPhase(args);
                break;
            case "DiscardPhase":
                this.enterDiscardPhase(args);
                break;
            case "CardSelection":
                this.enterCardSelection(args);
                break;
            case "CardNameSelection":
                this.enterCardNameSelection(args);
                break;
        }
    }
    onLeavingState(stateName) {
        console.log("Leaving state:", stateName);
        switch (stateName) {
            case "PlayerTurn":
                this.leavePlayerTurn();
                break;
            case "ReactionPhase":
                this.leaveReactionPhase();
                break;
            case "TargetSelection":
                this.leaveTargetSelection();
                break;
            case "DiscardPhase":
                this.leaveDiscardPhase();
                break;
            case "CardSelection":
                this.leaveCardSelection();
                break;
            case "CardNameSelection":
                this.leaveCardNameSelection();
                break;
        }
    }
    onUpdateActionButtons(stateName, args) {
        console.log("onUpdateActionButtons:", stateName, args);
        switch (stateName) {
            case "PlayerTurn":
                this.updatePlayerTurnButtons(args);
                break;
            case "TargetSelection":
                this.updateTargetSelectionButtons(args);
                break;
            case "ReactionPhase":
                this.updateReactionPhaseButtons(args);
                break;
            case "DiscardPhase":
                this.updateDiscardPhaseButtons(args);
                break;
            case "CardSelection":
                this.updateCardSelectionButtons(args);
                setTimeout(() => {
                    this.enterCardSelection(args ?? this.gamedatas.gamestate);
                }, 0);
                break;
        }
    }
    // ========================================================================
    //  PlayerTurn state
    // ========================================================================
    enterPlayerTurn(_args) {
        if (!this.bga.players.isCurrentPlayerActive())
            return;
        this.handStock.setSelectionMode("multiple");
        this.handStock.unselectAll();
        this.handStock.onCardClick = (_card) => {
            this.updatePlayerTurnButtons(this.gamedatas.gamestate.args || null);
        };
    }
    leavePlayerTurn() {
        this.handStock.setSelectionMode("none");
        this.handStock.unselectAll();
        this.handStock.onCardClick = undefined;
    }
    updatePlayerTurnButtons(args) {
        if (!this.bga.players.isCurrentPlayerActive())
            return;
        this.bga.statusBar.removeActionButtons();
        const stateArgs = args?.args ?? args;
        const canDiscardAndDraw = !!stateArgs?.canDiscardAndDraw;
        if (canDiscardAndDraw) {
            this.bga.statusBar.addActionButton(_("Discard and Draw 3"), () => {
                this.bga.actions.performAction("actDiscardAndDraw", {});
            }, { color: "primary" });
        }
        const selectedCards = this.handStock.getSelection();
        const selectedIds = selectedCards.map((c) => c.id);
        const validPlay = getValidPlayFromSelection(this.handStock.getCards(), selectedIds);
        if (validPlay) {
            this.bga.statusBar.addActionButton(validPlay.label, () => this.executePlay(validPlay), { color: "primary" });
        }
        this.bga.statusBar.addActionButton(_("End Turn"), () => {
            this.bga.actions.performAction("actEndTurn", {});
        }, { color: "alert" });
    }
    executePlay(play) {
        if (play.kind === "single") {
            this.bga.actions.performAction("actPlayCard", {
                card_id: play.cardId,
            });
        }
        else {
            this.bga.actions.performAction("actPlayThreesome", {
                card_ids: play.cardIds,
            });
        }
        this.handStock.unselectAll();
    }
    // ========================================================================
    //  TargetSelection state
    // ========================================================================
    leaveTargetSelection() {
        this.selectedTargets = [];
    }
    updateTargetSelectionButtons(args) {
        if (!this.bga.players.isCurrentPlayerActive())
            return;
        if (!args)
            return;
        const a = args.args || args;
        const selectablePlayers = a.selectablePlayers || [];
        const targetCount = a.targetCount || 1;
        const requiresMultipleTargets = !!a.requiresMultipleTargets;
        this.renderTargetButtons(selectablePlayers, targetCount, requiresMultipleTargets);
    }
    renderTargetButtons(selectablePlayers, targetCount, requiresMultipleTargets) {
        this.bga.statusBar.removeActionButtons();
        for (const player of selectablePlayers) {
            const isSelected = this.selectedTargets.includes(player.id);
            const colorBox = player.color
                ? `<span class="player-color-indicator" style="background-color: #${player.color};"></span>`
                : "";
            const name = (player.name || "") + " " + colorBox;
            const buttonText = isSelected
                ? _("Deselect ${player_name}").replace("${player_name}", name)
                : _("Select ${player_name}").replace("${player_name}", name);
            const btn = this.bga.statusBar.addActionButton(buttonText, () => {
                const idx = this.selectedTargets.indexOf(player.id);
                if (idx > -1) {
                    this.selectedTargets.splice(idx, 1);
                }
                else if (this.selectedTargets.length < targetCount) {
                    this.selectedTargets.push(player.id);
                }
                if (this.selectedTargets.length === targetCount &&
                    !requiresMultipleTargets) {
                    this.bga.actions.performAction("actSelectTargets", {
                        targetPlayerIds: this.selectedTargets,
                    });
                    this.selectedTargets = [];
                }
                else {
                    this.renderTargetButtons(selectablePlayers, targetCount, requiresMultipleTargets);
                }
            }, { color: isSelected ? "secondary" : "primary" });
            if (btn && colorBox) {
                btn.innerHTML = buttonText;
            }
        }
        if (requiresMultipleTargets &&
            this.selectedTargets.length === targetCount) {
            this.bga.statusBar.addActionButton(_("Confirm Selection"), () => {
                this.bga.actions.performAction("actSelectTargets", {
                    targetPlayerIds: this.selectedTargets,
                });
                this.selectedTargets = [];
            }, { color: "primary" });
        }
    }
    enterReactionPhase(args) {
        if (args?.reaction_time_seconds) {
            this.reactionTimeSeconds = args.reaction_time_seconds;
        }
        this.reactionActionSent = false;
        this.maybeStartReactionTimer();
    }
    leaveReactionPhase() {
        this.stopReactionTimer();
        this.reactionActionSent = false;
    }
    updateReactionPhaseButtons(args) {
        if (!this.bga.players.isCurrentPlayerActive()) {
            this.stopReactionTimer();
            return;
        }
        if (args?.reaction_time_seconds) {
            this.reactionTimeSeconds = args.reaction_time_seconds;
        }
        this.bga.statusBar.removeActionButtons();
        // Highlight interrupt cards in hand
        const hand = this.handStock.getCards();
        for (const card of hand) {
            const el = this.handStock.getCardElement(card);
            if (el) {
                el.classList.toggle("dlpq-interrupt", isInterruptCard(card));
            }
        }
        this.reactionSkipButton = this.bga.statusBar.addActionButton(_("Skip"), () => this.sendReactionSkip(), { color: "primary" });
        this.maybeStartReactionTimer();
    }
    maybeStartReactionTimer() {
        if (this.gamedatas.gamestate.name !== "ReactionPhase")
            return;
        if (!this.bga.players.isCurrentPlayerActive())
            return;
        if (this.reactionActionSent)
            return;
        if (this.reactionCountdownId !== null ||
            this.reactionAutoSkipId !== null)
            return;
        const seconds = this.reactionTimeSeconds;
        const deadlineMs = Date.now() + seconds * 1000;
        let lastShown = seconds;
        if (this.reactionSkipButton) {
            this.reactionSkipButton.textContent = _("Skip") + ` (${seconds})`;
        }
        this.reactionAutoSkipId = window.setTimeout(() => {
            if (this.gamedatas.gamestate.name !== "ReactionPhase")
                return;
            if (!this.bga.players.isCurrentPlayerActive())
                return;
            if (this.reactionActionSent)
                return;
            this.sendReactionSkip();
        }, seconds * 1000);
        this.reactionCountdownId = window.setInterval(() => {
            if (this.gamedatas.gamestate.name !== "ReactionPhase" ||
                !this.bga.players.isCurrentPlayerActive() ||
                this.reactionActionSent) {
                this.stopReactionTimer();
                return;
            }
            const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
            if (left !== lastShown) {
                lastShown = left;
                if (this.reactionSkipButton) {
                    this.reactionSkipButton.textContent =
                        left > 0 ? _("Skip") + ` (${left})` : _("Skip");
                }
            }
        }, 100);
    }
    sendReactionSkip() {
        if (this.reactionActionSent)
            return;
        if (this.gamedatas.gamestate.name !== "ReactionPhase") {
            this.stopReactionTimer();
            return;
        }
        this.reactionActionSent = true;
        this.bga.actions.performAction("actSkipReaction", {});
        this.stopReactionTimer();
    }
    stopReactionTimer() {
        if (this.reactionCountdownId !== null) {
            clearInterval(this.reactionCountdownId);
            this.reactionCountdownId = null;
        }
        if (this.reactionAutoSkipId !== null) {
            clearTimeout(this.reactionAutoSkipId);
            this.reactionAutoSkipId = null;
        }
        this.reactionSkipButton = null;
    }
    // ========================================================================
    //  DiscardPhase state
    // ========================================================================
    enterDiscardPhase(args) {
        if (!this.bga.players.isCurrentPlayerActive())
            return;
        this.handStock.setSelectionMode("multiple");
        this.handStock.unselectAll();
        this.handStock.onCardClick = (_card) => {
            this.updateDiscardPhaseButtons(args);
        };
    }
    leaveDiscardPhase() {
        this.handStock.setSelectionMode("none");
        this.handStock.unselectAll();
        this.handStock.onCardClick = undefined;
    }
    updateDiscardPhaseButtons(args) {
        if (!this.bga.players.isCurrentPlayerActive())
            return;
        this.bga.statusBar.removeActionButtons();
        const handSize = this.handStock.getCards().length;
        const selectedCount = this.handStock.getSelection().length;
        const cardsToDiscard = Math.max(0, handSize - 7);
        if (cardsToDiscard <= 0)
            return;
        let label;
        let disabled = false;
        if (selectedCount < cardsToDiscard) {
            const remaining = cardsToDiscard - selectedCount;
            const word = remaining === 1 ? "card" : "cards";
            label = _("Select ${count} more ${cardWord}")
                .replace("${count}", String(remaining))
                .replace("${cardWord}", word);
            disabled = true;
        }
        else if (selectedCount > cardsToDiscard) {
            const excess = selectedCount - cardsToDiscard;
            const word = excess === 1 ? "card" : "cards";
            label = _("Unselect ${count} more ${cardWord}")
                .replace("${count}", String(excess))
                .replace("${cardWord}", word);
            disabled = true;
        }
        else {
            const word = selectedCount === 1 ? "card" : "cards";
            label = _("Discard ${count} ${cardWord}")
                .replace("${count}", String(selectedCount))
                .replace("${cardWord}", word);
        }
        this.bga.statusBar.addActionButton(label, () => {
            const cardIds = this.handStock
                .getSelection()
                .map((c) => c.id);
            if (this.handStock.getCards().length - cardIds.length !== 7)
                return;
            this.bga.actions.performAction("actDiscardCards", {
                card_ids: cardIds,
            });
            this.handStock.unselectAll();
            this.bga.statusBar.removeActionButtons();
        }, { color: "primary", disabled });
    }
    async enterCardSelection(args) {
        if (!this.bga.players.isCurrentPlayerActive())
            return;
        const a = args?.args || args || {};
        const targetPlayerId = this.asInt(a.targetPlayerId) ?? 0;
        const revealedCards = a.revealedCards || [];
        const cardBacks = a.cardBacks || [];
        const tokens = revealedCards.length > 0
            ? revealedCards.map((rc) => ({ selectToken: rc.selectToken }))
            : cardBacks.map((cb) => ({ selectToken: cb.selectToken }));
        if (targetPlayerId === 0 || tokens.length === 0)
            return;
        const stock = this.opponentHandStocks.get(targetPlayerId);
        if (!stock)
            return;
        this.hideCardSelectionUI();
        const area = document.querySelector(`.dlpq-opponent-hand-area[data-player-id="${targetPlayerId}"]`);
        if (area) {
            area.classList.add("dlpq-card-selection-target");
        }
        let selectionDone = false;
        const doSelect = (index) => {
            if (selectionDone)
                return;
            const token = tokens[index]?.selectToken;
            if (token) {
                selectionDone = true;
                this.bga.actions.performAction("actSelectCard", { selectToken: token });
                this.hideCardSelectionUI();
            }
        };
        if (revealedCards.length > 0) {
            const currentCards = stock.getCards();
            await stock.removeAll();
            const cardsToAdd = revealedCards.map((rc) => ({
                id: rc.card_id ?? rc.id,
                type: rc.type ?? rc.card_type,
                type_arg: rc.type_arg ?? rc.card_type_arg,
            }));
            await stock.addCards(cardsToAdd);
            this.cardSelectionState = {
                targetPlayerId,
                tokens,
                restoredFakeCards: currentCards,
            };
        }
        else {
            const currentCards = stock.getCards();
            if (currentCards.length !== tokens.length)
                return;
            // Do NOT remove/re-add: bga-cards throws "card element exists but is not attached to any Stock"
            // when re-adding removed cards. Server already shuffles tokens, so client order is fine.
            this.cardSelectionState = { targetPlayerId, tokens };
        }
        const handleCardClick = (index) => {
            if (index >= 0 && index < tokens.length) {
                doSelect(index);
            }
        };
        stock.setSelectionMode("single");
        const cardsContainer = stock.element;
        const delegatedClick = (e) => {
            const card = e.target.closest(".bga-cards_card");
            if (!card || !cardsContainer.contains(card))
                return;
            e.preventDefault();
            e.stopPropagation();
            const cards = Array.from(cardsContainer.querySelectorAll(".bga-cards_card"));
            const index = cards.indexOf(card);
            if (index >= 0)
                handleCardClick(index);
        };
        cardsContainer.addEventListener("click", delegatedClick, true);
        this._cardSelectionCleanup = () => {
            stock.setSelectionMode("none");
            stock.onCardClick = undefined;
            cardsContainer.removeEventListener("click", delegatedClick, true);
            this.bga.statusBar.removeActionButtons();
            this._cardSelectionCleanup = null;
        };
    }
    updateCardSelectionButtons(args) {
        if (!this.bga.players.isCurrentPlayerActive())
            return;
        this.bga.statusBar.removeActionButtons();
        const a = args?.args || args || {};
        const revealedCards = a.revealedCards || [];
        const cardBacks = a.cardBacks || [];
        const tokens = revealedCards.length > 0
            ? revealedCards.map((rc) => rc.selectToken)
            : cardBacks.map((cb) => cb.selectToken);
        if (tokens.length === 0)
            return;
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const label = _("Select card") + " " + (i + 1);
            this.bga.statusBar.addActionButton(label, () => {
                this.bga.actions.performAction("actSelectCard", { selectToken: token });
                this.hideCardSelectionUI();
            });
        }
    }
    leaveCardSelection() {
        this.hideCardSelectionUI();
    }
    hideCardSelectionUI() {
        const cleanup = this._cardSelectionCleanup;
        if (typeof cleanup === "function") {
            cleanup();
        }
        const state = this.cardSelectionState;
        this.cardSelectionState = null;
        if (state) {
            const area = document.querySelector(`.dlpq-opponent-hand-area[data-player-id="${state.targetPlayerId}"]`);
            if (area) {
                area.classList.remove("dlpq-card-selection-target");
            }
            const stock = this.opponentHandStocks.get(state.targetPlayerId);
            if (stock && state.restoredFakeCards) {
                stock.removeAll();
                const handSizeAfterSteal = Math.max(0, state.restoredFakeCards.length - 1);
                const fakeCards = [];
                for (let i = 0; i < handSizeAfterSteal; i++) {
                    fakeCards.push({
                        id: -(state.targetPlayerId * 10000 + i),
                    });
                }
                if (fakeCards.length > 0) {
                    stock.addCards(fakeCards);
                }
            }
        }
    }
    // ========================================================================
    //  CardNameSelection state
    // ========================================================================
    enterCardNameSelection(args) {
        if (!this.bga.players.isCurrentPlayerActive())
            return;
        const a = args?.args || args || {};
        const cardNames = a.cardNames || {};
        this.showCardNameSelectionUI(cardNames);
    }
    leaveCardNameSelection() {
        this.hideCardNameSelectionUI();
    }
    showCardNameSelectionUI(cardNames) {
        this.hideCardNameSelectionUI();
        const container = document.createElement("div");
        container.id = "dlpq-card-name-selection";
        container.className = "whiteblock";
        container.innerHTML = `<b>${_("Select a card name")}</b><div id="dlpq-card-name-buttons" style="display:flex;gap:8px;flex-wrap:wrap;padding:12px;justify-content:center;"></div>`;
        const gameArea = this.bga.gameArea.getElement();
        gameArea.appendChild(container);
        const buttonsDiv = document.getElementById("dlpq-card-name-buttons");
        for (const [key, name] of Object.entries(cardNames)) {
            const btn = document.createElement("button");
            btn.className = "bgabutton bgabutton_blue";
            btn.textContent = _(name);
            btn.addEventListener("click", () => {
                this.bga.actions.performAction("actSelectCardName", {
                    cardName: key,
                });
                this.hideCardNameSelectionUI();
            });
            buttonsDiv.appendChild(btn);
        }
    }
    hideCardNameSelectionUI() {
        const el = document.getElementById("dlpq-card-name-selection");
        if (el)
            el.remove();
    }
    // ========================================================================
    //  Notifications
    // ========================================================================
    setupNotifications() {
        console.log("notifications subscriptions setup");
        this.bga.notifications.setupPromiseNotifications({
            handlers: [this],
        });
    }
    async notif_handUpdated(args) {
        if (Array.isArray(args.hand)) {
            this.replaceHand(args.hand);
            const pid = this.myPlayerId();
            if (pid && this.gamedatas.players?.[pid]) {
                this.gamedatas.players[pid].handCount =
                    args.hand.length;
                this.updatePlayerCardCount(pid);
            }
        }
        const dc = this.asInt(args.deckCount);
        if (dc !== null) {
            this.setDeckCount(dc);
        }
    }
    async notif_cardPlayed(args) {
        const playerId = this.asInt(args.player_id);
        const cardId = this.asInt(args.card_id);
        if (cardId !== null && playerId === this.myPlayerId()) {
            this.removeCardFromHand(cardId);
        }
        if (playerId !== null &&
            playerId !== this.myPlayerId()) {
            const p = this.gamedatas.players?.[playerId];
            if (p) {
                const cur = Number(p.handCount ?? 0);
                p.handCount = Math.max(0, cur - 1);
                this.updatePlayerCardCount(playerId);
            }
        }
    }
    async notif_threesomePlayed(args) {
        const playerId = this.asInt(args.player_id);
        const delta = this.asInt(args.golden_potatoes) ?? 0;
        if (playerId !== null && delta !== 0) {
            await this.applyGoldenPotatoesDelta(playerId, delta);
        }
    }
    async notif_threesomeScored(args) {
        const playerId = this.asInt(args.player_id);
        const delta = this.asInt(args.golden_potatoes) ?? 0;
        if (playerId !== null && delta !== 0) {
            await this.applyGoldenPotatoesDelta(playerId, delta);
        }
    }
    async notif_cardMovedToDiscard(args) {
        const cardId = this.asInt(args.card_id);
        const cardType = typeof args.card_type === "string" ? args.card_type : null;
        const cardTypeArg = this.asInt(args.card_type_arg);
        if (cardId === null || !cardType || cardTypeArg === null)
            return;
        // Remove tooltip from the previous top card before adding a new one
        const prevCards = this.discardPile.getCards();
        if (prevCards.length > 0) {
            this.removeDiscardTooltip(prevCards[prevCards.length - 1]);
        }
        const card = { id: cardId, type: cardType, type_arg: cardTypeArg };
        await this.discardPile.addCard(card);
        this.applyDeterministicTransform(card);
    }
    async notif_cardCancelled(args) {
        const cardId = this.asInt(args.card_id);
        if (cardId === null)
            return;
        const card = this.discardPile
            .getCards()
            .find((c) => c.id === cardId);
        if (card) {
            this.discardPile.removeCard(card);
        }
    }
    async notif_threesomeCancelled(_args) {
        // No-op
    }
    async notif_cardDrawn(args) {
        this.decDeckCount(1);
        const playerId = this.asInt(args.player_id);
        if (playerId === this.myPlayerId()) {
            if (args.card_type && args.card_type_arg !== undefined) {
                const card = {
                    id: args.card_id,
                    type: args.card_type,
                    type_arg: args.card_type_arg,
                };
                await this.addCardToHandWithDrawAnimation(card);
            }
        }
        if (playerId !== null) {
            const p = this.gamedatas.players?.[playerId];
            if (p) {
                const cur = Number(p.handCount ?? 0);
                p.handCount = cur + 1;
                this.updatePlayerCardCount(playerId);
            }
        }
    }
    async notif_cardsDiscarded(args) {
        const playerId = this.asInt(args.player_id);
        if (Array.isArray(args.card_ids)) {
            const ids = new Set(args.card_ids.map((x) => this.asInt(x)).filter((x) => x !== null));
            const hand = this.handStock.getCards();
            for (const card of hand) {
                if (ids.has(card.id)) {
                    this.handStock.removeCard(card);
                }
            }
            this.syncHandToGamedata();
        }
        if (playerId !== null) {
            const p = this.gamedatas.players?.[playerId];
            if (p) {
                const discounted = Array.isArray(args.card_ids)
                    ? args.card_ids.length
                    : 0;
                const cur = Number(p.handCount ?? 0);
                p.handCount = Math.max(0, cur - discounted);
                this.updatePlayerCardCount(playerId);
            }
        }
        const top = args.discard_top_card;
        if (top && typeof top === "object") {
            const id = this.asInt(top.id);
            const type = typeof top.type === "string" ? top.type : null;
            const typeArg = this.asInt(top.type_arg);
            if (id !== null && type && typeArg !== null) {
                const prevCards = this.discardPile.getCards();
                if (prevCards.length > 0) {
                    this.removeDiscardTooltip(prevCards[prevCards.length - 1]);
                }
                const card = { id, type, type_arg: typeArg };
                await this.discardPile.addCard(card);
                this.applyDeterministicTransform(card);
            }
        }
    }
    async notif_turnEnded(_args) {
        // No-op
    }
    async notif_emptyHandDraw(args) {
        const dc = this.asInt(args.deckCount);
        if (dc !== null) {
            this.setDeckCount(dc);
        }
        else {
            this.decDeckCount(3);
        }
        const playerId = this.asInt(args.player_id);
        if (playerId !== null) {
            const p = this.gamedatas.players?.[playerId];
            if (p) {
                p.handCount = 3;
                this.updatePlayerCardCount(playerId);
            }
        }
    }
    async notif_discardAndDraw(args) {
        const dc = this.asInt(args.deckCount);
        if (dc !== null) {
            this.setDeckCount(dc);
        }
        else {
            this.decDeckCount(3);
        }
        const playerId = this.asInt(args.player_id);
        if (playerId !== null) {
            const p = this.gamedatas.players?.[playerId];
            if (p) {
                p.handCount = 3;
                this.updatePlayerCardCount(playerId);
            }
        }
    }
    async notif_deckReshuffled(args) {
        const dc = this.asInt(args.deckCount);
        if (dc !== null) {
            this.setDeckCount(dc);
        }
        this.discardPile.removeAll();
    }
    async notif_getOffThePony(args) {
        const playerId = this.asInt(args.player_id);
        const dc = this.asInt(args.deckCount);
        if (dc !== null)
            this.setDeckCount(dc);
        if (playerId !== null && playerId !== this.myPlayerId()) {
            const p = this.gamedatas.players?.[playerId];
            if (p) {
                const cur = Number(p.handCount ?? 0);
                p.handCount = cur + 2;
                this.updatePlayerCardCount(playerId);
            }
        }
    }
    async notif_lendMeABuck(args) {
        const cardId = this.asInt(args.card_id);
        const targetPlayerId = this.asInt(args.target_player_id);
        const playerId = this.asInt(args.player_id);
        if (targetPlayerId === this.myPlayerId() && cardId !== null) {
            this.removeCardFromHand(cardId);
        }
        if (playerId === this.myPlayerId() && cardId !== null) {
            const type = args.card_type;
            const typeArg = this.asInt(args.card_type_arg);
            const card = type && typeArg !== null
                ? { id: cardId, type, type_arg: typeArg }
                : this.getRevealedCardFromCache(cardId);
            if (card) {
                await this.addCardToHandWithStealAnimation(card, targetPlayerId);
            }
        }
        this.adjustCardCountForSteal(targetPlayerId, playerId);
    }
    async notif_popePotato(args) {
        const cardId = this.asInt(args.card_id);
        const targetPlayerId = this.asInt(args.target_player_id);
        const playerId = this.asInt(args.player_id);
        if (targetPlayerId === this.myPlayerId() && cardId !== null) {
            this.removeCardFromHand(cardId);
        }
        if (playerId === this.myPlayerId() && cardId !== null) {
            const type = args.card_type;
            const typeArg = this.asInt(args.card_type_arg);
            const card = type && typeArg !== null
                ? { id: cardId, type, type_arg: typeArg }
                : this.getRevealedCardFromCache(cardId);
            if (card) {
                await this.addCardToHandWithStealAnimation(card, targetPlayerId);
            }
        }
        this.adjustCardCountForSteal(targetPlayerId, playerId);
    }
    async notif_popePotatoFail(_args) {
        // No-op
    }
    async notif_potatoDawan(args) {
        const cardId = this.asInt(args.card_id);
        const targetPlayerId = this.asInt(args.target_player_id);
        const playerId = this.asInt(args.player_id);
        if (targetPlayerId === this.myPlayerId() && cardId !== null) {
            this.removeCardFromHand(cardId);
        }
        if (playerId === this.myPlayerId() && cardId !== null) {
            const type = args.card_type;
            const typeArg = this.asInt(args.card_type_arg);
            const card = type && typeArg !== null
                ? { id: cardId, type, type_arg: typeArg }
                : this.getRevealedCardFromCache(cardId);
            if (card) {
                await this.addCardToHandWithStealAnimation(card, targetPlayerId);
            }
        }
        this.adjustCardCountForSteal(targetPlayerId, playerId);
    }
    async notif_lookAhead(args) {
        const targetPlayerId = this.asInt(args.target_player_id);
        if (targetPlayerId !== null) {
            await this.applyGoldenPotatoesDelta(targetPlayerId, -1);
        }
    }
    async notif_potatoOfTheYear(args) {
        const playerId = this.asInt(args.player_id);
        if (playerId !== null) {
            await this.applyGoldenPotatoesDelta(playerId, 1);
        }
    }
    async notif_potatoOfDestiny(args) {
        const dc = this.asInt(args.deckCount);
        if (dc !== null)
            this.setDeckCount(dc);
        const targetPlayerId = this.asInt(args.target_player_id);
        if (targetPlayerId !== null) {
            const p = this.gamedatas.players?.[targetPlayerId];
            if (p) {
                p.handCount = 2;
                this.updatePlayerCardCount(targetPlayerId);
            }
        }
    }
    async notif_harryPotato(args) {
        const dc = this.asInt(args.deckCount);
        if (dc !== null)
            this.setDeckCount(dc);
        const playerId = this.asInt(args.player_id);
        if (playerId !== null && playerId !== this.myPlayerId()) {
            const p = this.gamedatas.players?.[playerId];
            if (p) {
                const cur = Number(p.handCount ?? 0);
                p.handCount = cur + 2;
                this.updatePlayerCardCount(playerId);
            }
        }
    }
    async notif_runawayPotatoes(_args) {
        // No-op: deck count updated via handUpdated
    }
    async notif_spiderPotato(args) {
        const p1 = this.asInt(args.player1_id);
        const p2 = this.asInt(args.player2_id);
        if (p1 === null || p2 === null)
            return;
        const p1New = this.asInt(args.player1_handCount);
        const p2New = this.asInt(args.player2_handCount);
        if (p1New !== null && p2New !== null) {
            this.gamedatas.players[p1].handCount = p1New;
            this.gamedatas.players[p2].handCount = p2New;
        }
        else {
            const c1 = Number(this.gamedatas.players[p1]?.handCount ?? 0);
            const c2 = Number(this.gamedatas.players[p2]?.handCount ?? 0);
            this.gamedatas.players[p1].handCount = c2;
            this.gamedatas.players[p2].handCount = c1;
        }
        this.updatePlayerCardCount(p1);
        this.updatePlayerCardCount(p2);
    }
    async notif_cardSelected(args) {
        const cardId = this.asInt(args.card_id);
        const typeArg = this.asInt(args.card_type_arg);
        if (cardId !== null &&
            typeof args.card_type === "string" &&
            typeArg !== null) {
            this.cacheRevealedCard({
                id: cardId,
                type: args.card_type,
                type_arg: typeArg,
            });
        }
    }
    async notif_cardNameSelected(_args) {
        // No-op
    }
    async notif_jumpToTheSide(args) {
        const dc = this.asInt(args.deckCount);
        if (dc !== null)
            this.setDeckCount(dc);
    }
    async notif_papageddonOrder(_args) {
        // No-op
    }
    async notif_papageddonSteal(args) {
        const cardId = this.asInt(args.card_id);
        const targetPlayerId = this.asInt(args.target_player_id);
        const playerId = this.asInt(args.player_id);
        if (targetPlayerId === this.myPlayerId() && cardId !== null) {
            this.removeCardFromHand(cardId);
        }
        this.adjustCardCountForSteal(targetPlayerId, playerId);
    }
    async notif_papageddonStealPrivate(args) {
        const cardId = this.asInt(args.card_id);
        const targetPlayerId = this.asInt(args.target_player_id);
        const playerId = this.asInt(args.player_id);
        if (playerId !== this.myPlayerId() || cardId === null)
            return;
        const type = args.card_type;
        const typeArg = this.asInt(args.card_type_arg);
        const card = type && typeArg !== null
            ? { id: cardId, type, type_arg: typeArg }
            : this.getRevealedCardFromCache(cardId);
        if (card) {
            await this.addCardToHandWithStealAnimation(card, targetPlayerId);
        }
    }
    adjustCardCountForSteal(targetPlayerId, playerId) {
        if (targetPlayerId !== null) {
            const p = this.gamedatas.players?.[targetPlayerId];
            if (p) {
                const cur = Number(p.handCount ?? 0);
                p.handCount = Math.max(0, cur - 1);
                this.updatePlayerCardCount(targetPlayerId);
            }
        }
        if (playerId !== null && playerId !== targetPlayerId) {
            const p = this.gamedatas.players?.[playerId];
            if (p) {
                const cur = Number(p.handCount ?? 0);
                p.handCount = cur + 1;
                this.updatePlayerCardCount(playerId);
            }
        }
    }
}

const BgaAnimations = await importEsmLib("bga-animations", "1.x");
const BgaCards = await importEsmLib("bga-cards", "1.x");
Game.setBgaLibs(BgaAnimations, BgaCards);

export { Game };
