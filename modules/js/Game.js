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
    // 3 wildcards => trio of french fries
    if (wildcards.length === 3) {
        const label = _("Play trio of ${trio_name}").replace("${trio_name}", _("french fries"));
        return { kind: "trio_potato", cardIds: selectedCardIds.slice(), label };
    }
    // Potato trio with 0-2 wildcards (potatoes must share the same name)
    if (potatoes.length + wildcards.length === 3 && wildcards.length <= 2 && potatoes.length >= 1) {
        const potatoNames = potatoes.map((c) => decodeCardTypeArg(c.type_arg || 0).name_index);
        const uniquePotatoNames = Array.from(new Set(potatoNames));
        if (uniquePotatoNames.length === 1) {
            const trioName = getCardName(potatoes[0]);
            const label = _("Play trio of ${trio_name}").replace("${trio_name}", trioName);
            return { kind: "trio_potato", cardIds: selectedCardIds.slice(), label };
        }
    }
    // 3 cards of any type with value == 3 each
    const allValue3 = selected.every((c) => getCardValue(c) === 3);
    if (allValue3) {
        return { kind: "trio_value3", cardIds: selectedCardIds.slice(), label: _("Play trio") };
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
    }
    onEnter(args) {
        this.show(args);
    }
    onLeave() {
        this.hide();
    }
    show(args) {
        if (!this.game.bga.gameui.isCurrentPlayerActive())
            return;
        this.hide();
        const nameDiv = document.createElement("div");
        nameDiv.id = "card-name-selection-ui";
        nameDiv.className = "card-name-selection-ui";
        nameDiv.innerHTML = `
      <div class="card-name-selection-title">${_("Name a card")}</div>
      <select id="card-type-select" class="card-type-select">
        <option value="">${_("Select card type...")}</option>
      </select>
      <select id="card-name-select" class="card-name-select" disabled>
        <option value="">${_("Select card name...")}</option>
      </select>
      <button id="confirm-card-name" class="btn btn-primary" disabled>${_("Confirm")}</button>
    `;
        const cardTypeSelect = nameDiv.querySelector("#card-type-select");
        const cardNameSelect = nameDiv.querySelector("#card-name-select");
        const confirmBtn = nameDiv.querySelector("#confirm-card-name");
        if (args.cardNames) {
            Object.keys(args.cardNames).forEach((cardType) => {
                const option = document.createElement("option");
                option.value = cardType;
                option.textContent = cardType.charAt(0).toUpperCase() + cardType.slice(1);
                cardTypeSelect.appendChild(option);
            });
        }
        cardTypeSelect.addEventListener("change", () => {
            const selectedType = cardTypeSelect.value;
            cardNameSelect.innerHTML = '<option value="">' + _("Select card name...") + "</option>";
            cardNameSelect.disabled = !selectedType;
            if (selectedType && args.cardNames[selectedType]) {
                Object.keys(args.cardNames[selectedType]).forEach((nameIndex) => {
                    const option = document.createElement("option");
                    option.value = nameIndex;
                    option.textContent = args.cardNames[selectedType][nameIndex];
                    cardNameSelect.appendChild(option);
                });
            }
            confirmBtn.disabled = !selectedType || !cardNameSelect.value;
        });
        cardNameSelect.addEventListener("change", () => {
            confirmBtn.disabled = !cardTypeSelect.value || !cardNameSelect.value;
        });
        confirmBtn.addEventListener("click", () => {
            const cardType = cardTypeSelect.value;
            const nameIndex = parseInt(cardNameSelect.value);
            if (cardType && nameIndex) {
                this.game.bga.actions.performAction("actSelectCardName", {
                    card_type: cardType,
                    name_index: nameIndex,
                });
            }
        });
        this.game.bga.gameArea.getElement().appendChild(nameDiv);
    }
    hide() {
        const nameDiv = document.getElementById("card-name-selection-ui");
        if (nameDiv)
            nameDiv.remove();
    }
}

