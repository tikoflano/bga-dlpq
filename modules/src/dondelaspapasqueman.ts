/*
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * DondeLasPapasQueman implementation : © tikoflano
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */

/// <reference path="../../bga-framework.d.ts" />
/// <reference path="./dondelaspapasqueman.d.ts" />

class Game {
  public bga: Bga<DondeLasPapasQuemanGamedatas>;
  private gamedatas: DondeLasPapasQuemanGamedatas;

  // Selected cards for threesome
  private selectedCards: number[] = [];

  // Reaction phase timer
  private reactionTimer: number | null = null;

  // Latest discarded card (for display)
  private latestDiscardedCard: Card | null = null;

  constructor(bga: Bga<DondeLasPapasQuemanGamedatas>) {
    console.log("dondelaspapasqueman constructor");
    this.bga = bga;
  }

  setup(gamedatas: DondeLasPapasQuemanGamedatas): void {
    console.log("Starting game setup");
    this.gamedatas = gamedatas;

    // Create game area structure
    this.bga.gameArea.getElement().insertAdjacentHTML(
      "beforeend",
      `
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
        `,
    );

    // Display hand
    this.updateHand(gamedatas.hand || []);

    // Update golden potato cards display
    const currentPlayerId = this.bga.gameui.player_id;
    const currentPlayer = gamedatas.players?.[currentPlayerId];
    const goldenPotatoes = Number(currentPlayer?.golden_potatoes || currentPlayer?.score || 0);
    this.updateGoldenPotatoCards(goldenPotatoes);

    // Update deck and discard displays
    this.updateDeckDisplay(gamedatas.deckCount || 0);
    this.updateDiscardDisplay(null);

    // Setup game notifications
    this.setupNotifications();

    console.log("Ending game setup");
  }

  ///////////////////////////////////////////////////
  //// Game & client states

  onEnteringState(stateName: string, args: any): void {
    console.log("Entering state: " + stateName, args);

    switch (stateName) {
      case "PlayerTurn":
        this.selectedCards = [];
        if (args.canDiscardAndDraw) {
          this.bga.statusBar.addActionButton(
            _("Discard and Draw 3"),
            () => {
              this.bga.actions.performAction("actDiscardAndDraw", {});
            },
            { color: "primary" },
          );
        }
        break;

      case "ReactionPhase":
        this.startReactionTimer(args);
        break;

      case "DiscardPhase":
        this.showDiscardPhase(args);
        break;
    }
  }

  onLeavingState(stateName: string): void {
    console.log("Leaving state: " + stateName);

    switch (stateName) {
      case "ReactionPhase":
        this.stopReactionTimer();
        break;

      case "DiscardPhase":
        this.hideDiscardPhase();
        break;
    }
  }

  onUpdateActionButtons(stateName: string, args: any): void {
    console.log("onUpdateActionButtons: " + stateName, args);

    if (this.bga.gameui.isCurrentPlayerActive()) {
      switch (stateName) {
        case "PlayerTurn":
          // Clear previous buttons
          this.bga.statusBar.removeActionButtons();

          // Add "End Turn" button
          this.bga.statusBar.addActionButton(
            _("End Turn"),
            () => {
              this.bga.actions.performAction("actEndTurn", {});
            },
            { color: "secondary" },
          );

          // Add "Play Threesome" button if cards are selected
          if (this.selectedCards.length == 3) {
            this.bga.statusBar.addActionButton(
              _("Play Threesome"),
              () => {
                this.bga.actions.performAction("actPlayThreesome", {
                  card_ids: this.selectedCards,
                });
                this.selectedCards = [];
              },
              { color: "primary" },
            );
          }
          break;

        case "ReactionPhase":
          // Add interrupt card buttons if player has them
          if (args.players && args.players[this.bga.gameui.player_id]) {
            const playerData = args.players[this.bga.gameui.player_id];
            if (playerData.hasNoPoh) {
              this.bga.statusBar.addActionButton(
                _("Play No Poh"),
                () => {
                  this.bga.actions.performAction("actPlayNoPoh", {});
                },
                { color: "alert" },
              );
            }
            if (playerData.hasTeDijeQueNoPoh) {
              this.bga.statusBar.addActionButton(
                _("Play Te Dije Que No Poh"),
                () => {
                  this.bga.actions.performAction("actPlayTeDijeQueNoPoh", {});
                },
                { color: "alert" },
              );
            }
          }
          break;

        case "DiscardPhase":
          // Buttons handled in showDiscardPhase
          break;
      }
    }
  }

