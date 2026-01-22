import type { Game } from "../Game";

export class GameNotifications {
  constructor(private game: Game) {}

  setup(): void {
    console.log("notifications subscriptions setup");
    this.game.bga.notifications.setupPromiseNotifications({
      handlers: [this],
      // logger: console.log,
    });
  }

  private asInt(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  private setDeckCount(count: number): void {
    const gd = this.game.getGamedatas();
    gd.deckCount = Math.max(0, count);
    this.game.updateDeckDisplay(gd.deckCount);
  }

  private decDeckCount(delta: number): void {
    const gd = this.game.getGamedatas();
    const current = typeof gd.deckCount === "number" ? gd.deckCount : 0;
    this.setDeckCount(current - delta);
  }

  private applyGoldenPotatoesDelta(playerId: number, delta: number): void {
    const gd = this.game.getGamedatas();
    const p = gd.players?.[playerId];
    if (!p) return;

    const current = Number((p as any).golden_potatoes ?? (p as any).score ?? 0);
    const next = Math.max(0, current + delta);
    (p as any).golden_potatoes = next;
    // Keep score in sync too, since server does that.
    (p as any).score = next;

    if (playerId === this.game.bga.gameui.player_id) {
      this.game.updateGoldenPotatoCards(next);
    }

    // Update player panel counter
    this.game.updatePlayerPanelCounter(playerId);
  }

  async notif_handUpdated(args: any): Promise<void> {
    const gd = this.game.getGamedatas();
    if (Array.isArray(args.hand)) {
      gd.hand = args.hand;
      this.game.updateHand(gd.hand);
      
      // Update current player's card count
      const currentPlayerId = this.game.bga.gameui.player_id;
      if (currentPlayerId && gd.players?.[currentPlayerId]) {
        (gd.players[currentPlayerId] as any).handCount = args.hand.length;
        this.game.updatePlayerCardCount(currentPlayerId);
      }
    }
    const deckCount = this.asInt(args.deckCount);
    if (deckCount !== null) {
      this.setDeckCount(deckCount);
    }
  }

  async notif_cardPlayed(args: any): Promise<void> {
    console.log("Card played:", args);
    this.game.updateDeckDisplay(this.game.getGamedatas().deckCount || 0);

    const playedCardId = this.asInt(args.card_id);
    const playedCardTypeArg = this.asInt(args.card_type_arg);
    const playedCardType = typeof args.card_type === "string" ? args.card_type : null;
    
    // Cards are moved to discard immediately when played, so we can optimistically show them
    // The cardMovedToDiscard notification will confirm it, but this provides immediate feedback
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

    // Update card count for the player who played the card
    if (playerId !== null) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[playerId]) {
        const currentCount = Number((gd.players[playerId] as any).handCount ?? 0);
        (gd.players[playerId] as any).handCount = Math.max(0, currentCount - 1);
        this.game.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_threesomePlayed(args: any): Promise<void> {
    console.log("Threesome played:", args);
    this.game.updateDeckDisplay(Math.max(0, this.game.getGamedatas().deckCount || 0));

    const playerId = this.asInt(args.player_id);
    const delta = this.asInt(args.golden_potatoes) ?? 0;
    if (playerId !== null && delta !== 0) {
      this.applyGoldenPotatoesDelta(playerId, delta);
    }
  }

  async notif_threesomeScored(args: any): Promise<void> {
    console.log("Threesome scored:", args);
    this.game.updateDeckDisplay(Math.max(0, this.game.getGamedatas().deckCount || 0));

    const playerId = this.asInt(args.player_id);
    const delta = this.asInt(args.golden_potatoes) ?? 0;
    if (playerId !== null && delta !== 0) {
      this.applyGoldenPotatoesDelta(playerId, delta);
    }
  }

  async notif_cardMovedToDiscard(args: any): Promise<void> {
    const cardId = this.asInt(args.card_id);
    const cardTypeArg = this.asInt(args.card_type_arg);
    const cardType = typeof args.card_type === "string" ? args.card_type : null;
    if (cardId === null || cardTypeArg === null || !cardType) return;

    this.game.confirmDiscardMovedToDiscard({ id: cardId, type: cardType, type_arg: cardTypeArg });
  }

  async notif_cardCancelled(args: any): Promise<void> {
    console.log("Card cancelled:", args);
    const cancelledCardId = this.asInt(args.card_id);
    if (cancelledCardId !== null) {
      this.game.cancelPendingDiscard(cancelledCardId);
    }
  }

  async notif_threesomeCancelled(args: any): Promise<void> {
    console.log("Threesome cancelled:", args);
    // No golden potatoes to revert: they are awarded only after the reaction phase completes.
  }

  async notif_cardDrawn(args: any): Promise<void> {
    console.log("Card drawn:", args);
    this.decDeckCount(1);

    const gd = this.game.getGamedatas();
    const playerId = this.asInt(args.player_id);
    
    if (playerId === this.game.bga.gameui.player_id && gd.hand) {
      if (args.card_type && args.card_type_arg !== undefined) {
        const newCard: Card = {
          id: args.card_id,
          type: args.card_type,
          type_arg: args.card_type_arg,
        };
        gd.hand.push(newCard);
        this.game.updateHand(gd.hand);
      }
    }

    // Update card count for the player who drew the card
    if (playerId !== null) {
      if (gd.players?.[playerId]) {
        const currentCount = Number((gd.players[playerId] as any).handCount ?? 0);
        (gd.players[playerId] as any).handCount = currentCount + 1;
        this.game.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_cardsDiscarded(args: any): Promise<void> {
    console.log("Cards discarded:", args);
    this.game.updateDeckDisplay(Math.max(0, this.game.getGamedatas().deckCount || 0));

    const gd = this.game.getGamedatas();
    const playerId = this.asInt(args.player_id);
    
    if (gd.hand) {
      const discardedIds = new Set<number>();
      if (Array.isArray(args.card_ids)) {
        for (const raw of args.card_ids) {
          const n = this.asInt(raw);
          if (n !== null) discardedIds.add(n);
        }
      }

      gd.hand = gd.hand.filter((card) => {
        const id = this.asInt((card as any).id);
        // If we can't parse the id, don't accidentally delete the card.
        if (id === null) return true;
        return !discardedIds.has(id);
      });
      this.game.updateHand(gd.hand);
    }

    // Update card count for the player who discarded cards
    if (playerId !== null) {
      if (gd.players?.[playerId]) {
        const discardedCount = Array.isArray(args.card_ids) ? args.card_ids.length : 0;
        const currentCount = Number((gd.players[playerId] as any).handCount ?? 0);
        (gd.players[playerId] as any).handCount = Math.max(0, currentCount - discardedCount);
        this.game.updatePlayerCardCount(playerId);
      }
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

  async notif_turnEnded(args: any): Promise<void> {
    console.log("Turn ended:", args);
  }

  async notif_emptyHandDraw(args: any): Promise<void> {
    console.log("Empty hand draw:", args);
    const deckCount = this.asInt(args.deckCount);
    if (deckCount !== null) {
      this.setDeckCount(deckCount);
    } else {
      this.decDeckCount(3);
    }

    // Update card count for the player who drew cards (0 -> 3)
    const playerId = this.asInt(args.player_id);
    if (playerId !== null) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[playerId]) {
        (gd.players[playerId] as any).handCount = 3;
        this.game.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_discardAndDraw(args: any): Promise<void> {
    console.log("Discard and draw:", args);
    const deckCount = this.asInt(args.deckCount);
    if (deckCount !== null) {
      this.setDeckCount(deckCount);
    } else {
      this.decDeckCount(3);
    }

    // Update card count for the player who discarded and drew (1 -> 3, so net +2)
    const playerId = this.asInt(args.player_id);
    if (playerId !== null) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[playerId]) {
        // Player had 1 card, discarded it, drew 3, so hand count = 3
        (gd.players[playerId] as any).handCount = 3;
        this.game.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_deckReshuffled(args: any): Promise<void> {
    console.log("Deck reshuffled:", args);
    this.game.updateDeckDisplay(this.game.getGamedatas().deckCount || 0);
    this.game.updateDiscardDisplay(null);
    this.game.clearPendingDiscardState();
  }

  // Action card notifications
  async notif_getOffThePony(args: any): Promise<void> {
    console.log("Get off the pony:", args);
    const playerId = this.asInt(args.player_id);
    const targetPlayerId = this.asInt(args.target_player_id);
    if (playerId !== null) this.applyGoldenPotatoesDelta(playerId, 1);
    if (targetPlayerId !== null) this.applyGoldenPotatoesDelta(targetPlayerId, -1);
  }

  async notif_lendMeABuck(args: any): Promise<void> {
    console.log("Lend me a buck:", args);
    const cardId = this.asInt(args.card_id);
    const targetPlayerId = this.asInt(args.target_player_id);
    const playerId = this.asInt(args.player_id);

    if (targetPlayerId === this.game.bga.gameui.player_id && cardId !== null) {
      this.game.removeCardFromMyHand(cardId);
    }

    if (playerId === this.game.bga.gameui.player_id && cardId !== null) {
      const cardType = args.card_type as string | null | undefined;
      const cardTypeArg = this.asInt(args.card_type_arg);

      if (cardType && cardTypeArg !== null) {
        this.game.addCardToMyHand({ id: cardId, type: cardType, type_arg: cardTypeArg });
      } else {
        const cached = this.game.getRevealedCardFromCache(cardId);
        if (cached) this.game.addCardToMyHand(cached);
      }
    }

    // Update card counts for affected players
    if (targetPlayerId !== null) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[targetPlayerId]) {
        const currentCount = Number((gd.players[targetPlayerId] as any).handCount ?? 0);
        (gd.players[targetPlayerId] as any).handCount = Math.max(0, currentCount - 1);
        this.game.updatePlayerCardCount(targetPlayerId);
      }
    }
    if (playerId !== null && playerId !== targetPlayerId) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[playerId]) {
        const currentCount = Number((gd.players[playerId] as any).handCount ?? 0);
        (gd.players[playerId] as any).handCount = currentCount + 1;
        this.game.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_runawayPotatoes(args: any): Promise<void> {
    console.log("Runaway potatoes:", args);
    this.game.updateDeckDisplay(this.game.getGamedatas().deckCount || 0);
  }

  async notif_harryPotato(args: any): Promise<void> {
    console.log("Harry Potato:", args);
    const deckCount = this.asInt(args.deckCount);
    if (deckCount !== null) {
      this.setDeckCount(deckCount);
    }
  }

  async notif_popePotato(args: any): Promise<void> {
    console.log("Pope Potato:", args);
    const cardId = this.asInt(args.card_id);
    const targetPlayerId = this.asInt(args.target_player_id);
    const playerId = this.asInt(args.player_id);

    if (targetPlayerId === this.game.bga.gameui.player_id && cardId !== null) {
      this.game.removeCardFromMyHand(cardId);
    }

    if (playerId === this.game.bga.gameui.player_id && cardId !== null) {
      const cardType = args.card_type as string | null | undefined;
      const cardTypeArg = this.asInt(args.card_type_arg);

      if (cardType && cardTypeArg !== null) {
        this.game.addCardToMyHand({ id: cardId, type: cardType, type_arg: cardTypeArg });
      } else {
        const cached = this.game.getRevealedCardFromCache(cardId);
        if (cached) this.game.addCardToMyHand(cached);
      }
    }

    // Update card counts for affected players
    if (targetPlayerId !== null) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[targetPlayerId]) {
        const currentCount = Number((gd.players[targetPlayerId] as any).handCount ?? 0);
        (gd.players[targetPlayerId] as any).handCount = Math.max(0, currentCount - 1);
        this.game.updatePlayerCardCount(targetPlayerId);
      }
    }
    if (playerId !== null && playerId !== targetPlayerId) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[playerId]) {
        const currentCount = Number((gd.players[playerId] as any).handCount ?? 0);
        (gd.players[playerId] as any).handCount = currentCount + 1;
        this.game.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_popePotatoFail(args: any): Promise<void> {
    console.log("Pope Potato failed:", args);
  }

  async notif_lookAhead(args: any): Promise<void> {
    console.log("Look ahead:", args);
    const targetPlayerId = this.asInt(args.target_player_id);
    if (targetPlayerId !== null) this.applyGoldenPotatoesDelta(targetPlayerId, -1);
  }

  async notif_potatoOfTheYear(args: any): Promise<void> {
    console.log("Potato of the year:", args);
    const playerId = this.asInt(args.player_id);
    if (playerId !== null) this.applyGoldenPotatoesDelta(playerId, 1);
  }

  async notif_potatoOfDestiny(args: any): Promise<void> {
    console.log("Potato of destiny:", args);
    const deckCount = this.asInt(args.deckCount);
    if (deckCount !== null) {
      this.setDeckCount(deckCount);
    }
    // Target player discards hand and draws 2, so hand count becomes 2
    const targetPlayerId = this.asInt(args.target_player_id);
    if (targetPlayerId !== null) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[targetPlayerId]) {
        (gd.players[targetPlayerId] as any).handCount = 2;
        this.game.updatePlayerCardCount(targetPlayerId);
      }
    }
  }

  async notif_potatoDawan(args: any): Promise<void> {
    console.log("Potato Dawan:", args);
    const cardId = this.asInt(args.card_id);
    const targetPlayerId = this.asInt(args.target_player_id);
    const playerId = this.asInt(args.player_id);

    if (targetPlayerId === this.game.bga.gameui.player_id && cardId !== null) {
      this.game.removeCardFromMyHand(cardId);
    }

    if (playerId === this.game.bga.gameui.player_id && cardId !== null) {
      const cardType = args.card_type as string | null | undefined;
      const cardTypeArg = this.asInt(args.card_type_arg);

      if (cardType && cardTypeArg !== null) {
        this.game.addCardToMyHand({ id: cardId, type: cardType, type_arg: cardTypeArg });
      } else {
        const cached = this.game.getRevealedCardFromCache(cardId);
        if (cached) this.game.addCardToMyHand(cached);
      }
    }

    // Update card counts for affected players
    if (targetPlayerId !== null) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[targetPlayerId]) {
        const currentCount = Number((gd.players[targetPlayerId] as any).handCount ?? 0);
        (gd.players[targetPlayerId] as any).handCount = Math.max(0, currentCount - 1);
        this.game.updatePlayerCardCount(targetPlayerId);
      }
    }
    if (playerId !== null && playerId !== targetPlayerId) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[playerId]) {
        const currentCount = Number((gd.players[playerId] as any).handCount ?? 0);
        (gd.players[playerId] as any).handCount = currentCount + 1;
        this.game.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_jumpToTheSide(args: any): Promise<void> {
    console.log("Jump to the side:", args);
    const deckCount = this.asInt(args.deckCount);
    if (deckCount !== null) {
      this.setDeckCount(deckCount);
    }
  }

  async notif_papageddonOrder(args: any): Promise<void> {
    console.log("Papageddon order reversed:", args);
  }

  async notif_papageddonSteal(args: any): Promise<void> {
    console.log("Papageddon steal:", args);
    const cardId = this.asInt(args.card_id);
    const targetPlayerId = this.asInt(args.target_player_id);
    const playerId = this.asInt(args.player_id);

    if (targetPlayerId === this.game.bga.gameui.player_id && cardId !== null) {
      this.game.removeCardFromMyHand(cardId);
    }

    // Update card counts for affected players
    if (targetPlayerId !== null) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[targetPlayerId]) {
        const currentCount = Number((gd.players[targetPlayerId] as any).handCount ?? 0);
        (gd.players[targetPlayerId] as any).handCount = Math.max(0, currentCount - 1);
        this.game.updatePlayerCardCount(targetPlayerId);
      }
    }
    if (playerId !== null && playerId !== targetPlayerId) {
      const gd = this.game.getGamedatas();
      if (gd.players?.[playerId]) {
        const currentCount = Number((gd.players[playerId] as any).handCount ?? 0);
        (gd.players[playerId] as any).handCount = currentCount + 1;
        this.game.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_papageddonStealPrivate(args: any): Promise<void> {
    console.log("Papageddon steal (private):", args);

    const cardId = this.asInt(args.card_id);
    const playerId = this.asInt(args.player_id);
    if (playerId !== this.game.bga.gameui.player_id || cardId === null) return;

    const cardType = args.card_type as string | null | undefined;
    const cardTypeArg = this.asInt(args.card_type_arg);
    if (cardType && cardTypeArg !== null) {
      this.game.addCardToMyHand({ id: cardId, type: cardType, type_arg: cardTypeArg });
    }
  }

  async notif_spiderPotato(args: any): Promise<void> {
    console.log("Spider potato:", args);
    // Hands are exchanged, so we need to swap the hand counts for both players
    const player1Id = this.asInt(args.player1_id);
    const player2Id = this.asInt(args.player2_id);
    
    if (player1Id !== null && player2Id !== null) {
      const gd = this.game.getGamedatas();
      
      // Get current hand counts
      const player1Count = Number((gd.players?.[player1Id] as any)?.handCount ?? 0);
      const player2Count = Number((gd.players?.[player2Id] as any)?.handCount ?? 0);
      
      // If server sent hand counts, use those; otherwise swap the existing counts
      const player1NewCount = this.asInt(args.player1_handCount);
      const player2NewCount = this.asInt(args.player2_handCount);
      
      if (player1NewCount !== null && player2NewCount !== null) {
        // Server provided the new counts
        (gd.players[player1Id] as any).handCount = player1NewCount;
        (gd.players[player2Id] as any).handCount = player2NewCount;
      } else {
        // Swap the hand counts (Player 1 gets Player 2's count, and vice versa)
        (gd.players[player1Id] as any).handCount = player2Count;
        (gd.players[player2Id] as any).handCount = player1Count;
      }
      
      // Update the display for both players
      this.game.updatePlayerCardCount(player1Id);
      this.game.updatePlayerCardCount(player2Id);
    }
  }

  async notif_cardSelected(args: any): Promise<void> {
    console.log("Card selected:", args);
    const cardId = this.asInt(args.card_id);
    const cardTypeArg = this.asInt(args.card_type_arg);
    if (cardId !== null && typeof args.card_type === "string" && cardTypeArg !== null) {
      this.game.cacheRevealedCard({ id: cardId, type: args.card_type, type_arg: cardTypeArg });
    }
  }

  async notif_cardNameSelected(args: any): Promise<void> {
    console.log("Card name selected:", args);
  }
}