class CardSelectionState {
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
        this.dialog.create("card-selection-dialog");
        this.dialog.setTitle(_("Select a card from ${target_name}'s hand").replace("${target_name}", args.targetPlayerName || ""));
        this.dialog.setMaxWidth(600);
        this.dialog.hideCloseIcon();
        let cardsHtml = '<div id="card-selection-cards" style="text-align: center; padding: 20px;">';
        if (args.cardBacks && Array.isArray(args.cardBacks)) {
            args.cardBacks.forEach((cardBack) => {
                cardsHtml += `
          <div class="card-back" 
               data-position="${cardBack.position}" 
               data-card-id="${cardBack.card_id}"
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
        // Only show UI for the active player
        if (!this.game.bga.gameui.isCurrentPlayerActive())
            return;
        this.hide();
        const discardDiv = document.createElement("div");
        discardDiv.id = "discard-phase-ui";
        discardDiv.className = "discard-phase";
        discardDiv.innerHTML = `
            <h3>Discard Cards</h3>
            <p>You have ${args.handSize} cards. Discard ${args.cardsToDiscard} to get down to 7.</p>
            <div id="discard-selection-area"></div>
            <button id="confirm-discard" disabled>Confirm Discard</button>
        `;
        this.game.bga.gameArea.getElement().appendChild(discardDiv);
        const selectionArea = document.getElementById("discard-selection-area");
        if (!selectionArea)
            return;
        const selectedForDiscard = [];
        if (args.hand && Array.isArray(args.hand)) {
            args.hand.forEach((card) => {
                const cardDiv = document.createElement("div");
                cardDiv.className = "discard-card";
                cardDiv.dataset.cardId = card.id.toString();
                cardDiv.innerHTML = `Card ${card.id}`;
                cardDiv.addEventListener("click", () => {
                    if (cardDiv.classList.contains("selected")) {
                        cardDiv.classList.remove("selected");
                        const index = selectedForDiscard.indexOf(card.id);
                        if (index > -1)
                            selectedForDiscard.splice(index, 1);
                    }
                    else {
                        cardDiv.classList.add("selected");
                        selectedForDiscard.push(card.id);
                    }
                    const confirmBtn = document.getElementById("confirm-discard");
                    if (confirmBtn) {
                        confirmBtn.disabled = selectedForDiscard.length < args.cardsToDiscard;
                    }
                });
                selectionArea.appendChild(cardDiv);
            });
        }
        const confirmBtn = document.getElementById("confirm-discard");
        if (confirmBtn) {
            confirmBtn.addEventListener("click", () => {
                if (selectedForDiscard.length >= args.cardsToDiscard) {
                    this.game.bga.actions.performAction("actDiscardCards", {
                        card_ids: selectedForDiscard,
                    });
                }
            });
        }
    }
    onLeave() {
        this.hide();
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
        this.timerId = null;
    }
    onEnter(_args) {
        this.startTimer();
    }
    onLeave() {
        this.stopTimer();
        // Best effort: refresh hand to remove interrupt highlighting.
        this.game.updateHand(this.game.getGamedatas().hand || []);
    }
    onUpdateActionButtons(args) {
        // MULTIPLE_ACTIVE_PLAYER: use players.isCurrentPlayerActive()
        if (!this.game.bga.players.isCurrentPlayerActive())
            return;
        this.game.bga.statusBar.removeActionButtons();
        // Refresh hand to highlight interrupt cards
        if (this.game.getGamedatas().hand) {
            this.game.updateHand(this.game.getGamedatas().hand);
        }
        // Add "Skip" button for all active players
        this.game.bga.statusBar.addActionButton(_("Skip"), () => {
            this.game.bga.actions.performAction("actSkipReaction", {});
        }, { color: "secondary" });
    }
    startTimer() {
        // Remove any existing timer first
        this.stopTimer();
        const timerDiv = document.createElement("div");
        timerDiv.id = "reaction-timer";
        timerDiv.className = "reaction-timer";
        timerDiv.innerHTML =
            '<div>Reaction Phase: <span id="timer-countdown">3</span> seconds</div>';
        this.game.bga.gameArea.getElement().appendChild(timerDiv);
        let timeLeft = 3;
        this.timerId = window.setInterval(() => {
            timeLeft--;
            const countdownEl = document.getElementById("timer-countdown");
            if (countdownEl)
                countdownEl.textContent = timeLeft.toString();
            if (timeLeft <= 0) {
                this.stopTimer();
            }
        }, 1000);
    }
    stopTimer() {
        if (this.timerId !== null) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        const timerDiv = document.getElementById("reaction-timer");
        if (timerDiv)
            timerDiv.remove();
    }
}

class TargetSelectionState {
    constructor(game) {
        this.game = game;
        this.selectedTargets = [];
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
            const buttonText = isSelected
                ? _("Deselect ${player_name}").replace("${player_name}", player.name)
                : _("Select ${player_name}").replace("${player_name}", player.name);
            this.game.bga.statusBar.addActionButton(buttonText, () => {
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
        const gd = this.game.getGamedatas();
        if (gd.hand) {
            gd.hand = gd.hand.filter((card) => !args.card_ids.includes(card.id));
            this.game.updateHand(gd.hand);
        }
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
        const targetPlayerId = this.asInt(args.target_player_id);
        if (targetPlayerId !== null) {
            // Cancelled threesome always removes 3 golden potatoes.
            this.applyGoldenPotatoesDelta(targetPlayerId, -3);
        }
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
            gd.hand = gd.hand.filter((card) => !args.card_ids.includes(card.id));
            this.game.updateHand(gd.hand);
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
        if (targetPlayerId === this.game.bga.gameui.player_id && cardId !== null) {
            this.game.removeCardFromMyHand(cardId);
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
        this.stateHandlers[stateName]?.onEnter?.(args);
    }
    onLeavingState(stateName) {
        console.log("Leaving state: " + stateName);
        this.stateHandlers[stateName]?.onLeave?.();
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
    //// Player's action
    onCardClick(card_id) {
        console.log("onCardClick", card_id);
        const currentState = this.gamedatas.gamestate.name;
        const card = this.gamedatas.hand?.find((c) => c.id === card_id);
        // Check if we're in reaction phase and this is an interrupt card
        if (currentState === "ReactionPhase" &&
            this.bga.players.isCurrentPlayerActive() &&
            card &&
            isInterruptCard(card)) {
            // Play the interrupt card
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
