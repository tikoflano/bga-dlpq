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
            return _("Steal 1 card from a target player’s hand (blind selection).");
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

class DeckView {
    setCount(count) {
        const deckCountEl = document.querySelector("#deck-card .deck-count");
        if (deckCountEl) {
            deckCountEl.textContent = count.toString();
        }
    }
}

class DiscardView {
    render(card) {
        const discardCardEl = document.getElementById("discard-card");
        if (!discardCardEl)
            return;
        if (card) {
            const cardName = getCardName(card);
            const cardValue = getCardValue(card);
            discardCardEl.innerHTML = `
                <div class="card-type">${card.type}</div>
                <div class="card-name">${cardName}</div>
                <div class="card-value">Value: ${cardValue}</div>
            `;
            discardCardEl.classList.remove("empty");
            // Tooltip is handled by Game.ts so it can use BGA's addTooltipHtml/removeTooltip.
            return;
        }
        discardCardEl.innerHTML = '<div class="card-placeholder">Discard Pile</div>';
        discardCardEl.classList.add("empty");
    }
}

class GoldenPotatoView {
    /**
     * Cards are double-sided: one side shows 1, the other shows 2.
     * Display uses as many \"2\" cards as possible, then a \"1\" card if needed.
     */
    render(count) {
        const cardsContainer = document.getElementById("golden-potato-cards");
        if (!cardsContainer)
            return;
        cardsContainer.innerHTML = "";
        if (count === 0)
            return;
        const cardsWith2 = Math.floor(count / 2);
        const cardsWith1 = count % 2;
        for (let i = 0; i < cardsWith2; i++) {
            const cardDiv = document.createElement("div");
            cardDiv.className = "golden-potato-card";
            cardDiv.innerHTML = `
                <div class="potato-value">2</div>
                <div class="potato-label">Golden Potato</div>
            `;
            cardsContainer.appendChild(cardDiv);
        }
        if (cardsWith1 > 0) {
            const cardDiv = document.createElement("div");
            cardDiv.className = "golden-potato-card";
            cardDiv.innerHTML = `
                <div class="potato-value">1</div>
                <div class="potato-label">Golden Potato</div>
            `;
            cardsContainer.appendChild(cardDiv);
        }
    }
}

class HandView {
    render(args) {
        const handArea = document.getElementById("hand-area");
        if (!handArea)
            return;
        handArea.innerHTML = '<h3>Your Hand</h3><div id="hand-cards"></div>';
        const handCards = document.getElementById("hand-cards");
        if (!handCards)
            return;
        args.hand.forEach((card) => {
            const cardDiv = document.createElement("div");
            cardDiv.className = "card";
            cardDiv.id = `dlpq-card-hand-${card.id}`;
            cardDiv.dataset.cardId = card.id.toString();
            const cardName = getCardName(card);
            const cardValue = getCardValue(card);
            const decoded = decodeCardTypeArg(card.type_arg || 0);
            const interrupt = isInterruptCard(card);
            cardDiv.innerHTML = `
                ${decoded.isAlarm ? '<div class="alarm-dot" title="' + _("Alarm") + '"></div>' : ""}
                <div class="card-type">${card.type}</div>
                <div class="card-name">${cardName}</div>
                <div class="card-value">Value: ${cardValue}</div>
            `;
            cardDiv.addEventListener("click", () => args.onCardClick(card.id));
            if (args.selectedCardIds.includes(card.id)) {
                cardDiv.classList.add("selected");
            }
            if (args.isReactionPhase && interrupt) {
                cardDiv.classList.add("interrupt-card");
            }
            handCards.appendChild(cardDiv);
            // Attach tooltip after element is in DOM.
            if (args.attachTooltip) {
                args.attachTooltip(cardDiv.id, getCardTooltipHtml(card));
            }
        });
    }
}

class ActionResolutionState {
    constructor(game) {
        this.game = game;
    }
    onEnter(_args) {
        if (this.game.getGamedatas().hand) {
            this.game.updateHand(this.game.getGamedatas().hand);
        }
    }
}

