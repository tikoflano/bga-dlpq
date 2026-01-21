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
  }

  async notif_handUpdated(args: any): Promise<void> {
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

  async notif_cardPlayed(args: any): Promise<void> {
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
    if (args.player_id == this.game.bga.gameui.player_id && gd.hand) {
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
  }

  async notif_cardsDiscarded(args: any): Promise<void> {
    console.log("Cards discarded:", args);
    this.game.updateDeckDisplay(Math.max(0, this.game.getGamedatas().deckCount || 0));

    const gd = this.game.getGamedatas();
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
  }

  async notif_discardAndDraw(args: any): Promise<void> {
    console.log("Discard and draw:", args);
    const deckCount = this.asInt(args.deckCount);
    if (deckCount !== null) {
      this.setDeckCount(deckCount);
    } else {
      this.decDeckCount(3);
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

    if (targetPlayerId === this.game.bga.gameui.player_id && cardId !== null) {
      this.game.removeCardFromMyHand(cardId);
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