  ///////////////////////////////////////////////////
  //// Utility methods

  updateHand(hand: Card[]): void {
    const handArea = document.getElementById("hand-area");
    if (!handArea) return;

    handArea.innerHTML = '<h3>Your Hand</h3><div id="hand-cards"></div>';
    const handCards = document.getElementById("hand-cards");
    if (!handCards) return;

    hand.forEach((card) => {
      const cardDiv = document.createElement("div");
      cardDiv.className = "card";
      cardDiv.dataset.cardId = card.id.toString();
      
      const cardName = this.getCardName(card);
      const cardValue = this.getCardValue(card);
      
      cardDiv.innerHTML = `
                <div class="card-type">${card.type}</div>
                <div class="card-name">${cardName}</div>
                <div class="card-value">Value: ${cardValue}</div>
            `;

      // Add click handler
      cardDiv.addEventListener("click", () => this.onCardClick(card.id));

      // Highlight if selected
      if (this.selectedCards.includes(card.id)) {
        cardDiv.classList.add("selected");
      }

      handCards.appendChild(cardDiv);
    });
  }

  /**
   * Decode card_type_arg to get name_index, value, and isAlarm
   * Format: name_index * 10000 + value * 100 + (isAlarm ? 1 : 0)
   */
  decodeCardTypeArg(typeArg: number): { name_index: number; value: number; isAlarm: boolean } {
    const isAlarm = typeArg % 100 === 1;
    const value = Math.floor((typeArg % 10000) / 100);
    const nameIndex = Math.floor(typeArg / 10000);
    return { name_index: nameIndex, value, isAlarm };
  }

  /**
   * Get card name by type and name_index
   */
  getCardName(card: Card): string {
    const typeArg = card.type_arg || 0;
    const decoded = this.decodeCardTypeArg(typeArg);
    const nameIndex = decoded.name_index;

    const cardNames: Record<string, Record<number, string>> = {
      potato: {
        1: _("papa"),
        2: _("papas duquesas"),
        3: _("papas fritas"),
      },
      action: {
        1: _("No Poh"),
        2: _("Te Dije Que No Poh"),
      },
      wildcard: {
        1: _("Wildcard"),
      },
    };

    return cardNames[card.type]?.[nameIndex] || _("Unknown Card");
  }

  getCardValue(card: Card): number {
    // Decode card_type_arg to get value
    const typeArg = card.type_arg || 0;
    const decoded = this.decodeCardTypeArg(typeArg);
    return decoded.value;
  }

  updateDeckDisplay(count: number): void {
    const deckCountEl = document.querySelector("#deck-card .deck-count");
    if (deckCountEl) {
      deckCountEl.textContent = count.toString();
    }
  }

  updateDiscardDisplay(card: Card | null): void {
    const discardCardEl = document.getElementById("discard-card");
    if (!discardCardEl) return;

    if (card) {
      this.latestDiscardedCard = card;
      const cardName = this.getCardName(card);
      const cardValue = this.getCardValue(card);

      discardCardEl.innerHTML = `
                <div class="card-type">${card.type}</div>
                <div class="card-name">${cardName}</div>
                <div class="card-value">Value: ${cardValue}</div>
            `;
      discardCardEl.classList.remove("empty");
    } else {
      discardCardEl.innerHTML = '<div class="card-placeholder">Discard Pile</div>';
      discardCardEl.classList.add("empty");
      this.latestDiscardedCard = null;
    }
  }