class CardNameSelectionState {
    constructor(game) {
        this.game = game;
        this.dialog = null;
    }
    onEnter(args) {
        const a = args?.args || args;
        this.show(a);
    }
    onLeave() {
        this.hide();
    }
    show(args) {
        if (!this.game.bga.gameui.isCurrentPlayerActive())
            return;
        this.hide();
        this.dialog = new ebg.popindialog();
        this.dialog.create("card-name-selection-dialog");
        this.dialog.setTitle(_("Name a card"));
        this.dialog.setMaxWidth(500);
        this.dialog.hideCloseIcon();
        const cardNames = args?.cardNames || {};
        let contentHtml = `
      <div id="card-name-selection-content" style="padding: 20px;">
        <div style="margin-bottom: 15px;">
          <label for="card-type-select" style="display: block; margin-bottom: 5px; font-weight: bold;">${_("Card Type")}</label>
          <select id="card-type-select" class="card-type-select" style="width: 100%; padding: 8px; font-size: 14px;">
            <option value="">${_("Select card type...")}</option>
          </select>
        </div>
        <div style="margin-bottom: 15px;">
          <label for="card-name-select" style="display: block; margin-bottom: 5px; font-weight: bold;">${_("Card Name")}</label>
          <select id="card-name-select" class="card-name-select" disabled style="width: 100%; padding: 8px; font-size: 14px;">
            <option value="">${_("Select card name...")}</option>
          </select>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <button id="confirm-card-name" class="bgabutton" disabled style="cursor: not-allowed;">${_("Confirm")}</button>
        </div>
      </div>
    `;
        this.dialog.setContent(contentHtml);
        this.dialog.show();
        setTimeout(() => {
            const cardTypeSelect = document.getElementById("card-type-select");
            const cardNameSelect = document.getElementById("card-name-select");
            const confirmBtn = document.getElementById("confirm-card-name");
            if (!cardTypeSelect || !cardNameSelect || !confirmBtn)
                return;
            // Populate card type dropdown
            if (cardNames && Object.keys(cardNames).length > 0) {
                Object.keys(cardNames).forEach((cardType) => {
                    const option = document.createElement("option");
                    option.value = cardType;
                    option.textContent = cardType.charAt(0).toUpperCase() + cardType.slice(1);
                    cardTypeSelect.appendChild(option);
                });
            }
            const updateConfirmButton = () => {
                const hasSelection = cardTypeSelect.value && cardNameSelect.value;
                confirmBtn.disabled = !hasSelection;
                if (hasSelection) {
                    confirmBtn.classList.add("bgabutton_blue");
                    confirmBtn.style.cursor = "pointer";
                }
                else {
                    confirmBtn.classList.remove("bgabutton_blue");
                    confirmBtn.style.cursor = "not-allowed";
                }
            };
            cardTypeSelect.addEventListener("change", () => {
                const selectedType = cardTypeSelect.value;
                cardNameSelect.innerHTML = '<option value="">' + _("Select card name...") + "</option>";
                cardNameSelect.disabled = !selectedType;
                if (selectedType && cardNames[selectedType]) {
                    Object.keys(cardNames[selectedType]).forEach((nameIndex) => {
                        const option = document.createElement("option");
                        option.value = nameIndex;
                        option.textContent = cardNames[selectedType][nameIndex];
                        cardNameSelect.appendChild(option);
                    });
                }
                updateConfirmButton();
            });
            cardNameSelect.addEventListener("change", () => {
                updateConfirmButton();
            });
            confirmBtn.addEventListener("click", () => {
                const cardType = cardTypeSelect.value;
                const nameIndex = parseInt(cardNameSelect.value);
                if (cardType && nameIndex) {
                    this.game.bga.actions.performAction("actSelectCardName", {
                        cardType: cardType,
                        nameIndex: nameIndex,
                    });
                    this.hide();
                }
            });
        }, 100);
    }
    hide() {
        if (this.dialog) {
            this.dialog.hide();
            this.dialog.destroy();
            this.dialog = null;
        }
    }
}

class CardSelectionState {
    constructor(game) {
        this.game = game;
        this.dialog = null;
    }
    /**
     * Generate HTML for a player color indicator box
     */
    getPlayerColorBox(color) {
        if (!color)
            return "";
        // Ensure color is in hex format (add # if missing)
        const hexColor = color.startsWith("#") ? color : `#${color}`;
        return `<span class="player-color-indicator" style="background-color: ${hexColor};"></span>`;
    }
    onEnter(args) {
        const a = args?.args || args;
        this.show(a);
    }
    onLeave() {
        this.hide();
    }
    show(args) {
        if (!this.game.bga.gameui.isCurrentPlayerActive())
            return;
        this.hide();
        this.dialog = new ebg.popindialog();
        this.dialog.create("card-selection-dialog");
        const targetName = args.targetPlayerName || "";
        this.dialog.setTitle(_("Select a card from ${target_name}'s hand").replace("${target_name}", targetName));
        this.dialog.setMaxWidth(600);
        this.dialog.hideCloseIcon();
        let cardsHtml = '<div id="card-selection-cards" style="text-align: center; padding: 20px;">';
        if (args.cardBacks && Array.isArray(args.cardBacks)) {
            args.cardBacks.forEach((cardBack) => {
                cardsHtml += `
          <div class="card-back" 
               data-position="${cardBack.position}" 
               style="width: 60px; height: 90px; background-color: #8B0000; border: 2px solid #000; border-radius: 5px; cursor: pointer; display: inline-block; margin: 5px;">
          </div>
        `;
            });
        }
        cardsHtml += "</div>";
        this.dialog.setContent(cardsHtml);
        this.dialog.show();
        setTimeout(() => {
            const cardsDiv = document.getElementById("card-selection-cards");
            if (!cardsDiv)
                return;
            const cardBacks = cardsDiv.querySelectorAll(".card-back");
            cardBacks.forEach((backDiv) => {
                backDiv.addEventListener("click", () => {
                    const position = parseInt(backDiv.dataset.position || "0");
                    this.game.bga.actions.performAction("actSelectCard", {
                        cardPosition: position,
                    });
                    this.hide();
                });
            });
        }, 100);
    }
    hide() {
        if (this.dialog) {
            this.dialog.hide();
            this.dialog.destroy();
            this.dialog = null;
        }
    }
}

