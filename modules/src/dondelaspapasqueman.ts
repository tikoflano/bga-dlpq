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
  public bga: Bga<DondeLasPapasQuemanGamedatas>;
  private gamedatas: DondeLasPapasQuemanGamedatas;

  // Selected cards for threesome
  private selectedCards: number[] = [];

  // Reaction phase timer
  private reactionTimer: number | null = null;

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
            <div id="player-tables"></div>
            <div id="hand-area"></div>
            <div id="common-area">
                <div id="deck-area">Deck: <span id="deck-count">0</span></div>
                <div id="discard-area">Discard: <span id="discard-count">0</span></div>
                <div id="golden-potato-pile">Golden Potatoes: <span id="golden-potato-count">0</span></div>
            </div>
        `,
    );

    // Setting up player boards
    Object.values(gamedatas.players).forEach((player) => {
      const playerId = typeof player.id === 'string' ? parseInt(player.id, 10) : player.id;
      // Golden potato counter
      this.bga.playerPanels.getElement(playerId).insertAdjacentHTML(
        "beforeend",
        `
                <div id="golden-potato-counter-${player.id}"></div>
            `,
      );
      const goldenPotatoCounter = new ebg.counter();
      goldenPotatoCounter.create(`golden-potato-counter-${player.id}`, {
        value: player.golden_potatoes || 0,
        playerCounter: "golden_potatoes",
        playerId: playerId,
      });

      // Player table
      const playerTables = document.getElementById("player-tables");
      if (playerTables) {
        playerTables.insertAdjacentHTML(
          "beforeend",
          `
                <div id="player-table-${player.id}">
                    <strong>${player.name}</strong>
                    <div>Golden Potatoes: <span id="player-golden-potatoes-${player.id}">${player.golden_potatoes || 0}</span></div>
                </div>
            `,
        );
      }
    });

    // Display hand
    this.updateHand(gamedatas.hand || []);

    // Update deck and discard counts
    this.updateDeckCount(gamedatas.deckCount || 0);
    this.updateDiscardCount(gamedatas.discardCount || 0);
    this.updateGoldenPotatoPileCount(gamedatas.goldenPotatoPileCount || 0);

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
            { color: "blue" },
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
          this.bga.statusBar.clear();

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
                { color: "red" },
              );
            }
            if (playerData.hasTeDijeQueNoPoh) {
              this.bga.statusBar.addActionButton(
                _("Play Te Dije Que No Poh"),
                () => {
                  this.bga.actions.performAction("actPlayTeDijeQueNoPoh", {});
                },
                { color: "red" },
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
      cardDiv.innerHTML = `
                <div class="card-type">${card.type}</div>
                <div class="card-name">Card ${card.id}</div>
                <div class="card-value">Value: ${this.getCardValue(card)}</div>
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

  getCardValue(card: Card): number {
    // Decode card_type_arg to get value
    const typeArg = card.type_arg || 0;
    const value = Math.floor((typeArg % 10000) / 100);
    return value;
  }

  updateDeckCount(count: number): void {
    const deckCountEl = document.getElementById("deck-count");
    if (deckCountEl) {
      deckCountEl.textContent = count.toString();
    }
  }

  updateDiscardCount(count: number): void {
    const discardCountEl = document.getElementById("discard-count");
    if (discardCountEl) {
      discardCountEl.textContent = count.toString();
    }
  }

  updateGoldenPotatoPileCount(count: number): void {
    const goldenPotatoCountEl = document.getElementById("golden-potato-count");
    if (goldenPotatoCountEl) {
      goldenPotatoCountEl.textContent = count.toString();
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
    this.bga.gameui.onUpdateActionButtons();

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
    // Update discard count
    this.updateDiscardCount((this.gamedatas.discardCount || 0) + 1);

    // Remove card from hand if it's current player's card
    if (this.gamedatas.hand) {
      this.gamedatas.hand = this.gamedatas.hand.filter((card) => card.id !== args.card_id);
      this.updateHand(this.gamedatas.hand);
    }
  }

  async notif_threesomePlayed(args: any): Promise<void> {
    console.log("Threesome played:", args);
    // Update discard count
    this.updateDiscardCount((this.gamedatas.discardCount || 0) + 3);

    // Remove cards from hand
    if (this.gamedatas.hand) {
      this.gamedatas.hand = this.gamedatas.hand.filter((card) => !args.card_ids.includes(card.id));
      this.updateHand(this.gamedatas.hand);
    }

    // Update golden potatoes
    if (this.gamedatas.players && this.gamedatas.players[args.player_id]) {
      this.gamedatas.players[args.player_id].golden_potatoes =
        (this.gamedatas.players[args.player_id].golden_potatoes || 0) + args.golden_potatoes;
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
    }
  }

  async notif_cardDrawn(args: any): Promise<void> {
    console.log("Card drawn:", args);
    // Update deck count
    this.updateDeckCount(Math.max(0, (this.gamedatas.deckCount || 0) - 1));

    // Add card to hand if it's current player
    if (args.player_id == this.bga.gameui.player_id && this.gamedatas.hand) {
      // Card will be added by server, just refresh
      this.bga.gameui.refreshPage();
    }
  }

  async notif_cardsDiscarded(args: any): Promise<void> {
    console.log("Cards discarded:", args);
    // Update discard count
    this.updateDiscardCount((this.gamedatas.discardCount || 0) + args.count);

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
    // Update deck count
    this.updateDeckCount(Math.max(0, (this.gamedatas.deckCount || 0) - 3));
  }

  async notif_discardAndDraw(args: any): Promise<void> {
    console.log("Discard and draw:", args);
    // Update deck and discard counts
    this.updateDeckCount(Math.max(0, (this.gamedatas.deckCount || 0) - 3));
    this.updateDiscardCount((this.gamedatas.discardCount || 0) + 1);
  }

  async notif_deckReshuffled(args: any): Promise<void> {
    console.log("Deck reshuffled:", args);
    // Deck was reshuffled, update counts
    this.updateDeckCount(this.gamedatas.deckCount || 0);
    this.updateDiscardCount(0);
  }
}

export { Game };