  /**
   * Update golden potato cards display
   * Cards are double-sided: one side shows 1, the other shows 2
   * Display uses as many "2" cards as possible, then a "1" card if needed
   */
  updateGoldenPotatoCards(count: number): void {
    const cardsContainer = document.getElementById("golden-potato-cards");
    if (!cardsContainer) return;

    cardsContainer.innerHTML = "";

    if (count === 0) {
      return;
    }

    // Calculate how many cards of each type to show
    const cardsWith2 = Math.floor(count / 2);
    const cardsWith1 = count % 2;

    // Create cards showing "2" side
    for (let i = 0; i < cardsWith2; i++) {
      const cardDiv = document.createElement("div");
      cardDiv.className = "golden-potato-card";
      cardDiv.innerHTML = `
                <div class="potato-value">2</div>
                <div class="potato-label">Golden Potato</div>
            `;
      cardsContainer.appendChild(cardDiv);
    }

    // Create card showing "1" side if needed
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

  startReactionTimer(args: any): void {
    // Show 3-second timer
    const timerDiv = document.createElement("div");
    timerDiv.id = "reaction-timer";
    timerDiv.className = "reaction-timer";
    timerDiv.innerHTML = '<div>Reaction Phase: <span id="timer-countdown">3</span> seconds</div>';
    this.bga.gameArea.getElement().appendChild(timerDiv);

    let timeLeft = 3;
    this.reactionTimer = window.setInterval(() => {
      timeLeft--;
      const countdownEl = document.getElementById("timer-countdown");
      if (countdownEl) {
        countdownEl.textContent = timeLeft.toString();
      }
      if (timeLeft <= 0) {
        this.stopReactionTimer();
      }
    }, 1000);
  }

  stopReactionTimer(): void {
    if (this.reactionTimer !== null) {
      clearInterval(this.reactionTimer);
      this.reactionTimer = null;
    }
    const timerDiv = document.getElementById("reaction-timer");
    if (timerDiv) {
      timerDiv.remove();
    }
  }

  showDiscardPhase(args: any): void {
    const discardDiv = document.createElement("div");
    discardDiv.id = "discard-phase-ui";
    discardDiv.className = "discard-phase";
    discardDiv.innerHTML = `
            <h3>Discard Cards</h3>
            <p>You have ${args.handSize} cards. Discard ${args.cardsToDiscard} to get down to 7.</p>
            <div id="discard-selection-area"></div>
            <button id="confirm-discard" disabled>Confirm Discard</button>
        `;
    this.bga.gameArea.getElement().appendChild(discardDiv);

    // Display cards for selection
    const selectionArea = document.getElementById("discard-selection-area");
    if (!selectionArea) return;

    const selectedForDiscard: number[] = [];

    if (args.hand && Array.isArray(args.hand)) {
      args.hand.forEach((card: Card) => {
        const cardDiv = document.createElement("div");
        cardDiv.className = "discard-card";
        cardDiv.dataset.cardId = card.id.toString();
        cardDiv.innerHTML = `Card ${card.id}`;

        cardDiv.addEventListener("click", () => {
          if (cardDiv.classList.contains("selected")) {
            cardDiv.classList.remove("selected");
            const index = selectedForDiscard.indexOf(card.id);
            if (index > -1) selectedForDiscard.splice(index, 1);
          } else {
            cardDiv.classList.add("selected");
            selectedForDiscard.push(card.id);
          }

          // Enable/disable confirm button
          const confirmBtn = document.getElementById("confirm-discard") as HTMLButtonElement;
          if (confirmBtn) {
            confirmBtn.disabled = selectedForDiscard.length < args.cardsToDiscard;
          }
        });

        selectionArea.appendChild(cardDiv);
      });
    }

    // Confirm button handler
    const confirmBtn = document.getElementById("confirm-discard");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        if (selectedForDiscard.length >= args.cardsToDiscard) {
          this.bga.actions.performAction("actDiscardCards", {
            card_ids: selectedForDiscard,
          });
        }
      });
    }
  }

  hideDiscardPhase(): void {
    const discardDiv = document.getElementById("discard-phase-ui");
    if (discardDiv) {
      discardDiv.remove();
    }
  }

  ///////////////////////////////////////////////////
  //// Player's action

  onCardClick(card_id: number): void {
    console.log("onCardClick", card_id);

    // Toggle selection for threesome
    if (this.selectedCards.includes(card_id)) {
      this.selectedCards = this.selectedCards.filter((id) => id !== card_id);
    } else {
      if (this.selectedCards.length < 3) {
        this.selectedCards.push(card_id);
      } else {
        // Replace first selected card
        this.selectedCards.shift();
        this.selectedCards.push(card_id);
      }
    }

    // Update UI
    this.updateHand(this.gamedatas.hand || []);

    // Update action buttons
    const currentState = this.gamedatas.gamestate.name;
    this.bga.gameui.onUpdateActionButtons(currentState, this.gamedatas.gamestate.args || null);

    // If 3 cards selected, offer to play as single card or wait for threesome button
    // For now, just play as single card if clicked again
    if (this.selectedCards.length != 3) {
      this.bga.actions
        .performAction("actPlayCard", {
          card_id,
        })
        .then(() => {
          // What to do after the server call if it succeeded
        });
    }
  }

  ///////////////////////////////////////////////////
  //// Reaction to cometD notifications

  setupNotifications(): void {
    console.log("notifications subscriptions setup");

    this.bga.notifications.setupPromiseNotifications({
      // logger: console.log
    });
  }

  async notif_cardPlayed(args: any): Promise<void> {
    console.log("Card played:", args);
    // Update deck display (deck count doesn't change when playing cards)
    this.updateDeckDisplay(this.gamedatas.deckCount || 0);

    // Update discard pile with the played card
    if (args.card_type && args.card_type_arg !== undefined) {
      const discardedCard: Card = {
        id: args.card_id,
        type: args.card_type,
        type_arg: args.card_type_arg,
      };
      this.updateDiscardDisplay(discardedCard);
    }

    // Remove card from hand if it's current player's card
    if (this.gamedatas.hand) {
      this.gamedatas.hand = this.gamedatas.hand.filter((card) => card.id !== args.card_id);
      this.updateHand(this.gamedatas.hand);
    }
  }

  async notif_threesomePlayed(args: any): Promise<void> {
    console.log("Threesome played:", args);
    // Update deck display
    this.updateDeckDisplay(Math.max(0, (this.gamedatas.deckCount || 0)));

    // For threesome, we could show the last card or keep the previous discard
    // For now, we'll keep the current discard display

    // Remove cards from hand
    if (this.gamedatas.hand) {
      this.gamedatas.hand = this.gamedatas.hand.filter((card) => !args.card_ids.includes(card.id));
      this.updateHand(this.gamedatas.hand);
    }

    // Update golden potatoes
    if (this.gamedatas.players && this.gamedatas.players[args.player_id]) {
      this.gamedatas.players[args.player_id].golden_potatoes =
        (this.gamedatas.players[args.player_id].golden_potatoes || 0) + args.golden_potatoes;
      
      // Update golden potato cards display if it's the current player
      if (args.player_id === this.bga.gameui.player_id) {
        const newCount = this.gamedatas.players[args.player_id].golden_potatoes || 0;
        this.updateGoldenPotatoCards(newCount);
      }
    }
  }

  async notif_cardCancelled(args: any): Promise<void> {
    console.log("Card cancelled:", args);
    // Card was cancelled, no effect
  }

  async notif_threesomeCancelled(args: any): Promise<void> {
    console.log("Threesome cancelled:", args);
    // Threesome was cancelled, reverse golden potatoes
    if (this.gamedatas.players && this.gamedatas.players[args.target_player_id]) {
      this.gamedatas.players[args.target_player_id].golden_potatoes = Math.max(
        0,
        (this.gamedatas.players[args.target_player_id].golden_potatoes || 0) - 3,
      );
      
      // Update golden potato cards display if it's the current player
      if (args.target_player_id === this.bga.gameui.player_id) {
        const newCount = this.gamedatas.players[args.target_player_id].golden_potatoes || 0;
        this.updateGoldenPotatoCards(newCount);
      }
    }
  }

  async notif_cardDrawn(args: any): Promise<void> {
    console.log("Card drawn:", args);
    // Update deck display
    this.updateDeckDisplay(Math.max(0, (this.gamedatas.deckCount || 0) - 1));

    // Add card to hand if it's current player
    if (args.player_id == this.bga.gameui.player_id && this.gamedatas.hand) {
      // Card will be added by server, update hand display
      this.updateHand(this.gamedatas.hand);
    }
  }

  async notif_cardsDiscarded(args: any): Promise<void> {
    console.log("Cards discarded:", args);
    // Update deck display
    this.updateDeckDisplay(Math.max(0, (this.gamedatas.deckCount || 0)));
    // Note: We don't update discard display here as we don't know which card was last

    // Remove cards from hand
    if (this.gamedatas.hand) {
      this.gamedatas.hand = this.gamedatas.hand.filter((card) => !args.card_ids.includes(card.id));
      this.updateHand(this.gamedatas.hand);
    }
  }

  async notif_turnEnded(args: any): Promise<void> {
    console.log("Turn ended:", args);
  }

  async notif_emptyHandDraw(args: any): Promise<void> {
    console.log("Empty hand draw:", args);
    // Update deck display
    this.updateDeckDisplay(Math.max(0, (this.gamedatas.deckCount || 0) - 3));
  }

  async notif_discardAndDraw(args: any): Promise<void> {
    console.log("Discard and draw:", args);
    // Update deck display
    this.updateDeckDisplay(Math.max(0, (this.gamedatas.deckCount || 0) - 3));
  }

  async notif_deckReshuffled(args: any): Promise<void> {
    console.log("Deck reshuffled:", args);
    // Deck was reshuffled, update display
    this.updateDeckDisplay(this.gamedatas.deckCount || 0);
    // Clear discard display when deck is reshuffled
    this.updateDiscardDisplay(null);
  }
}

export { Game };