class DiscardPhaseState {
    constructor(game) {
        this.game = game;
    }
    onEnter(args) {
        // Discard-to-7 UI should be handled via:
        // - clicking cards in hand to select
        // - a status-bar button that submits the discard when the selection is valid
        // So we explicitly remove any legacy UI block (older builds) and just rely on the hand rendering.
        this.hide();
        this.game.clearSelectedCards();
        this.game.updateHand(this.game.getGamedatas().hand || []);
        this.onUpdateActionButtons(args);
    }
    onUpdateActionButtons(args) {
        if (!this.game.bga.gameui.isCurrentPlayerActive())
            return;
        // BGA sometimes wraps state args as { args: ... }.
        const a = args?.args || args || {};
        this.game.bga.statusBar.removeActionButtons();
        const handSize = (this.game.getGamedatas().hand || []).length;
        const selectedCount = this.game.getSelectedCards().length;
        const cardsToDiscard = Math.max(0, handSize - 7);
        // Only show the action if the selection would leave exactly 7 cards.
        if (cardsToDiscard > 0 && selectedCount === cardsToDiscard) {
            const label = _("Discard ${count} cards").replace("${count}", String(selectedCount));
            this.game.bga.statusBar.addActionButton(label, () => {
                const cardIds = this.game.getSelectedCards().slice();
                // Defensive: only submit if still valid at click-time.
                if ((this.game.getGamedatas().hand || []).length - cardIds.length !== 7)
                    return;
                this.game.bga.actions.performAction("actDiscardCards", { card_ids: cardIds });
                this.game.clearSelectedCards();
                this.game.updateHand(this.game.getGamedatas().hand || []);
                this.game.bga.statusBar.removeActionButtons();
            }, { color: "primary" });
        }
        else if (a) {
            // No button: status bar text is enough, per UX requirement.
        }
    }
    onLeave() {
        this.hide();
        this.game.clearSelectedCards();
        this.game.updateHand(this.game.getGamedatas().hand || []);
    }
    hide() {
        const discardDiv = document.getElementById("discard-phase-ui");
        if (discardDiv)
            discardDiv.remove();
    }
}

class PlayerTurnState {
    constructor(game) {
        this.game = game;
    }
    onEnter(args) {
        this.game.clearSelectedCards();
        if (this.game.getGamedatas().hand) {
            this.game.updateHand(this.game.getGamedatas().hand || []);
        }
        if (!this.game.bga.gameui.isCurrentPlayerActive())
            return;
        this.game.bga.statusBar.removeActionButtons();
        const canDiscardAndDraw = !!(args?.canDiscardAndDraw ?? args?.args?.canDiscardAndDraw);
        if (canDiscardAndDraw) {
            this.game.bga.statusBar.addActionButton(_("Discard and Draw 3"), () => {
                this.game.bga.actions.performAction("actDiscardAndDraw", {});
            }, { color: "primary" });
        }
        // Add "End Turn" button last so it stays far right
        this.game.bga.statusBar.addActionButton(_("End Turn"), () => {
            this.game.bga.actions.performAction("actEndTurn", {});
        }, { color: "alert", classes: ["bgabutton", "bgabutton_red"] });
    }
    onUpdateActionButtons(args) {
        if (!this.game.bga.gameui.isCurrentPlayerActive())
            return;
        this.game.bga.statusBar.removeActionButtons();
        const canDiscardAndDraw = !!(args?.canDiscardAndDraw ?? args?.args?.canDiscardAndDraw);
        if (canDiscardAndDraw) {
            this.game.bga.statusBar.addActionButton(_("Discard and Draw 3"), () => {
                this.game.bga.actions.performAction("actDiscardAndDraw", {});
            }, { color: "primary" });
        }
        const validPlay = getValidPlayFromSelection(this.game.getGamedatas().hand, this.game.getSelectedCards());
        if (validPlay) {
            this.game.bga.statusBar.addActionButton(validPlay.label, () => {
                if (validPlay.kind === "single") {
                    this.game.bga.actions.performAction("actPlayCard", { card_id: validPlay.cardId });
                }
                else {
                    this.game.bga.actions.performAction("actPlayThreesome", { card_ids: validPlay.cardIds });
                }
                this.game.clearSelectedCards();
                this.game.updateHand(this.game.getGamedatas().hand || []);
                this.game.onUpdateActionButtons("PlayerTurn", this.game.getGamedatas().gamestate.args || null);
            }, { color: "primary" });
        }
        // Add "End Turn" button last so it stays far right
        this.game.bga.statusBar.addActionButton(_("End Turn"), () => {
            this.game.bga.actions.performAction("actEndTurn", {});
        }, { color: "alert", classes: ["bgabutton", "bgabutton_red"] });
    }
}

