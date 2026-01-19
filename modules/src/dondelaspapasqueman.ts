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

  // Selected targets for target selection
  private selectedTargets: number[] = [];

  // Reaction phase timer
  private reactionTimer: number | null = null;

  // Latest discarded card (for display)
  private latestDiscardedCard: Card | null = null;

  // Reaction phase args (for highlighting interrupt cards)
  private reactionPhaseArgs: any = null;

  // Card selection modal
  private cardSelectionDialog: PopinDialog | null = null;

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
        // Clear reaction phase args and update hand to remove highlighting
        this.reactionPhaseArgs = null;
        if (this.gamedatas.hand) {
          this.updateHand(this.gamedatas.hand);
        }
        
        // Only show buttons for the active player
        if (this.bga.gameui.isCurrentPlayerActive()) {
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
          
          if (args.canDiscardAndDraw) {
            this.bga.statusBar.addActionButton(
              _("Discard and Draw 3"),
              () => {
                this.bga.actions.performAction("actDiscardAndDraw", {});
              },
              { color: "primary" },
            );
          }
        }
        break;

      case "ReactionPhase":
        this.startReactionTimer(args);
        break;

      case "ActionResolution":
        // Clear reaction phase args and update hand to remove highlighting
        this.reactionPhaseArgs = null;
        if (this.gamedatas.hand) {
          this.updateHand(this.gamedatas.hand);
        }
        break;

      case "DiscardPhase":
        this.showDiscardPhase(args);
        break;

      case "TargetSelection":
        // Target selection buttons are handled in onUpdateActionButtons
        break;

      case "CardSelection":
        // Args might be nested in args.args
        console.log("CardSelection onEnteringState - args:", args);
        console.log("CardSelection onEnteringState - args.args:", args.args);
        const cardSelectionArgs = args.args || args;
        console.log("CardSelection onEnteringState - calling showCardSelection with:", cardSelectionArgs);
        this.showCardSelection(cardSelectionArgs);
        break;

      case "CardNameSelection":
        this.showCardNameSelection(args);
        break;
    }
  }

  onLeavingState(stateName: string): void {
    console.log("Leaving state: " + stateName);

    switch (stateName) {
      case "ReactionPhase":
        this.stopReactionTimer();
        this.reactionPhaseArgs = null;
        // Update hand to remove interrupt highlighting
        if (this.gamedatas.hand) {
          this.updateHand(this.gamedatas.hand);
        }
        break;

      case "DiscardPhase":
        this.hideDiscardPhase();
        break;

      case "TargetSelection":
        // Clear selected targets when leaving state
        this.selectedTargets = [];
        this.hideTargetSelection();
        break;

      case "CardSelection":
        this.hideCardSelection();
        break;

      case "CardNameSelection":
        this.hideCardNameSelection();
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

        case "TargetSelection":
          // Show target selection buttons in status bar
          if (this.bga.gameui.isCurrentPlayerActive() && args) {
            const targetArgs = args.args || args;
            const selectablePlayers = targetArgs.selectablePlayers || [];
            const targetCount = targetArgs.targetCount || 1;
            const requiresMultipleTargets = targetArgs.requiresMultipleTargets || false;
            
            // Store selected targets temporarily
            if (!this.selectedTargets) {
              this.selectedTargets = [];
            }
            
            // Clear previous buttons
            this.bga.statusBar.removeActionButtons();
            
            // Add button for each selectable player
            selectablePlayers.forEach((player: any) => {
              const isSelected = this.selectedTargets.includes(player.id);
              const buttonText = isSelected 
                ? _("Deselect ${player_name}").replace("${player_name}", player.name)
                : _("Select ${player_name}").replace("${player_name}", player.name);
              
              this.bga.statusBar.addActionButton(
                buttonText,
                () => {
                  if (!this.selectedTargets) {
                    this.selectedTargets = [];
                  }
                  
                  const index = this.selectedTargets.indexOf(player.id);
                  if (index > -1) {
                    // Deselect
                    this.selectedTargets.splice(index, 1);
                  } else {
                    // Select (if we haven't reached the limit)
                    if (this.selectedTargets.length < targetCount) {
                      this.selectedTargets.push(player.id);
                    }
                  }
                  
                  // If we have enough targets and it's single target, auto-confirm
                  // Otherwise, update buttons to show current selection
                  if (this.selectedTargets.length === targetCount && !requiresMultipleTargets) {
                    // Auto-confirm for single target
                    this.bga.actions.performAction("actSelectTargets", {
                      targetPlayerIds: this.selectedTargets,
                    });
                    this.selectedTargets = [];
                  } else {
                    // Update buttons to reflect selection
                    this.bga.statusBar.removeActionButtons();
                    // Re-add buttons with updated state
                    selectablePlayers.forEach((p: any) => {
                      const selected = this.selectedTargets.includes(p.id);
                      const text = selected 
                        ? _("Deselect ${player_name}").replace("${player_name}", p.name)
                        : _("Select ${player_name}").replace("${player_name}", p.name);
                      
                      this.bga.statusBar.addActionButton(
                        text,
                        () => {
                          const idx = this.selectedTargets.indexOf(p.id);
                          if (idx > -1) {
                            this.selectedTargets.splice(idx, 1);
                          } else {
                            if (this.selectedTargets.length < targetCount) {
                              this.selectedTargets.push(p.id);
                            }
                          }
                          // Trigger update to refresh buttons
                          this.bga.statusBar.removeActionButtons();
                          // Re-call onUpdateActionButtons logic
                          if (this.bga.gameui.isCurrentPlayerActive() && args) {
                            const tArgs = args.args || args;
                            const sPlayers = tArgs.selectablePlayers || [];
                            const tCount = tArgs.targetCount || 1;
                            const reqMultiple = tArgs.requiresMultipleTargets || false;
                            
                            sPlayers.forEach((pl: any) => {
                              const sel = this.selectedTargets.includes(pl.id);
                              const txt = sel 
                                ? _("Deselect ${player_name}").replace("${player_name}", pl.name)
                                : _("Select ${player_name}").replace("${player_name}", pl.name);
                              
                              this.bga.statusBar.addActionButton(txt, () => {
                                const i = this.selectedTargets.indexOf(pl.id);
                                if (i > -1) {
                                  this.selectedTargets.splice(i, 1);
                                } else {
                                  if (this.selectedTargets.length < tCount) {
                                    this.selectedTargets.push(pl.id);
                                  }
                                }
                                // Update buttons again
                                this.bga.statusBar.removeActionButtons();
                                // Re-add buttons
                                sPlayers.forEach((pl2: any) => {
                                  const sel2 = this.selectedTargets.includes(pl2.id);
                                  const txt2 = sel2 
                                    ? _("Deselect ${player_name}").replace("${player_name}", pl2.name)
                                    : _("Select ${player_name}").replace("${player_name}", pl2.name);
                                  this.bga.statusBar.addActionButton(txt2, () => {
                                    const i2 = this.selectedTargets.indexOf(pl2.id);
                                    if (i2 > -1) {
                                      this.selectedTargets.splice(i2, 1);
                                    } else {
                                      if (this.selectedTargets.length < tCount) {
                                        this.selectedTargets.push(pl2.id);
                                      }
                                    }
                                    // Update buttons
                                    this.bga.statusBar.removeActionButtons();
                                    sPlayers.forEach((pl3: any) => {
                                      const sel3 = this.selectedTargets.includes(pl3.id);
                                      const txt3 = sel3 
                                        ? _("Deselect ${player_name}").replace("${player_name}", pl3.name)
                                        : _("Select ${player_name}").replace("${player_name}", pl3.name);
                                      this.bga.statusBar.addActionButton(txt3, () => {
                                        // Similar logic...
                                      }, { color: sel3 ? "secondary" : "primary" });
                                    });
                                    if (this.selectedTargets.length === tCount) {
                                      this.bga.statusBar.addActionButton(
                                        _("Confirm Selection"),
                                        () => {
                                          this.bga.actions.performAction("actSelectTargets", {
                                            targetPlayerIds: this.selectedTargets,
                                          });
                                          this.selectedTargets = [];
                                        },
                                        { color: "primary" }
                                      );
                                    }
                                  }, { color: sel2 ? "secondary" : "primary" });
                                });
                                if (this.selectedTargets.length === tCount) {
                                  this.bga.statusBar.addActionButton(
                                    _("Confirm Selection"),
                                    () => {
                                      this.bga.actions.performAction("actSelectTargets", {
                                        targetPlayerIds: this.selectedTargets,
                                      });
                                      this.selectedTargets = [];
                                    },
                                    { color: "primary" }
                                  );
                                }
                              }, { color: sel ? "secondary" : "primary" });
                            });
                            if (this.selectedTargets.length === tCount) {
                              this.bga.statusBar.addActionButton(
                                _("Confirm Selection"),
                                () => {
                                  this.bga.actions.performAction("actSelectTargets", {
                                    targetPlayerIds: this.selectedTargets,
                                  });
                                  this.selectedTargets = [];
                                },
                                { color: "primary" }
                              );
                            }
                          }
                        },
                        { color: selected ? "secondary" : "primary" }
                      );
                    });
                    if (this.selectedTargets.length === targetCount) {
                      this.bga.statusBar.addActionButton(
                        _("Confirm Selection"),
                        () => {
                          this.bga.actions.performAction("actSelectTargets", {
                            targetPlayerIds: this.selectedTargets,
                          });
                          this.selectedTargets = [];
                        },
                        { color: "primary" }
                      );
                    }
                  }
                },
                { color: isSelected ? "secondary" : "primary" }
              );
            });
            
            // Add confirm button if we have enough targets selected
            if (this.selectedTargets.length === targetCount) {
              this.bga.statusBar.addActionButton(
                _("Confirm Selection"),
                () => {
                  this.bga.actions.performAction("actSelectTargets", {
                    targetPlayerIds: this.selectedTargets,
                  });
                  this.selectedTargets = [];
                },
                { color: "primary" }
              );
            }
          }
          break;

        case "ReactionPhase":
          // In MULTIPLE_ACTIVE_PLAYER state, check if current player is active
          // Use bga.players.isCurrentPlayerActive() which works for MULTIPLE_ACTIVE_PLAYER states
          if (this.bga.players.isCurrentPlayerActive()) {
            // Store reaction phase args for highlighting interrupt cards
            this.reactionPhaseArgs = args;
            
            // Update hand to highlight interrupt cards
            if (this.gamedatas.hand) {
              this.updateHand(this.gamedatas.hand);
            }
            
            // Add "Skip" button for all active players
            this.bga.statusBar.addActionButton(
              _("Skip"),
              () => {
                this.bga.actions.performAction("actSkipReaction", {});
              },
              { color: "secondary" },
            );
          } else {
            // Clear reaction phase args if not active
            this.reactionPhaseArgs = null;
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

    // Check if we're in reaction phase and current player is active
    const isReactionPhase = this.gamedatas.gamestate.name === "ReactionPhase" && 
                            this.bga.players.isCurrentPlayerActive();

    hand.forEach((card) => {
      const cardDiv = document.createElement("div");
      cardDiv.className = "card";
      cardDiv.dataset.cardId = card.id.toString();
      
      const cardName = this.getCardName(card);
      const cardValue = this.getCardValue(card);
      
      // Check if this is an interrupt card
      const isInterruptCard = this.isInterruptCard(card);
      
      cardDiv.innerHTML = `
                <div class="card-type">${card.type}</div>
                <div class="card-name">${cardName}</div>
                <div class="card-value">Value: ${cardValue}</div>
            `;

      // Add click handler
      cardDiv.addEventListener("click", () => this.onCardClick(card.id));

      // Highlight if selected for threesome
      if (this.selectedCards.includes(card.id)) {
        cardDiv.classList.add("selected");
      }

      // Highlight interrupt cards in reaction phase
      // Only highlight if we're in ReactionPhase AND the current player is active
      if (isReactionPhase && isInterruptCard) {
        cardDiv.classList.add("interrupt-card");
      }

      handCards.appendChild(cardDiv);
    });
  }

  /**
   * Check if a card is an interrupt card (No dude or I told you no dude)
   */
  isInterruptCard(card: Card): boolean {
    if (card.type !== "action") {
      return false;
    }
    const typeArg = card.type_arg || 0;
    const decoded = this.decodeCardTypeArg(typeArg);
    // name_index 1 = "No dude", name_index 2 = "I told you no dude"
    return decoded.name_index === 1 || decoded.name_index === 2;
  }

  /**
   * Decode card_type_arg to get name_index, value, and isAlarm
   * Format: name_index * 10000 + value * 100 + (isAlarm ? 1 : 0)
   * Value range: 0-3 (potato cards always have value 0)
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
        1: _("potato"),
        2: _("duchesses potatoes"),
        3: _("fried potatoes"),
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

  updateTargetSelectionButtons(args: any): void {
    // Clear previous buttons
    this.bga.statusBar.removeActionButtons();
    
    // Initialize selected targets if needed
    if (!this.selectedTargets) {
      this.selectedTargets = [];
    }
    
    const selectablePlayers = args.selectablePlayers || [];
    const targetCount = args.targetCount || 1;
    const requiresMultipleTargets = args.requiresMultipleTargets || false;
    
    // Add button for each selectable player
    selectablePlayers.forEach((player: any) => {
      const isSelected = this.selectedTargets.includes(player.id);
      const buttonText = isSelected 
        ? _("Deselect ${player_name}").replace("${player_name}", player.name)
        : _("Select ${player_name}").replace("${player_name}", player.name);
      
      this.bga.statusBar.addActionButton(
        buttonText,
        () => {
          const index = this.selectedTargets.indexOf(player.id);
          if (index > -1) {
            // Deselect
            this.selectedTargets.splice(index, 1);
          } else {
            // Select (if we haven't reached the limit)
            if (this.selectedTargets.length < targetCount) {
              this.selectedTargets.push(player.id);
            }
          }
          
          // For single target, auto-submit when selected
          if (this.selectedTargets.length === targetCount && !requiresMultipleTargets) {
            this.bga.actions.performAction("actSelectTargets", {
              targetPlayerIds: this.selectedTargets,
            });
            this.selectedTargets = [];
          } else {
            // For multiple targets, refresh buttons to show updated state
            this.updateTargetSelectionButtons(args);
          }
        },
        { color: isSelected ? "secondary" : "primary" }
      );
    });
    
    // Add confirm button if we have enough targets selected (for multiple targets)
    if (requiresMultipleTargets && this.selectedTargets.length === targetCount) {
      this.bga.statusBar.addActionButton(
        _("Confirm Selection"),
        () => {
          this.bga.actions.performAction("actSelectTargets", {
            targetPlayerIds: this.selectedTargets,
          });
          this.selectedTargets = [];
        },
        { color: "primary" }
      );
    }
  }


  hideTargetSelection(): void {
    const targetDiv = document.getElementById("target-selection-ui");
    if (targetDiv) {
      targetDiv.remove();
    }
  }

  showCardSelection(args: any): void {
    console.log("showCardSelection called with args:", args);
    if (!this.bga.gameui.isCurrentPlayerActive()) {
      console.log("showCardSelection: Player is not active, returning");
      return;
    }

    // Remove any existing card selection UI
    this.hideCardSelection();

    // Create the modal dialog
    console.log("showCardSelection: Creating PopinDialog");
    this.cardSelectionDialog = new ebg.popindialog();
    this.cardSelectionDialog.create("card-selection-dialog");
    this.cardSelectionDialog.setTitle(_("Select a card from ${target_name}'s hand").replace("${target_name}", args.targetPlayerName || ""));
    this.cardSelectionDialog.setMaxWidth(600);
    this.cardSelectionDialog.hideCloseIcon();
    console.log("showCardSelection: PopinDialog created, modal element:", document.getElementById("card-selection-dialog"));

    // Build the content HTML with card backs
    let cardsHtml = '<div id="card-selection-cards" style="text-align: center; padding: 20px;">';
    
    if (args.cardBacks && Array.isArray(args.cardBacks)) {
      args.cardBacks.forEach((cardBack: any) => {
        cardsHtml += `
          <div class="card-back" 
               data-position="${cardBack.position}" 
               data-card-id="${cardBack.card_id}"
               style="width: 60px; height: 90px; background-color: #8B0000; border: 2px solid #000; border-radius: 5px; cursor: pointer; display: inline-block; margin: 5px;">
          </div>
        `;
      });
    }
    
    cardsHtml += '</div>';
    this.cardSelectionDialog.setContent(cardsHtml);
    console.log("showCardSelection: Content set, showing modal");
    this.cardSelectionDialog.show();
    console.log("showCardSelection: Modal shown, checking if visible:", document.getElementById("card-selection-dialog")?.style.display);

    // Attach click handlers to card backs after a short delay to ensure DOM is ready
    setTimeout(() => {
      const cardsDiv = document.getElementById("card-selection-cards");
      if (cardsDiv) {
        const cardBacks = cardsDiv.querySelectorAll(".card-back");
        console.log("showCardSelection: Found", cardBacks.length, "card backs");
        cardBacks.forEach((backDiv) => {
          backDiv.addEventListener("click", () => {
            const position = parseInt((backDiv as HTMLElement).dataset.position || "0");
            console.log("showCardSelection: Card clicked, position:", position);
            this.bga.actions.performAction("actSelectCard", {
              cardPosition: position,
            });
            // Close the modal after selection
            this.hideCardSelection();
          });
        });
      } else {
        console.log("showCardSelection: cardsDiv not found after show()");
      }
    }, 100);
  }

  hideCardSelection(): void {
    if (this.cardSelectionDialog) {
      this.cardSelectionDialog.hide();
      this.cardSelectionDialog.destroy();
      this.cardSelectionDialog = null;
    }
  }

  showCardNameSelection(args: any): void {
    if (!this.bga.gameui.isCurrentPlayerActive()) return;

    // Remove any existing card name selection UI
    this.hideCardNameSelection();

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

    const cardTypeSelect = nameDiv.querySelector("#card-type-select") as HTMLSelectElement;
    const cardNameSelect = nameDiv.querySelector("#card-name-select") as HTMLSelectElement;
    const confirmBtn = nameDiv.querySelector("#confirm-card-name") as HTMLButtonElement;

    // Populate card types
    if (args.cardNames) {
      Object.keys(args.cardNames).forEach((cardType) => {
        const option = document.createElement("option");
        option.value = cardType;
        option.textContent = cardType.charAt(0).toUpperCase() + cardType.slice(1);
        cardTypeSelect.appendChild(option);
      });
    }

    // When card type is selected, populate card names
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

    // When card name is selected, enable confirm button
    cardNameSelect.addEventListener("change", () => {
      confirmBtn.disabled = !cardTypeSelect.value || !cardNameSelect.value;
    });

    // Confirm button handler
    confirmBtn.addEventListener("click", () => {
      const cardType = cardTypeSelect.value;
      const nameIndex = parseInt(cardNameSelect.value);
      if (cardType && nameIndex) {
        this.bga.actions.performAction("actSelectCardName", {
          card_type: cardType,
          name_index: nameIndex,
        });
      }
    });

    this.bga.gameArea.getElement().appendChild(nameDiv);
  }

  hideCardNameSelection(): void {
    const nameDiv = document.getElementById("card-name-selection-ui");
    if (nameDiv) {
      nameDiv.remove();
    }
  }

  ///////////////////////////////////////////////////
  //// Player's action

  onCardClick(card_id: number): void {
    console.log("onCardClick", card_id);

    const currentState = this.gamedatas.gamestate.name;
    const card = this.gamedatas.hand?.find((c) => c.id === card_id);

    // Check if we're in reaction phase and this is an interrupt card
    if (currentState === "ReactionPhase" && 
        this.bga.players.isCurrentPlayerActive() && 
        card && 
        this.isInterruptCard(card)) {
      // Play the interrupt card
      const decoded = this.decodeCardTypeArg(card.type_arg || 0);
      if (decoded.name_index === 1) {
        // "No dude"
        this.bga.actions.performAction("actPlayNoPoh", {});
      } else if (decoded.name_index === 2) {
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
      this.onUpdateActionButtons(currentState, this.gamedatas.gamestate.args || null);

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

    // Don't update discard pile yet - card might be interrupted
    // The card will be moved to discard in ActionResolution after reaction phase
    // Only update discard if this is not an action card requiring target selection
    // (For now, we'll handle discard in ActionResolution notification)

    // Remove card from hand if it's current player's card
    // The card is being played, so remove it from hand display
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
      // Add the new card to the hand array
      if (args.card_type && args.card_type_arg !== undefined) {
        const newCard: Card = {
          id: args.card_id,
          type: args.card_type,
          type_arg: args.card_type_arg,
        };
        this.gamedatas.hand.push(newCard);
        this.updateHand(this.gamedatas.hand);
      }
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

  // Action card notifications
  async notif_getOffThePony(args: any): Promise<void> {
    console.log("Get off the pony:", args);
    // Update golden potatoes display
    this.updateGoldenPotatoCards(this.gamedatas.players?.[this.bga.gameui.player_id]?.golden_potatoes || 0);
  }

  async notif_lendMeABuck(args: any): Promise<void> {
    console.log("Lend me a buck:", args);
    // Card was stolen, hand will be updated via getAllDatas refresh
  }

  async notif_runawayPotatoes(args: any): Promise<void> {
    console.log("Runaway potatoes:", args);
    // Update deck count
    this.updateDeckDisplay(this.gamedatas.deckCount || 0);
  }

  async notif_harryPotato(args: any): Promise<void> {
    console.log("Harry Potato:", args);
    // Player drew cards, hand will be updated via getAllDatas refresh
    this.updateDeckDisplay(this.gamedatas.deckCount || 0);
  }

  async notif_popePotato(args: any): Promise<void> {
    console.log("Pope Potato:", args);
    // Card was stolen, hand will be updated via getAllDatas refresh
  }

  async notif_popePotatoFail(args: any): Promise<void> {
    console.log("Pope Potato failed:", args);
  }

  async notif_lookAhead(args: any): Promise<void> {
    console.log("Look ahead:", args);
    // Update golden potatoes display
    this.updateGoldenPotatoCards(this.gamedatas.players?.[this.bga.gameui.player_id]?.golden_potatoes || 0);
  }

  async notif_potatoOfTheYear(args: any): Promise<void> {
    console.log("Potato of the year:", args);
    // Update golden potatoes display
    this.updateGoldenPotatoCards(this.gamedatas.players?.[this.bga.gameui.player_id]?.golden_potatoes || 0);
  }

  async notif_potatoOfDestiny(args: any): Promise<void> {
    console.log("Potato of destiny:", args);
    // Target's hand changed, will be updated via getAllDatas refresh
    this.updateDeckDisplay(this.gamedatas.deckCount || 0);
  }

  async notif_potatoDawan(args: any): Promise<void> {
    console.log("Potato Dawan:", args);
    // Card was stolen, hand will be updated via getAllDatas refresh
  }

  async notif_jumpToTheSide(args: any): Promise<void> {
    console.log("Jump to the side:", args);
    // Player drew a card, hand will be updated via getAllDatas refresh
    this.updateDeckDisplay(this.gamedatas.deckCount || 0);
  }

  async notif_papageddonOrder(args: any): Promise<void> {
    console.log("Papageddon order reversed:", args);
  }

  async notif_papageddonSteal(args: any): Promise<void> {
    console.log("Papageddon steal:", args);
    // Card was stolen, hand will be updated via getAllDatas refresh
  }

  async notif_spiderPotato(args: any): Promise<void> {
    console.log("Spider potato:", args);
    // Hands were exchanged, will be updated via getAllDatas refresh
  }

  async notif_cardSelected(args: any): Promise<void> {
    console.log("Card selected:", args);
    // Card was selected from hand (revealed)
  }

  async notif_cardNameSelected(args: any): Promise<void> {
    console.log("Card name selected:", args);
  }
}

export { Game };
