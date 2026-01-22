/*
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * DondeLasPapasQueman implementation : © tikoflano
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */

import {
  decodeCardTypeArg,
  getCardTooltipHtml,
  isInterruptCard,
} from "./domain/CardRules";
import { DeckView } from "./ui/DeckView";
import { DiscardView } from "./ui/DiscardView";
import { GoldenPotatoView } from "./ui/GoldenPotatoView";
import { HandView } from "./ui/HandView";
import { createStateHandlers } from "./states";
import type { ClientStateHandler } from "./states/ClientStateHandler";
import { GameNotifications } from "./notifications/Notifications";

class Game {
  public bga: Bga<DondeLasPapasQuemanGamedatas>;
  private gamedatas: DondeLasPapasQuemanGamedatas;

  // In ReactionPhase we need to avoid double-sending actions (race with auto-skip).
  private reactionActionSent = false;

  // Selected cards for threesome
  private selectedCards: number[] = [];

  // Latest discarded card (for display)
  private latestDiscardedCard: Card | null = null;

  // When a card is played, we optimistically show it in discard immediately.
  // If it gets interrupted, we revert back to the previous discard.
  private pendingDiscardCardId: number | null = null;
  private discardBeforePending: Card | null = null;

  // Cache revealed card identity by id (used to update hands without refresh)
  private revealedCardsById: Map<number, Card> = new Map();

  private handView = new HandView();
  private deckView = new DeckView();
  private discardView = new DiscardView();
  private goldenPotatoView = new GoldenPotatoView();
  private stateHandlers: Record<string, ClientStateHandler>;
  private notifications: GameNotifications;

  constructor(bga: Bga<DondeLasPapasQuemanGamedatas>) {
    console.log("dondelaspapasqueman constructor");
    this.bga = bga;
    this.stateHandlers = createStateHandlers(this);
    this.notifications = new GameNotifications(this);
  }