class ReactionPhaseState {
    constructor(game) {
        this.game = game;
        this.countdownIntervalId = null;
        this.autoSkipTimeoutId = null;
        this.skipButton = null;
        this.reactionTimeSeconds = 7; // Default, will be updated from args
    }
    onEnter(args) {
        // Get reaction time from args if available
        if (args && typeof args.reaction_time_seconds === 'number') {
            this.reactionTimeSeconds = args.reaction_time_seconds;
        }
        this.game.resetReactionActionSent();
        this.maybeStartTimer();
    }
    onLeave() {
        this.stopTimer();
        this.game.resetReactionActionSent();
        // Best effort: refresh hand to remove interrupt highlighting.
        this.game.updateHand(this.game.getGamedatas().hand || []);
    }
    onUpdateActionButtons(args) {
        // MULTIPLE_ACTIVE_PLAYER: use players.isCurrentPlayerActive()
        if (!this.game.bga.players.isCurrentPlayerActive()) {
            this.stopTimer();
            return;
        }
        // Update reaction time from args if available
        if (args && typeof args.reaction_time_seconds === 'number') {
            this.reactionTimeSeconds = args.reaction_time_seconds;
        }
        this.game.bga.statusBar.removeActionButtons();
        // Refresh hand to highlight interrupt cards
        if (this.game.getGamedatas().hand) {
            this.game.updateHand(this.game.getGamedatas().hand);
        }
        // Add "Skip" button for all active players
        this.skipButton = this.game.bga.statusBar.addActionButton(_("Skip"), () => {
            this.sendSkip();
        }, { color: "primary" });
        this.maybeStartTimer();
    }
    maybeStartTimer() {
        // Defensive: never run the ReactionPhase timer if we've already left the state.
        if (this.game.getGamedatas().gamestate.name !== "ReactionPhase") {
            this.stopTimer();
            return;
        }
        if (!this.game.bga.players.isCurrentPlayerActive()) {
            this.stopTimer();
            return;
        }
        if (this.game.didSendReactionAction()) {
            this.stopTimer();
            return;
        }
        if (this.countdownIntervalId !== null || this.autoSkipTimeoutId !== null)
            return;
        // Use the variable reaction time instead of hardcoded 5
        const reactionSeconds = this.reactionTimeSeconds;
        const deadlineMs = Date.now() + reactionSeconds * 1000;
        let lastShownSeconds = reactionSeconds;
        // Set initial button text to show countdown
        if (this.skipButton) {
            this.skipButton.textContent = _("Skip") + ` (${reactionSeconds})`;
        }
        this.autoSkipTimeoutId = window.setTimeout(() => {
            if (this.game.getGamedatas().gamestate.name !== "ReactionPhase")
                return;
            if (!this.game.bga.players.isCurrentPlayerActive())
                return;
            if (this.game.didSendReactionAction())
                return;
            this.sendSkip();
        }, reactionSeconds * 1000);
        this.countdownIntervalId = window.setInterval(() => {
            if (this.game.getGamedatas().gamestate.name !== "ReactionPhase" ||
                !this.game.bga.players.isCurrentPlayerActive() ||
                this.game.didSendReactionAction()) {
                this.stopTimer();
                return;
            }
            const msLeft = deadlineMs - Date.now();
            const secondsLeft = Math.max(0, Math.ceil(msLeft / 1000));
            if (secondsLeft !== lastShownSeconds) {
                lastShownSeconds = secondsLeft;
                // Update skip button text with countdown
                if (this.skipButton) {
                    if (secondsLeft > 0) {
                        this.skipButton.textContent = _("Skip") + ` (${secondsLeft})`;
                    }
                    else {
                        this.skipButton.textContent = _("Skip");
                    }
                }
            }
        }, 100);
    }
    sendSkip() {
        if (this.game.didSendReactionAction())
            return;
        if (this.game.getGamedatas().gamestate.name !== "ReactionPhase") {
            this.stopTimer();
            return;
        }
        this.game.markReactionActionSent();
        this.game.bga.actions.performAction("actSkipReaction", {});
        this.stopTimer();
    }
    stopTimer() {
        if (this.countdownIntervalId !== null) {
            clearInterval(this.countdownIntervalId);
            this.countdownIntervalId = null;
        }
        if (this.autoSkipTimeoutId !== null) {
            clearTimeout(this.autoSkipTimeoutId);
            this.autoSkipTimeoutId = null;
        }
        this.skipButton = null;
    }
}

class TargetSelectionState {
    constructor(game) {
        this.game = game;
        this.selectedTargets = [];
    }
    /**
     * Generate HTML for a player color indicator box
     */
    getPlayerColorBox(color) {
        if (!color)
            return "";
        // Ensure color is in hex format (add # if missing)
        const hexColor = color.startsWith("#") ? color : `#${color}`;
        return `<span class="player-color-indicator" style="background-color: ${hexColor};"></span>`;
    }
    onLeave() {
        this.selectedTargets = [];
        this.hideTargetSelection();
    }
    onUpdateActionButtons(args) {
        if (!this.game.bga.gameui.isCurrentPlayerActive())
            return;
        if (!args)
            return;
        const a = args.args || args;
        this.updateButtons({
            selectablePlayers: a.selectablePlayers || [],
            targetCount: a.targetCount || 1,
            requiresMultipleTargets: !!a.requiresMultipleTargets,
        });
    }
    updateButtons(args) {
        this.game.bga.statusBar.removeActionButtons();
        const { selectablePlayers, targetCount, requiresMultipleTargets } = args;
        selectablePlayers.forEach((player) => {
            const isSelected = this.selectedTargets.includes(player.id);
            const colorBox = this.getPlayerColorBox(player.color || "");
            const playerNameWithColor = (player.name || "") + " " + colorBox;
            const buttonText = isSelected
                ? _("Deselect ${player_name}").replace("${player_name}", playerNameWithColor)
                : _("Select ${player_name}").replace("${player_name}", playerNameWithColor);
            const button = this.game.bga.statusBar.addActionButton(buttonText, () => {
                const index = this.selectedTargets.indexOf(player.id);
                if (index > -1) {
                    this.selectedTargets.splice(index, 1);
                }
                else {
                    if (this.selectedTargets.length < targetCount) {
                        this.selectedTargets.push(player.id);
                    }
                }
                // For single target, auto-submit when selected
                if (this.selectedTargets.length === targetCount && !requiresMultipleTargets) {
                    this.game.bga.actions.performAction("actSelectTargets", {
                        targetPlayerIds: this.selectedTargets,
                    });
                    this.selectedTargets = [];
                }
                else {
                    // For multiple targets, refresh buttons to show updated state
                    this.updateButtons(args);
                }
            }, { color: isSelected ? "secondary" : "primary" });
            // Set innerHTML to support the color box HTML
            if (button && colorBox) {
                button.innerHTML = buttonText;
            }
        });
        if (requiresMultipleTargets && this.selectedTargets.length === targetCount) {
            this.game.bga.statusBar.addActionButton(_("Confirm Selection"), () => {
                this.game.bga.actions.performAction("actSelectTargets", {
                    targetPlayerIds: this.selectedTargets,
                });
                this.selectedTargets = [];
            }, { color: "primary" });
        }
    }
    hideTargetSelection() {
        const targetDiv = document.getElementById("target-selection-ui");
        if (targetDiv)
            targetDiv.remove();
    }
}

function createStateHandlers(game) {
    return {
        PlayerTurn: new PlayerTurnState(game),
        ReactionPhase: new ReactionPhaseState(game),
        ActionResolution: new ActionResolutionState(game),
        TargetSelection: new TargetSelectionState(game),
        DiscardPhase: new DiscardPhaseState(game),
        CardSelection: new CardSelectionState(game),
        CardNameSelection: new CardNameSelectionState(game),
    };
}

class GameNotifications {
    constructor(game) {
        this.game = game;
    }
    setup() {
        console.log("notifications subscriptions setup");
        this.game.bga.notifications.setupPromiseNotifications({
            handlers: [this],
            // logger: console.log,
        });
    }
    asInt(value) {
        if (typeof value === "number" && Number.isFinite(value))
            return value;
        if (typeof value === "string" && value.trim() !== "") {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }
    setDeckCount(count) {
        const gd = this.game.getGamedatas();
        gd.deckCount = Math.max(0, count);
        this.game.updateDeckDisplay(gd.deckCount);
    }
    decDeckCount(delta) {
        const gd = this.game.getGamedatas();
        const current = typeof gd.deckCount === "number" ? gd.deckCount : 0;
        this.setDeckCount(current - delta);
    }
    applyGoldenPotatoesDelta(playerId, delta) {
        const gd = this.game.getGamedatas();
        const p = gd.players?.[playerId];
        if (!p)
            return;
        const current = Number(p.golden_potatoes ?? p.score ?? 0);
        const next = Math.max(0, current + delta);
        p.golden_potatoes = next;
        // Keep score in sync too, since server does that.
        p.score = next;
        if (playerId === this.game.bga.gameui.player_id) {
            this.game.updateGoldenPotatoCards(next);
        }
    }
    async notif_handUpdated(args) {
        const gd = this.game.getGamedatas();
        if (Array.isArray(args.hand)) {
            gd.hand = args.hand;
            this.game.updateHand(gd.hand);
        }
        const deckCount = this.asInt(args.deckCount);
        if (deckCount !== null) {
            this.setDeckCount(deckCount);
        }
    }
    async notif_cardPlayed(args) {
        console.log("Card played:", args);
        this.game.updateDeckDisplay(this.game.getGamedatas().deckCount || 0);
        const playedCardId = this.asInt(args.card_id);
        const playedCardTypeArg = this.asInt(args.card_type_arg);
        const playedCardType = typeof args.card_type === "string" ? args.card_type : null;
        if (playedCardId !== null && playedCardTypeArg !== null && playedCardType) {
            this.game.optimisticallySetDiscard({
                id: playedCardId,
                type: playedCardType,
                type_arg: playedCardTypeArg,
            });
        }
        const playerId = this.asInt(args.player_id);
        if (playedCardId !== null && playerId === this.game.bga.gameui.player_id) {
            this.game.removeCardFromMyHand(playedCardId);
        }
    }
    async notif_threesomePlayed(args) {
        console.log("Threesome played:", args);
        this.game.updateDeckDisplay(Math.max(0, this.game.getGamedatas().deckCount || 0));
        const playerId = this.asInt(args.player_id);
        const delta = this.asInt(args.golden_potatoes) ?? 0;
        if (playerId !== null && delta !== 0) {
            this.applyGoldenPotatoesDelta(playerId, delta);
        }
    }
    async notif_threesomeScored(args) {
        console.log("Threesome scored:", args);
        this.game.updateDeckDisplay(Math.max(0, this.game.getGamedatas().deckCount || 0));
        const playerId = this.asInt(args.player_id);
        const delta = this.asInt(args.golden_potatoes) ?? 0;
        if (playerId !== null && delta !== 0) {
            this.applyGoldenPotatoesDelta(playerId, delta);
        }
    }
    async notif_cardMovedToDiscard(args) {
        const cardId = this.asInt(args.card_id);
        const cardTypeArg = this.asInt(args.card_type_arg);
        const cardType = typeof args.card_type === "string" ? args.card_type : null;
        if (cardId === null || cardTypeArg === null || !cardType)
            return;
        this.game.confirmDiscardMovedToDiscard({ id: cardId, type: cardType, type_arg: cardTypeArg });
    }
    async notif_cardCancelled(args) {
        console.log("Card cancelled:", args);
        const cancelledCardId = this.asInt(args.card_id);
        if (cancelledCardId !== null) {
            this.game.cancelPendingDiscard(cancelledCardId);
        }
    }
    async notif_threesomeCancelled(args) {
        console.log("Threesome cancelled:", args);
        // No golden potatoes to revert: they are awarded only after the reaction phase completes.
    }
    async notif_cardDrawn(args) {
        console.log("Card drawn:", args);
        this.decDeckCount(1);
        const gd = this.game.getGamedatas();
        if (args.player_id == this.game.bga.gameui.player_id && gd.hand) {
            if (args.card_type && args.card_type_arg !== undefined) {
                const newCard = {
                    id: args.card_id,
                    type: args.card_type,
                    type_arg: args.card_type_arg,
                };
                gd.hand.push(newCard);
                this.game.updateHand(gd.hand);
            }
        }
    }
    async notif_cardsDiscarded(args) {
        console.log("Cards discarded:", args);
        this.game.updateDeckDisplay(Math.max(0, this.game.getGamedatas().deckCount || 0));
        const gd = this.game.getGamedatas();
        if (gd.hand) {
            const discardedIds = new Set();
            if (Array.isArray(args.card_ids)) {
                for (const raw of args.card_ids) {
                    const n = this.asInt(raw);
                    if (n !== null)
                        discardedIds.add(n);
                }
            }
            gd.hand = gd.hand.filter((card) => {
                const id = this.asInt(card.id);
                // If we can't parse the id, don't accidentally delete the card.
                if (id === null)
                    return true;
                return !discardedIds.has(id);
            });
            this.game.updateHand(gd.hand);
        }
        // Update discard display to show one of the discarded cards as the new top.
        const top = args.discard_top_card;
        if (top && typeof top === "object") {
            const id = this.asInt(top.id);
            const type = typeof top.type === "string" ? top.type : null;
            const typeArg = this.asInt(top.type_arg);
            if (id !== null && type && typeArg !== null) {
                this.game.updateDiscardDisplay({ id, type, type_arg: typeArg });
            }
        }
    }
    async notif_turnEnded(args) {
        console.log("Turn ended:", args);
    }
    async notif_emptyHandDraw(args) {
        console.log("Empty hand draw:", args);
        const deckCount = this.asInt(args.deckCount);
        if (deckCount !== null) {
            this.setDeckCount(deckCount);
        }
        else {
            this.decDeckCount(3);
        }
    }
    async notif_discardAndDraw(args) {
        console.log("Discard and draw:", args);
        const deckCount = this.asInt(args.deckCount);
        if (deckCount !== null) {
            this.setDeckCount(deckCount);
        }
        else {
            this.decDeckCount(3);
        }
    }
    async notif_deckReshuffled(args) {
        console.log("Deck reshuffled:", args);
        this.game.updateDeckDisplay(this.game.getGamedatas().deckCount || 0);
        this.game.updateDiscardDisplay(null);
        this.game.clearPendingDiscardState();
    }
    // Action card notifications
    async notif_getOffThePony(args) {
        console.log("Get off the pony:", args);
        const playerId = this.asInt(args.player_id);
        const targetPlayerId = this.asInt(args.target_player_id);
        if (playerId !== null)
            this.applyGoldenPotatoesDelta(playerId, 1);
        if (targetPlayerId !== null)
            this.applyGoldenPotatoesDelta(targetPlayerId, -1);
    }
    async notif_lendMeABuck(args) {
        console.log("Lend me a buck:", args);
        const cardId = this.asInt(args.card_id);
        const targetPlayerId = this.asInt(args.target_player_id);
        const playerId = this.asInt(args.player_id);
        if (targetPlayerId === this.game.bga.gameui.player_id && cardId !== null) {
            this.game.removeCardFromMyHand(cardId);
        }
        if (playerId === this.game.bga.gameui.player_id && cardId !== null) {
            const cardType = args.card_type;
            const cardTypeArg = this.asInt(args.card_type_arg);
            if (cardType && cardTypeArg !== null) {
                this.game.addCardToMyHand({ id: cardId, type: cardType, type_arg: cardTypeArg });
            }
            else {
                const cached = this.game.getRevealedCardFromCache(cardId);
                if (cached)
                    this.game.addCardToMyHand(cached);
            }
        }
    }
    async notif_runawayPotatoes(args) {
        console.log("Runaway potatoes:", args);
        this.game.updateDeckDisplay(this.game.getGamedatas().deckCount || 0);
    }
    async notif_harryPotato(args) {
        console.log("Harry Potato:", args);
        const deckCount = this.asInt(args.deckCount);
        if (deckCount !== null) {
            this.setDeckCount(deckCount);
        }
    }
    async notif_popePotato(args) {
        console.log("Pope Potato:", args);
        const cardId = this.asInt(args.card_id);
        const targetPlayerId = this.asInt(args.target_player_id);
        const playerId = this.asInt(args.player_id);
        if (targetPlayerId === this.game.bga.gameui.player_id && cardId !== null) {
            this.game.removeCardFromMyHand(cardId);
        }
        if (playerId === this.game.bga.gameui.player_id && cardId !== null) {
            const cardType = args.card_type;
            const cardTypeArg = this.asInt(args.card_type_arg);
            if (cardType && cardTypeArg !== null) {
                this.game.addCardToMyHand({ id: cardId, type: cardType, type_arg: cardTypeArg });
            }
            else {
                const cached = this.game.getRevealedCardFromCache(cardId);
                if (cached)
                    this.game.addCardToMyHand(cached);
            }
        }
    }
    async notif_popePotatoFail(args) {
        console.log("Pope Potato failed:", args);
    }
    async notif_lookAhead(args) {
        console.log("Look ahead:", args);
        const targetPlayerId = this.asInt(args.target_player_id);
        if (targetPlayerId !== null)
            this.applyGoldenPotatoesDelta(targetPlayerId, -1);
    }
    async notif_potatoOfTheYear(args) {
        console.log("Potato of the year:", args);
        const playerId = this.asInt(args.player_id);
        if (playerId !== null)
            this.applyGoldenPotatoesDelta(playerId, 1);
    }
    async notif_potatoOfDestiny(args) {
        console.log("Potato of destiny:", args);
        const deckCount = this.asInt(args.deckCount);
        if (deckCount !== null) {
            this.setDeckCount(deckCount);
        }
    }
    async notif_potatoDawan(args) {
        console.log("Potato Dawan:", args);
        const cardId = this.asInt(args.card_id);
        const targetPlayerId = this.asInt(args.target_player_id);
        const playerId = this.asInt(args.player_id);
        if (targetPlayerId === this.game.bga.gameui.player_id && cardId !== null) {
            this.game.removeCardFromMyHand(cardId);
        }
        if (playerId === this.game.bga.gameui.player_id && cardId !== null) {
            const cardType = args.card_type;
            const cardTypeArg = this.asInt(args.card_type_arg);
            if (cardType && cardTypeArg !== null) {
                this.game.addCardToMyHand({ id: cardId, type: cardType, type_arg: cardTypeArg });
            }
            else {
                const cached = this.game.getRevealedCardFromCache(cardId);
                if (cached)
                    this.game.addCardToMyHand(cached);
            }
        }
    }
    async notif_jumpToTheSide(args) {
        console.log("Jump to the side:", args);
        const deckCount = this.asInt(args.deckCount);
        if (deckCount !== null) {
            this.setDeckCount(deckCount);
        }
    }
    async notif_papageddonOrder(args) {
        console.log("Papageddon order reversed:", args);
    }
    async notif_papageddonSteal(args) {
        console.log("Papageddon steal:", args);
        const cardId = this.asInt(args.card_id);
        const targetPlayerId = this.asInt(args.target_player_id);
        if (targetPlayerId === this.game.bga.gameui.player_id && cardId !== null) {
            this.game.removeCardFromMyHand(cardId);
        }
    }
    async notif_papageddonStealPrivate(args) {
        console.log("Papageddon steal (private):", args);
        const cardId = this.asInt(args.card_id);
        const playerId = this.asInt(args.player_id);
        if (playerId !== this.game.bga.gameui.player_id || cardId === null)
            return;
        const cardType = args.card_type;
        const cardTypeArg = this.asInt(args.card_type_arg);
        if (cardType && cardTypeArg !== null) {
            this.game.addCardToMyHand({ id: cardId, type: cardType, type_arg: cardTypeArg });
        }
    }
    async notif_spiderPotato(args) {
        console.log("Spider potato:", args);
    }
    async notif_cardSelected(args) {
        console.log("Card selected:", args);
        const cardId = this.asInt(args.card_id);
        const cardTypeArg = this.asInt(args.card_type_arg);
        if (cardId !== null && typeof args.card_type === "string" && cardTypeArg !== null) {
            this.game.cacheRevealedCard({ id: cardId, type: args.card_type, type_arg: cardTypeArg });
        }
    }
    async notif_cardNameSelected(args) {
        console.log("Card name selected:", args);
    }
}

/*
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * DondeLasPapasQueman implementation : © tikoflano
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */
class Game {
    constructor(bga) {
        // In ReactionPhase we need to avoid double-sending actions (race with auto-skip).
        this.reactionActionSent = false;
        // Selected cards for threesome
        this.selectedCards = [];
        // Latest discarded card (for display)
        this.latestDiscardedCard = null;
        // When a card is played, we optimistically show it in discard immediately.
        // If it gets interrupted, we revert back to the previous discard.
        this.pendingDiscardCardId = null;
        this.discardBeforePending = null;
        // Cache revealed card identity by id (used to update hands without refresh)
        this.revealedCardsById = new Map();
        this.handView = new HandView();
        this.deckView = new DeckView();
        this.discardView = new DiscardView();
        this.goldenPotatoView = new GoldenPotatoView();
        console.log("dondelaspapasqueman constructor");
        this.bga = bga;
        this.stateHandlers = createStateHandlers(this);
        this.notifications = new GameNotifications(this);
    }
    asInt(value) {
        if (typeof value === "number" && Number.isFinite(value))
            return value;
        if (typeof value === "string" && value.trim() !== "") {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }
    getGamedatas() {
        return this.gamedatas;
    }
    getSelectedCards() {
        return this.selectedCards;
    }
    clearSelectedCards() {
        this.selectedCards = [];
    }
    setup(gamedatas) {
        console.log("Starting game setup");
        this.gamedatas = gamedatas;
        // Create game area structure
        this.bga.gameArea.getElement().insertAdjacentHTML("beforeend", `
            <div id="hand-area"></div>
            <div id="golden-potato-cards-area">
                <h3>Golden Potatoes</h3>
                <div id="golden-potato-cards"></div>
            </div>
            <div id="common-area">
                <div id="deck-card" class="deck-card">
                    <div class="card-back"></div>
                    <div class="deck-count">0</div>
                </div>
                <div id="discard-card" class="discard-card">
                    <div class="card-placeholder">Discard Pile</div>
                </div>
            </div>
        `);
        // Display hand
        this.updateHand(gamedatas.hand || []);
        // Update golden potato cards display
        const currentPlayerId = this.bga.gameui.player_id;
        const currentPlayer = gamedatas.players?.[currentPlayerId];
        const goldenPotatoes = Number(currentPlayer?.golden_potatoes || currentPlayer?.score || 0);
        this.updateGoldenPotatoCards(goldenPotatoes);
        // Update deck and discard displays
        this.updateDeckDisplay(gamedatas.deckCount || 0);
        this.updateDiscardDisplay(gamedatas.discardTopCard ?? null);
        // Setup game notifications
        this.notifications.setup();
        console.log("Ending game setup");
    }
    ///////////////////////////////////////////////////
    //// Game & client states
    onEnteringState(stateName, args) {
        console.log("Entering state: " + stateName, args);
        if (stateName === "ReactionPhase")
            this.resetReactionActionSent();
        this.stateHandlers[stateName]?.onEnter?.(args);
    }
    onLeavingState(stateName) {
        console.log("Leaving state: " + stateName);
        this.stateHandlers[stateName]?.onLeave?.();
        if (stateName === "ReactionPhase")
            this.resetReactionActionSent();
    }
    onUpdateActionButtons(stateName, args) {
        console.log("onUpdateActionButtons: " + stateName, args);
        this.stateHandlers[stateName]?.onUpdateActionButtons?.(args);
    }
    ///////////////////////////////////////////////////
    //// Utility methods
    updateHand(hand) {
        this.handView.render({
            hand,
            selectedCardIds: this.selectedCards,
            isReactionPhase: this.gamedatas.gamestate.name === "ReactionPhase" && this.bga.players.isCurrentPlayerActive(),
            onCardClick: (cardId) => this.onCardClick(cardId),
            attachTooltip: (nodeId, html) => {
                // Safe on rerenders: remove then re-add.
                this.bga.gameui.removeTooltip(nodeId);
                this.bga.gameui.addTooltipHtml(nodeId, html);
            },
        });
    }
    updateDeckDisplay(count) {
        this.deckView.setCount(count);
    }
    removeCardFromMyHand(cardId) {
        if (!this.gamedatas.hand)
            return;
        // Ensure we don't keep a stale selection on a removed card.
        this.selectedCards = this.selectedCards.filter((id) => id !== cardId);
        const newHand = this.gamedatas.hand.filter((card) => {
            const id = this.asInt(card.id);
            return id === null ? true : id !== cardId;
        });
        if (newHand.length !== this.gamedatas.hand.length) {
            this.gamedatas.hand = newHand;
            this.updateHand(this.gamedatas.hand);
        }
    }
    addCardToMyHand(card) {
        if (!this.gamedatas.hand)
            return;
        const newId = this.asInt(card.id);
        if (newId !== null &&
            this.gamedatas.hand.some((c) => {
                const existingId = this.asInt(c.id);
                return existingId !== null && existingId === newId;
            })) {
            return;
        }
        this.gamedatas.hand.push(card);
        this.updateHand(this.gamedatas.hand);
    }
    cacheRevealedCard(card) {
        this.revealedCardsById.set(card.id, card);
    }
    getRevealedCardFromCache(cardId) {
        return this.revealedCardsById.get(cardId);
    }
    /**
     * Optimistically show a played card in the discard pile immediately.
     * If the play is interrupted, call `cancelPendingDiscard` to revert.
     */
    optimisticallySetDiscard(card) {
        this.discardBeforePending = this.latestDiscardedCard;
        this.pendingDiscardCardId = card.id;
        this.updateDiscardDisplay(card);
    }
    confirmDiscardMovedToDiscard(card) {
        this.updateDiscardDisplay(card);
        if (this.pendingDiscardCardId === card.id) {
            this.pendingDiscardCardId = null;
            this.discardBeforePending = null;
        }
    }
    cancelPendingDiscard(cardId) {
        if (this.pendingDiscardCardId !== cardId)
            return;
        this.pendingDiscardCardId = null;
        this.updateDiscardDisplay(this.discardBeforePending);
        this.discardBeforePending = null;
    }
    clearPendingDiscardState() {
        this.pendingDiscardCardId = null;
        this.discardBeforePending = null;
    }
    updateDiscardDisplay(card) {
        this.latestDiscardedCard = card;
        this.discardView.render(card);
        // Tooltip for the discard top card (if any).
        this.bga.gameui.removeTooltip("discard-card");
        if (card) {
            this.bga.gameui.addTooltipHtml("discard-card", getCardTooltipHtml(card));
        }
    }
    /**
     * Update golden potato cards display
     * Cards are double-sided: one side shows 1, the other shows 2
     * Display uses as many "2" cards as possible, then a "1" card if needed
     */
    updateGoldenPotatoCards(count) {
        this.goldenPotatoView.render(count);
    }
    ///////////////////////////////////////////////////
    //// ReactionPhase helpers
    didSendReactionAction() {
        return this.reactionActionSent;
    }
    markReactionActionSent() {
        this.reactionActionSent = true;
    }
    resetReactionActionSent() {
        this.reactionActionSent = false;
    }
    ///////////////////////////////////////////////////
    //// Player's action
    onCardClick(card_id) {
        console.log("onCardClick", card_id);
        const currentState = this.gamedatas.gamestate.name;
        const card = this.gamedatas.hand?.find((c) => c.id === card_id);
        // DiscardPhase: clicking cards should only toggle selection (no server call).
        if (currentState === "DiscardPhase") {
            if (!this.bga.gameui.isCurrentPlayerActive())
                return;
            if (!card)
                return;
            if (this.selectedCards.includes(card_id)) {
                this.selectedCards = this.selectedCards.filter((id) => id !== card_id);
            }
            else {
                this.selectedCards.push(card_id);
            }
            this.updateHand(this.gamedatas.hand || []);
            this.onUpdateActionButtons("DiscardPhase", this.gamedatas.gamestate.args || null);
            return;
        }
        // In ReactionPhase, ignore extra clicks after we've already sent a reaction action
        // (prevents double-sends if the user clicks right as auto-skip fires).
        if (currentState === "ReactionPhase" && this.didSendReactionAction()) {
            return;
        }
        // Check if we're in reaction phase and this is an interrupt card
        if (currentState === "ReactionPhase" &&
            this.bga.players.isCurrentPlayerActive() &&
            card &&
            isInterruptCard(card)) {
            // Play the interrupt card
            this.markReactionActionSent();
            const decoded = decodeCardTypeArg(card.type_arg || 0);
            if (decoded.name_index === 1) {
                // "No dude"
                this.bga.actions.performAction("actPlayNoPoh", {});
            }
            else if (decoded.name_index === 2) {
                // "I told you no dude"
                this.bga.actions.performAction("actPlayTeDijeQueNoPoh", {});
            }
            return;
        }
        // Normal card selection for threesome (only in PlayerTurn)
        if (currentState === "PlayerTurn") {
            // Toggle selection for threesome
            if (this.selectedCards.includes(card_id)) {
                this.selectedCards = this.selectedCards.filter((id) => id !== card_id);
            }
            else {
                if (this.selectedCards.length < 3) {
                    this.selectedCards.push(card_id);
                }
                else {
                    // Replace first selected card
                    this.selectedCards.shift();
                    this.selectedCards.push(card_id);
                }
            }
            // Update UI
            this.updateHand(this.gamedatas.hand || []);
            // Update action buttons
            this.onUpdateActionButtons(currentState, this.gamedatas.gamestate.args || null);
        }
    }
}

/*
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * DondeLasPapasQueman implementation : © tikoflano
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */

export { Game };