  private asInt(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  getGamedatas(): DondeLasPapasQuemanGamedatas {
    return this.gamedatas;
  }

  getSelectedCards(): number[] {
    return this.selectedCards;
  }

  clearSelectedCards(): void {
    this.selectedCards = [];
  }

  /**
   * Get win threshold based on player count
   * Prefers value from server (single source of truth), with fallback calculation for backwards compatibility
   */
  getWinThreshold(): number {
    // Prefer value from server (single source of truth)
    if (this.gamedatas.winThreshold !== undefined) {
      return this.gamedatas.winThreshold;
    }
    // Fallback calculation (for backwards compatibility or if server doesn't send it)
    const playerCount = Object.keys(this.gamedatas.players || {}).length;
    return playerCount <= 3 ? 8 : playerCount <= 5 ? 6 : 5;
  }

  /**
   * Setup golden potato counter and card count display in player panels
   */
  private setupPlayerPanelCounters(): void {
    const winThreshold = this.getWinThreshold();
    const players = this.gamedatas.players || {};

    for (const playerIdStr in players) {
      const playerId = Number(playerIdStr);
      const player = players[playerId];
      const goldenPotatoes = Number((player as any).golden_potatoes ?? (player as any).score ?? 0);
      const handCount = Number((player as any).handCount ?? 0);

      // Get player panel element
      const panelElement = this.bga.playerPanels.getElement(playerId);
      if (!panelElement) continue;

      // Check if counters container already exists
      let countersContainer = panelElement.querySelector('.player-counters-container');
      if (!countersContainer) {
        // Create container for both counters
        countersContainer = document.createElement('div');
        countersContainer.className = 'player-counters-container';
        panelElement.appendChild(countersContainer);
      }

      // Setup golden potato counter
      let counterElement = countersContainer.querySelector('.golden-potato-counter');
      if (!counterElement) {
        // Create counter element
        counterElement = document.createElement('div');
        counterElement.className = 'golden-potato-counter';
        counterElement.innerHTML = `
          <span class="golden-potato-icon">🥔</span>
          <span class="golden-potato-count">${goldenPotatoes}/${winThreshold}</span>
        `;
        countersContainer.appendChild(counterElement);
      } else {
        // Update existing counter
        const countSpan = counterElement.querySelector('.golden-potato-count');
        if (countSpan) {
          countSpan.textContent = `${goldenPotatoes}/${winThreshold}`;
        }
      }

      // Setup card count counter
      let cardCounterElement = countersContainer.querySelector('.card-count-counter');
      if (!cardCounterElement) {
        // Create card counter element
        cardCounterElement = document.createElement('div');
        cardCounterElement.className = 'card-count-counter';
        cardCounterElement.innerHTML = `
          <span class="card-count-icon">🃏</span>
          <span class="card-count-number">${handCount}/7</span>
        `;
        countersContainer.appendChild(cardCounterElement);
      } else {
        // Update existing counter
        const countSpan = cardCounterElement.querySelector('.card-count-number');
        if (countSpan) {
          countSpan.textContent = `${handCount}/7`;
        }
      }
    }
  }

  /**
   * Update golden potato counter for a specific player
   */
  updatePlayerPanelCounter(playerId: number): void {
    const winThreshold = this.getWinThreshold();
    const player = this.gamedatas.players?.[playerId];
    if (!player) return;

    const goldenPotatoes = Number((player as any).golden_potatoes ?? (player as any).score ?? 0);
    const panelElement = this.bga.playerPanels.getElement(playerId);
    if (!panelElement) return;

    let countersContainer = panelElement.querySelector('.player-counters-container');
    if (!countersContainer) {
      // Create container if it doesn't exist
      countersContainer = document.createElement('div');
      countersContainer.className = 'player-counters-container';
      panelElement.appendChild(countersContainer);
    }

    let counterElement = countersContainer.querySelector('.golden-potato-counter');
    if (counterElement) {
      const countSpan = counterElement.querySelector('.golden-potato-count');
      if (countSpan) {
        countSpan.textContent = `${goldenPotatoes}/${winThreshold}`;
      }
    } else {
      // Create if it doesn't exist
      counterElement = document.createElement('div');
      counterElement.className = 'golden-potato-counter';
      counterElement.innerHTML = `
        <span class="golden-potato-icon">🥔</span>
        <span class="golden-potato-count">${goldenPotatoes}/${winThreshold}</span>
      `;
      countersContainer.appendChild(counterElement);
    }
  }

  /**
   * Update card count counter for a specific player
   */
  updatePlayerCardCount(playerId: number): void {
    const player = this.gamedatas.players?.[playerId];
    if (!player) return;

    const handCount = Number((player as any).handCount ?? 0);
    const panelElement = this.bga.playerPanels.getElement(playerId);
    if (!panelElement) return;

    let countersContainer = panelElement.querySelector('.player-counters-container');
    if (!countersContainer) {
      // Create container if it doesn't exist
      countersContainer = document.createElement('div');
      countersContainer.className = 'player-counters-container';
      panelElement.appendChild(countersContainer);
    }

    let cardCounterElement = countersContainer.querySelector('.card-count-counter');
    if (cardCounterElement) {
      const countSpan = cardCounterElement.querySelector('.card-count-number');
      if (countSpan) {
        countSpan.textContent = `${handCount}/7`;
      }
    } else {
      // Create if it doesn't exist
      cardCounterElement = document.createElement('div');
      cardCounterElement.className = 'card-count-counter';
      cardCounterElement.innerHTML = `
        <span class="card-count-icon">🃏</span>
        <span class="card-count-number">${handCount}/7</span>
      `;
      countersContainer.appendChild(cardCounterElement);
    }
  }

  /**
   * Refresh all player card counts from game data
   */
  refreshAllPlayerCardCounts(): void {
    const players = this.gamedatas.players || {};
    for (const playerIdStr in players) {
      const playerId = Number(playerIdStr);
      this.updatePlayerCardCount(playerId);
    }
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
    this.updateDiscardDisplay(gamedatas.discardTopCard ?? null);

    // Setup player panel counters
    this.setupPlayerPanelCounters();

    // Setup game notifications
    this.notifications.setup();

    console.log("Ending game setup");
  }

  ///////////////////////////////////////////////////
  //// Game & client states

  onEnteringState(stateName: string, args: any): void {
    console.log("Entering state: " + stateName, args);
    if (stateName === "ReactionPhase") this.resetReactionActionSent();
    this.stateHandlers[stateName]?.onEnter?.(args);
  }

  onLeavingState(stateName: string): void {
    console.log("Leaving state: " + stateName);
    this.stateHandlers[stateName]?.onLeave?.();
    if (stateName === "ReactionPhase") this.resetReactionActionSent();
  }

  onUpdateActionButtons(stateName: string, args: any): void {
    console.log("onUpdateActionButtons: " + stateName, args);
    this.stateHandlers[stateName]?.onUpdateActionButtons?.(args);
  }

  ///////////////////////////////////////////////////
  //// Utility methods

  updateHand(hand: Card[]): void {
    const isReactionPhase =
      this.gamedatas.gamestate.name === "ReactionPhase" && this.bga.players.isCurrentPlayerActive();
    const isThreesome = isReactionPhase && this.gamedatas.gamestate.args?.is_threesome === true;

    this.handView.render({
      hand,
      selectedCardIds: this.selectedCards,
      isReactionPhase,
      isThreesome,
      onCardClick: (cardId) => this.onCardClick(cardId),
      attachTooltip: (nodeId, html) => {
        // Safe on rerenders: remove then re-add.
        this.bga.gameui.removeTooltip(nodeId);
        this.bga.gameui.addTooltipHtml(nodeId, html);
      },
    });
  }

  updateDeckDisplay(count: number): void {
    this.deckView.setCount(count);
  }

  removeCardFromMyHand(cardId: number): void {
    if (!this.gamedatas.hand) return;

    // Ensure we don't keep a stale selection on a removed card.
    this.selectedCards = this.selectedCards.filter((id) => id !== cardId);

    const newHand = this.gamedatas.hand.filter((card) => {
      const id = this.asInt((card as any).id);
      return id === null ? true : id !== cardId;
    });
    if (newHand.length !== this.gamedatas.hand.length) {
      this.gamedatas.hand = newHand;
      this.updateHand(this.gamedatas.hand);
    }
  }

  addCardToMyHand(card: Card): void {
    if (!this.gamedatas.hand) return;
    const newId = this.asInt((card as any).id);
    if (
      newId !== null &&
      this.gamedatas.hand.some((c) => {
        const existingId = this.asInt((c as any).id);
        return existingId !== null && existingId === newId;
      })
    ) {
      return;
    }

    this.gamedatas.hand.push(card);
    this.updateHand(this.gamedatas.hand);
  }

  cacheRevealedCard(card: Card): void {
    this.revealedCardsById.set(card.id, card);
  }

  getRevealedCardFromCache(cardId: number): Card | undefined {
    return this.revealedCardsById.get(cardId);
  }

  /**
   * Optimistically show a played card in the discard pile immediately.
   * If the play is interrupted, call `cancelPendingDiscard` to revert.
   */
  optimisticallySetDiscard(card: Card): void {
    this.discardBeforePending = this.latestDiscardedCard;
    this.pendingDiscardCardId = card.id;
    this.updateDiscardDisplay(card);
  }

  confirmDiscardMovedToDiscard(card: Card): void {
    this.updateDiscardDisplay(card);

    if (this.pendingDiscardCardId === card.id) {
      this.pendingDiscardCardId = null;
      this.discardBeforePending = null;
    }
  }

  cancelPendingDiscard(cardId: number): void {
    if (this.pendingDiscardCardId !== cardId) return;

    this.pendingDiscardCardId = null;
    this.updateDiscardDisplay(this.discardBeforePending);
    this.discardBeforePending = null;
  }

  clearPendingDiscardState(): void {
    this.pendingDiscardCardId = null;
    this.discardBeforePending = null;
  }

  updateDiscardDisplay(card: Card | null): void {
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
  updateGoldenPotatoCards(count: number): void {
    this.goldenPotatoView.render(count);
  }

  ///////////////////////////////////////////////////
  //// ReactionPhase helpers

  didSendReactionAction(): boolean {
    return this.reactionActionSent;
  }

  markReactionActionSent(): void {
    this.reactionActionSent = true;
  }

  resetReactionActionSent(): void {
    this.reactionActionSent = false;
  }

  ///////////////////////////////////////////////////
  //// Player's action

  onCardClick(card_id: number): void {
    console.log("onCardClick", card_id);

    const currentState = this.gamedatas.gamestate.name;
    const card = this.gamedatas.hand?.find((c) => c.id === card_id);

    // DiscardPhase: clicking cards should only toggle selection (no server call).
    if (currentState === "DiscardPhase") {
      if (!this.bga.gameui.isCurrentPlayerActive()) return;
      if (!card) return;

      if (this.selectedCards.includes(card_id)) {
        this.selectedCards = this.selectedCards.filter((id) => id !== card_id);
      } else {
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
    if (
      currentState === "ReactionPhase" &&
      this.bga.players.isCurrentPlayerActive() &&
      card &&
      isInterruptCard(card)
    ) {
      const decoded = decodeCardTypeArg(card.type_arg || 0);
      const isThreesome = this.gamedatas.gamestate.args?.is_threesome === true;

      // "No dude" cannot cancel threesomes - prevent clicking it in the UI
      if (decoded.name_index === 1 && isThreesome) {
        // "No dude" cannot cancel threesomes
        return;
      }

      // Play the interrupt card
      this.markReactionActionSent();
      const actionPromise =
        decoded.name_index === 1
          ? // "No dude"
            this.bga.actions.performAction("actPlayNoPoh", {})
          : decoded.name_index === 2
            ? // "I told you no dude"
              this.bga.actions.performAction("actPlayTeDijeQueNoPoh", {})
            : Promise.resolve();

      // If the action fails (e.g., "No dude" cannot cancel threesomes),
      // reset the flag and restart the timer so the UI doesn't get stuck
      actionPromise?.catch(() => {
        // Only reset if we're still in ReactionPhase (state might have changed)
        if (this.gamedatas.gamestate.name === "ReactionPhase") {
          this.resetReactionActionSent();
          // Restart the timer and restore the skip button
          this.onUpdateActionButtons("ReactionPhase", this.gamedatas.gamestate.args || null);
        }
      });
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
    }
  }
}

export { Game };

