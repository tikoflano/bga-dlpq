import {
  decodeCardTypeArg,
  getCardName,
  getCardTooltipHtml,
  getCardValue,
  getValidPlayFromSelection,
  isInterruptCard,
  type ValidPlayFromSelection,
} from "./domain/CardRules";

let BgaAnimations: any;
let BgaCards: any;

class Game {
  public bga: Bga<DondeLasPapasQuemanGamedatas>;
  private gamedatas!: DondeLasPapasQuemanGamedatas;

  private animationManager!: BgaAnimationsTypes.Manager;
  private cardsManager!: BgaCardsTypes.CardManager<Card>;
  private handStock!: BgaCardsTypes.HandStock<Card>;
  private drawDeck!: BgaCardsTypes.Deck<Card>;
  private discardPile!: BgaCardsTypes.DiscardDeck<Card>;
  private opponentHandStocks: Map<number, BgaCardsTypes.LineStock<Card>> =
    new Map();
  private goldenPotatoStocks: Map<number, BgaCardsTypes.LineStock<Card>> =
    new Map();
  private goldenPotatoPile!: BgaCardsTypes.Deck<Card>;

  // ReactionPhase double-send guard
  private reactionActionSent = false;

  // TargetSelection state
  private selectedTargets: number[] = [];

  // Revealed card cache (for steal-card effects)
  private revealedCardsById: Map<number, Card> = new Map();

  static setBgaLibs(animations: any, cards: any): void {
    BgaAnimations = animations;
    BgaCards = cards;
  }

  constructor(bga: Bga<DondeLasPapasQuemanGamedatas>) {
    console.log("dondelaspapasqueman constructor");
    this.bga = bga;
  }

  getGamedatas(): DondeLasPapasQuemanGamedatas {
    return this.gamedatas;
  }

  async setup(gamedatas: DondeLasPapasQuemanGamedatas): Promise<void> {
    console.log("Starting game setup", gamedatas);
    this.gamedatas = gamedatas;

    this.bga.gameArea.getElement().insertAdjacentHTML(
      "beforeend",
      `
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
      `,
    );

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

  private initCardManager(): void {
    this.animationManager = new BgaAnimations.Manager({
      animationsActive: () => this.bga.gameui.bgaAnimationsActive(),
    });

    const cardWidth = 120;
    const cardHeight = 168;

    this.cardsManager = new BgaCards.Manager({
      animationManager: this.animationManager,
      type: "dlpq-card",
      getId: (card: Card) => `dlpq-card-${card.id}`,
      cardWidth,
      cardHeight,
      cardBorderRadius: "8px",

      isCardVisible: (card: Card) => !!card.type,

      setupDiv: (card: Card, div: HTMLDivElement) => {
        if (card.type) {
          div.dataset.cardType = card.type;
        }
      },

      setupFrontDiv: (card: Card, div: HTMLDivElement) => {
        if (!card.type) return;

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

      setupBackDiv: (card: Card, div: HTMLDivElement) => {
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

      fakeCardGenerator: (deckId: string) =>
        ({ id: `${deckId}-fake-top` } as any),
    });
  }

  private initHandStock(hand: Card[]): void {
    this.handStock = new BgaCards.HandStock(
      this.cardsManager,
      document.getElementById("dlpq-hand")!,
      {
        cardOverlap: "60px",
        cardShift: "15px",
        inclination: 4,
      },
    );

    if (hand.length > 0) {
      this.handStock.addCards(hand);
    }
  }

  private initDrawDeck(deckCount: number): void {
    this.drawDeck = new BgaCards.Deck(
      this.cardsManager,
      document.getElementById("dlpq-deck")!,
      {
        cardNumber: deckCount,
        counter: {
          show: true,
          position: "bottom",
          extraClasses: "round",
        },
        autoUpdateCardNumber: false,
      },
    );
  }

  private initDiscardPile(cards: Card[]): void {
    this.discardPile = new BgaCards.DiscardDeck(
      this.cardsManager,
      document.getElementById("dlpq-discard")!,
      {
        maxRotation: 15,
        maxHorizontalShift: 8,
        maxVerticalShift: 8,
      },
    );

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

  private initGoldenPotatoPile(): void {
    const pileEl = document.getElementById("dlpq-golden-potato-pile")!;
    this.goldenPotatoPile = new BgaCards.Deck(
      this.cardsManager,
      pileEl,
      {
        counter: { show: true, position: "bottom", extraClasses: "round" },
        fakeCardGenerator: (deckId: string) =>
          ({ id: `${deckId}-fake-top`, type: "golden_potato" } as unknown as Card),
      },
    );

    const playerCount = Object.keys(this.gamedatas.players || {}).length;
    const maxPerPlayer = playerCount <= 3 ? 8 : playerCount <= 5 ? 6 : 5;
    const totalNeeded = maxPerPlayer * playerCount + 10;
    const pileCards: Card[] = [];
    for (let i = 0; i < totalNeeded; i++) {
      pileCards.push({
        id: 900000 + i,
        type: "golden_potato",
      } as Card);
    }
    this.goldenPotatoPile.addCards(pileCards);
  }

  private returnGoldenPotatoToPile(card: Card): void {
    this.goldenPotatoPile.addCard(card);
  }

  private async initOpponentHands(): Promise<void> {
    const container = document.getElementById("dlpq-opponents-hands")!;
    const myId = this.myPlayerId();
    const playerorder =
      (this.gamedatas as any).playerorder as (string | number)[] | undefined;
    const playerIds = playerorder
      ? playerorder.map((p) => Number(p)).filter((id) => id > 0 && id !== myId)
      : Object.keys(this.gamedatas.players || {})
          .map(Number)
          .filter((id) => id !== myId);

    for (const playerId of playerIds) {
      const player = this.gamedatas.players?.[playerId];
      if (!player) continue;

      const name = (player as any).name ?? "";
      const color = (player as any).color ?? "";
      const handCount = Number((player as any).handCount ?? 0);

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

      const cardsEl = document.getElementById(
        `dlpq-opponent-hand-${playerId}`,
      )!;
      const stock = new BgaCards.LineStock(this.cardsManager, cardsEl, {
        direction: "row",
        gap: "0",
      });
      this.opponentHandStocks.set(playerId, stock);

      const fakeCards: Card[] = [];
      for (let i = 0; i < handCount; i++) {
        fakeCards.push({
          id: -(playerId * 10000 + i),
        } as Card);
      }
      if (fakeCards.length > 0) {
        stock.addCards(fakeCards);
      }

      const goldenPotatoEl = document.getElementById(
        `dlpq-golden-potatoes-${playerId}`,
      )!;
      const gpStock = new BgaCards.LineStock(this.cardsManager, goldenPotatoEl, {
        direction: "row",
        gap: "0",
      });
      this.goldenPotatoStocks.set(playerId, gpStock);

      const gpCount = Number((player as any).golden_potatoes ?? (player as any).score ?? 0);
      for (let i = 0; i < gpCount; i++) {
        const card = this.goldenPotatoPile.getTopCard();
        if (card) await gpStock.addCard(card, { fromStock: this.goldenPotatoPile });
      }
      this.setGoldenPotatoEmptyState(playerId, gpCount === 0);
    }

    await this.initMyGoldenPotatoStock();
  }

  private async initMyGoldenPotatoStock(): Promise<void> {
    const myId = this.myPlayerId();
    const gpSection = document.getElementById("dlpq-my-golden-potato-section")!;
    gpSection.innerHTML = `
      <div class="dlpq-golden-potato-cards" id="dlpq-golden-potatoes-${myId}">
        <div class="dlpq-golden-potato-empty"></div>
      </div>
    `;

    const goldenPotatoEl = document.getElementById(
      `dlpq-golden-potatoes-${myId}`,
    )!;
    const gpStock = new BgaCards.LineStock(this.cardsManager, goldenPotatoEl, {
      direction: "row",
      gap: "0",
    });
    this.goldenPotatoStocks.set(myId, gpStock);

    const player = this.gamedatas.players?.[myId];
    const gpCount = Number(
      (player as any)?.golden_potatoes ?? (player as any)?.score ?? 0,
    );
    for (let i = 0; i < gpCount; i++) {
      const card = this.goldenPotatoPile.getTopCard();
      if (card) await gpStock.addCard(card, { fromStock: this.goldenPotatoPile });
    }
    this.setGoldenPotatoEmptyState(myId, gpCount === 0);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private applyDeterministicTransform(card: Card): void {
    const el = this.cardsManager.getCardElement(card);
    if (!el) return;
    const id = Math.abs(Number(card.id));
    const seed = (id * 2654435761) >>> 0;
    const rot = ((seed % 1000) / 1000 - 0.5) * 2 * 15;
    const dx = (((seed >>> 10) % 1000) / 1000 - 0.5) * 2 * 8;
    const dy = (((seed >>> 20) % 1000) / 1000 - 0.5) * 2 * 8;
    el.style.setProperty("--discard-deck-rotate", `${rot}deg`);
    el.style.setProperty("--discard-deck-left", `${dx}px`);
    el.style.setProperty("--discard-deck-top", `${dy}px`);
  }

  private removeDiscardTooltip(card: Card): void {
    const el = this.cardsManager.getCardElement(card);
    if (!el) return;
    const front = el.querySelector(".front");
    if (front?.id) {
      this.bga.gameui.removeTooltip(front.id);
    }
  }

  // ========================================================================
  //  Hand / Deck helpers (used by notifications)
  // ========================================================================

  removeCardFromHand(cardId: number): void {
    const card = this.handStock
      .getCards()
      .find((c) => Number(c.id) === Number(cardId));
    if (card) {
      this.handStock.removeCard(card);
    }
    this.syncHandToGamedata();
  }

  addCardToHand(card: Card): void {
    this.handStock.addCard(card);
    this.syncHandToGamedata();
  }

  /**
   * Adds a card to hand with animation from the draw deck.
   */
  private async addCardToHandWithDrawAnimation(card: Card): Promise<void> {
    await this.handStock.addCard(card, {
      fromElement: this.drawDeck.element,
    });
    this.syncHandToGamedata();
  }

  /**
   * Adds a card to hand with animation from the target's hand (for steal effects).
   * When target is another player, animates from their opponent hand stock.
   */
  private async addCardToHandWithStealAnimation(
    card: Card,
    targetPlayerId: number | null,
  ): Promise<void> {
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
    const sourceCard =
      cards.find((c) => Number(c.id) === Number(card.id)) ?? cards[0];
    const sourceEl = opponentStock.getCardElement(sourceCard);

    await this.handStock.addCard(card, { fromElement: sourceEl });
    await opponentStock.removeCard(sourceCard);
    this.syncHandToGamedata();
  }

  replaceHand(cards: Card[]): void {
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

  private syncHandToGamedata(): void {
    this.gamedatas.hand = this.handStock.getCards();
  }

  setDeckCount(count: number): void {
    const c = Math.max(0, count);
    this.gamedatas.deckCount = c;
    this.drawDeck.setCardNumber(c);
  }

  decDeckCount(delta: number): void {
    const current =
      typeof this.gamedatas.deckCount === "number"
        ? this.gamedatas.deckCount
        : 0;
    this.setDeckCount(current - delta);
  }

  // ========================================================================
  //  Player panel counters
  // ========================================================================

  private setupPlayerPanelCounters(): void {
    const winThreshold = this.getWinThreshold();
    const players = this.gamedatas.players || {};

    for (const playerIdStr in players) {
      const playerId = Number(playerIdStr);
      const player = players[playerId];
      const goldenPotatoes = Number(
        (player as any).golden_potatoes ?? (player as any).score ?? 0,
      );
      const handCount = Number((player as any).handCount ?? 0);

      const panelElement = this.bga.playerPanels.getElement(playerId);
      if (!panelElement) continue;

      let countersContainer = panelElement.querySelector(
        ".player-counters-container",
      );
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

  updatePlayerPanelCounter(playerId: number): void {
    const winThreshold = this.getWinThreshold();
    const player = this.gamedatas.players?.[playerId];
    if (!player) return;

    const goldenPotatoes = Number(
      (player as any).golden_potatoes ?? (player as any).score ?? 0,
    );

    const panelElement = this.bga.playerPanels.getElement(playerId);
    if (!panelElement) return;

    const countSpan = panelElement.querySelector(".golden-potato-count");
    if (countSpan) {
      countSpan.textContent = `${goldenPotatoes}/${winThreshold}`;
    }
  }

  updatePlayerCardCount(playerId: number): void {
    const player = this.gamedatas.players?.[playerId];
    if (!player) return;

    const handCount = Number((player as any).handCount ?? 0);
    const panelElement = this.bga.playerPanels.getElement(playerId);
    if (!panelElement) return;

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

  private updateOpponentHandDisplay(playerId: number): void {
    const stock = this.opponentHandStocks.get(playerId);
    if (!stock) return;

    const handCount = Number(
      (this.gamedatas.players?.[playerId] as any)?.handCount ?? 0,
    );
    const currentCards = stock.getCards();
    const currentCount = currentCards.length;

    if (currentCount < handCount) {
      const toAdd = handCount - currentCount;
      for (let i = 0; i < toAdd; i++) {
        const fakeCard: Card = {
          id: -(playerId * 10000 + currentCount + i),
        } as Card;
        stock.addCard(fakeCard);
      }
    } else if (currentCount > handCount) {
      const toRemove = currentCount - handCount;
      const cardsToRemove = currentCards.slice(-toRemove);
      for (const card of cardsToRemove) {
        stock.removeCard(card);
      }
    }
  }

  async applyGoldenPotatoesDelta(playerId: number, delta: number): Promise<void> {
    const p = this.gamedatas.players?.[playerId];
    if (!p) return;

    const current = Number(
      (p as any).golden_potatoes ?? (p as any).score ?? 0,
    );
    const next = Math.max(0, current + delta);
    (p as any).golden_potatoes = next;
    (p as any).score = next;

    this.updatePlayerPanelCounter(playerId);
    await this.updateGoldenPotatoDisplay(playerId);
  }

  private async updateGoldenPotatoDisplay(playerId: number): Promise<void> {
    const stock = this.goldenPotatoStocks.get(playerId);
    if (!stock) return;

    const gpCount = Number(
      (this.gamedatas.players?.[playerId] as any)?.golden_potatoes ??
        (this.gamedatas.players?.[playerId] as any)?.score ??
        0,
    );
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
    } else if (currentCount > gpCount) {
      const toRemove = currentCount - gpCount;
      const cardsToRemove = currentCards.slice(-toRemove);
      for (const card of cardsToRemove) {
        stock.removeCard(card);
        this.returnGoldenPotatoToPile(card);
      }
    }

    this.setGoldenPotatoEmptyState(playerId, gpCount === 0);
  }

  private setGoldenPotatoEmptyState(playerId: number, isEmpty: boolean): void {
    const container = document.getElementById(`dlpq-golden-potatoes-${playerId}`);
    if (!container) return;
    container.classList.toggle("empty", isEmpty);
  }

  getWinThreshold(): number {
    if (this.gamedatas.winThreshold !== undefined) {
      return this.gamedatas.winThreshold;
    }
    const playerCount = Object.keys(this.gamedatas.players || {}).length;
    return playerCount <= 3 ? 8 : playerCount <= 5 ? 6 : 5;
  }

  // ========================================================================
  //  Revealed card cache
  // ========================================================================

  cacheRevealedCard(card: Card): void {
    this.revealedCardsById.set(card.id, card);
  }

  getRevealedCardFromCache(cardId: number): Card | undefined {
    return this.revealedCardsById.get(cardId);
  }

  // ========================================================================
  //  Utility
  // ========================================================================

  private asInt(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  private myPlayerId(): number {
    return this.bga.players.getCurrentPlayerId();
  }

  // ========================================================================
  //  State machine
  // ========================================================================

  onEnteringState(stateName: string, args: any): void {
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

  onLeavingState(stateName: string): void {
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

  onUpdateActionButtons(stateName: string, args: any): void {
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

  private enterPlayerTurn(_args: any): void {
    if (!this.bga.players.isCurrentPlayerActive()) return;

    this.handStock.setSelectionMode("multiple");
    this.handStock.unselectAll();
    this.handStock.onCardClick = (_card: Card) => {
      this.updatePlayerTurnButtons(
        this.gamedatas.gamestate.args || null,
      );
    };
  }

  private leavePlayerTurn(): void {
    this.handStock.setSelectionMode("none");
    this.handStock.unselectAll();
    this.handStock.onCardClick = undefined;
  }

  private updatePlayerTurnButtons(args: any): void {
    if (!this.bga.players.isCurrentPlayerActive()) return;

    this.bga.statusBar.removeActionButtons();

    const stateArgs = args?.args ?? args;
    const canDiscardAndDraw = !!stateArgs?.canDiscardAndDraw;
    if (canDiscardAndDraw) {
      this.bga.statusBar.addActionButton(
        _("Discard and Draw 3"),
        () => {
          this.bga.actions.performAction("actDiscardAndDraw", {});
        },
        { color: "primary" },
      );
    }

    const selectedCards = this.handStock.getSelection();
    const selectedIds = selectedCards.map((c) => c.id);
    const validPlay = getValidPlayFromSelection(
      this.handStock.getCards(),
      selectedIds,
    );

    if (validPlay) {
      this.bga.statusBar.addActionButton(
        validPlay.label,
        () => this.executePlay(validPlay),
        { color: "primary" },
      );
    }

    this.bga.statusBar.addActionButton(
      _("End Turn"),
      () => {
        this.bga.actions.performAction("actEndTurn", {});
      },
      { color: "alert" },
    );
  }

  private executePlay(play: ValidPlayFromSelection): void {
    if (play.kind === "single") {
      this.bga.actions.performAction("actPlayCard", {
        card_id: play.cardId,
      });
    } else {
      this.bga.actions.performAction("actPlayThreesome", {
        card_ids: play.cardIds,
      });
    }

    this.handStock.unselectAll();
  }

  // ========================================================================
  //  TargetSelection state
  // ========================================================================

  private leaveTargetSelection(): void {
    this.selectedTargets = [];
  }

  private updateTargetSelectionButtons(args: any): void {
    if (!this.bga.players.isCurrentPlayerActive()) return;
    if (!args) return;

    const a = args.args || args;
    const selectablePlayers: any[] = a.selectablePlayers || [];
    const targetCount: number = a.targetCount || 1;
    const requiresMultipleTargets: boolean = !!a.requiresMultipleTargets;

    this.renderTargetButtons(
      selectablePlayers,
      targetCount,
      requiresMultipleTargets,
    );
  }

  private renderTargetButtons(
    selectablePlayers: any[],
    targetCount: number,
    requiresMultipleTargets: boolean,
  ): void {
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

      const btn = this.bga.statusBar.addActionButton(
        buttonText,
        () => {
          const idx = this.selectedTargets.indexOf(player.id);
          if (idx > -1) {
            this.selectedTargets.splice(idx, 1);
          } else if (this.selectedTargets.length < targetCount) {
            this.selectedTargets.push(player.id);
          }

          if (
            this.selectedTargets.length === targetCount &&
            !requiresMultipleTargets
          ) {
            this.bga.actions.performAction("actSelectTargets", {
              targetPlayerIds: this.selectedTargets,
            });
            this.selectedTargets = [];
          } else {
            this.renderTargetButtons(
              selectablePlayers,
              targetCount,
              requiresMultipleTargets,
            );
          }
        },
        { color: isSelected ? "secondary" : "primary" },
      );
      if (btn && colorBox) {
        btn.innerHTML = buttonText;
      }
    }

    if (
      requiresMultipleTargets &&
      this.selectedTargets.length === targetCount
    ) {
      this.bga.statusBar.addActionButton(
        _("Confirm Selection"),
        () => {
          this.bga.actions.performAction("actSelectTargets", {
            targetPlayerIds: this.selectedTargets,
          });
          this.selectedTargets = [];
        },
        { color: "primary" },
      );
    }
  }

  // ========================================================================
  //  ReactionPhase state
  // ========================================================================

  private reactionCountdownId: number | null = null;
  private reactionAutoSkipId: number | null = null;
  private reactionSkipButton: HTMLButtonElement | null = null;
  private reactionTimeSeconds = 7;

  private enterReactionPhase(args: any): void {
    if (args?.reaction_time_seconds) {
      this.reactionTimeSeconds = args.reaction_time_seconds;
    }
    this.reactionActionSent = false;
    this.maybeStartReactionTimer();
  }

  private leaveReactionPhase(): void {
    this.stopReactionTimer();
    this.reactionActionSent = false;
  }

  private updateReactionPhaseButtons(args: any): void {
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

    this.reactionSkipButton = this.bga.statusBar.addActionButton(
      _("Skip"),
      () => this.sendReactionSkip(),
      { color: "primary" },
    );

    this.maybeStartReactionTimer();
  }

  private maybeStartReactionTimer(): void {
    if (this.gamedatas.gamestate.name !== "ReactionPhase") return;
    if (!this.bga.players.isCurrentPlayerActive()) return;
    if (this.reactionActionSent) return;
    if (
      this.reactionCountdownId !== null ||
      this.reactionAutoSkipId !== null
    )
      return;

    const seconds = this.reactionTimeSeconds;
    const deadlineMs = Date.now() + seconds * 1000;
    let lastShown = seconds;

    if (this.reactionSkipButton) {
      this.reactionSkipButton.textContent = _("Skip") + ` (${seconds})`;
    }

    this.reactionAutoSkipId = window.setTimeout(() => {
      if (this.gamedatas.gamestate.name !== "ReactionPhase") return;
      if (!this.bga.players.isCurrentPlayerActive()) return;
      if (this.reactionActionSent) return;
      this.sendReactionSkip();
    }, seconds * 1000);

    this.reactionCountdownId = window.setInterval(() => {
      if (
        this.gamedatas.gamestate.name !== "ReactionPhase" ||
        !this.bga.players.isCurrentPlayerActive() ||
        this.reactionActionSent
      ) {
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

  private sendReactionSkip(): void {
    if (this.reactionActionSent) return;
    if (this.gamedatas.gamestate.name !== "ReactionPhase") {
      this.stopReactionTimer();
      return;
    }
    this.reactionActionSent = true;
    this.bga.actions.performAction("actSkipReaction", {});
    this.stopReactionTimer();
  }

  private stopReactionTimer(): void {
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

  private enterDiscardPhase(args: any): void {
    if (!this.bga.players.isCurrentPlayerActive()) return;

    this.handStock.setSelectionMode("multiple");
    this.handStock.unselectAll();
    this.handStock.onCardClick = (_card: Card) => {
      this.updateDiscardPhaseButtons(args);
    };
  }

  private leaveDiscardPhase(): void {
    this.handStock.setSelectionMode("none");
    this.handStock.unselectAll();
    this.handStock.onCardClick = undefined;
  }

  private updateDiscardPhaseButtons(args: any): void {
    if (!this.bga.players.isCurrentPlayerActive()) return;

    this.bga.statusBar.removeActionButtons();

    const handSize = this.handStock.getCards().length;
    const selectedCount = this.handStock.getSelection().length;
    const cardsToDiscard = Math.max(0, handSize - 7);

    if (cardsToDiscard <= 0) return;

    let label: string;
    let disabled = false;

    if (selectedCount < cardsToDiscard) {
      const remaining = cardsToDiscard - selectedCount;
      const word = remaining === 1 ? "card" : "cards";
      label = _("Select ${count} more ${cardWord}")
        .replace("${count}", String(remaining))
        .replace("${cardWord}", word);
      disabled = true;
    } else if (selectedCount > cardsToDiscard) {
      const excess = selectedCount - cardsToDiscard;
      const word = excess === 1 ? "card" : "cards";
      label = _("Unselect ${count} more ${cardWord}")
        .replace("${count}", String(excess))
        .replace("${cardWord}", word);
      disabled = true;
    } else {
      const word = selectedCount === 1 ? "card" : "cards";
      label = _("Discard ${count} ${cardWord}")
        .replace("${count}", String(selectedCount))
        .replace("${cardWord}", word);
    }

    this.bga.statusBar.addActionButton(
      label,
      () => {
        const cardIds = this.handStock
          .getSelection()
          .map((c) => c.id);
        if (
          this.handStock.getCards().length - cardIds.length !== 7
        )
          return;

        this.bga.actions.performAction("actDiscardCards", {
          card_ids: cardIds,
        });
        this.handStock.unselectAll();
        this.bga.statusBar.removeActionButtons();
      },
      { color: "primary", disabled },
    );
  }

  // ========================================================================
  //  CardSelection state (Pope Potato / Potato Dawan pick-a-card)
  // ========================================================================

  private cardSelectionState: {
    targetPlayerId: number;
    tokens: { selectToken: string }[];
    restoredFakeCards?: Card[];
  } | null = null;

  private async enterCardSelection(args: any): Promise<void> {
    if (!this.bga.players.isCurrentPlayerActive()) return;

    const a = args?.args || args || {};
    const targetPlayerId = this.asInt(a.targetPlayerId) ?? 0;
    const revealedCards: any[] = a.revealedCards || [];
    const cardBacks: any[] = a.cardBacks || [];

    const tokens =
      revealedCards.length > 0
        ? revealedCards.map((rc: any) => ({ selectToken: rc.selectToken }))
        : cardBacks.map((cb: any) => ({ selectToken: cb.selectToken }));

    if (targetPlayerId === 0 || tokens.length === 0) return;

    const stock = this.opponentHandStocks.get(targetPlayerId);
    if (!stock) return;

    this.hideCardSelectionUI();

    const area = document.querySelector(
      `.dlpq-opponent-hand-area[data-player-id="${targetPlayerId}"]`,
    ) as HTMLElement;
    if (area) {
      area.classList.add("dlpq-card-selection-target");
    }

    let selectionDone = false;
    const doSelect = (index: number) => {
      if (selectionDone) return;
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
      const cardsToAdd: Card[] = revealedCards.map((rc: any) => ({
        id: rc.card_id ?? rc.id,
        type: rc.type ?? rc.card_type,
        type_arg: rc.type_arg ?? rc.card_type_arg,
      })) as Card[];
      await stock.addCards(cardsToAdd);
      this.cardSelectionState = {
        targetPlayerId,
        tokens,
        restoredFakeCards: currentCards,
      };
    } else {
      const currentCards = stock.getCards();
      if (currentCards.length !== tokens.length) return;

      // Do NOT remove/re-add: bga-cards throws "card element exists but is not attached to any Stock"
      // when re-adding removed cards. Server already shuffles tokens, so client order is fine.
      this.cardSelectionState = { targetPlayerId, tokens };
    }

    const handleCardClick = (index: number) => {
      if (index >= 0 && index < tokens.length) {
        doSelect(index);
      }
    };

    stock.setSelectionMode("single");

    const cardsContainer = stock.element as HTMLElement;

    const delegatedClick = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest(".bga-cards_card");
      if (!card || !cardsContainer.contains(card)) return;
      e.preventDefault();
      e.stopPropagation();
      const cards = Array.from(cardsContainer.querySelectorAll(".bga-cards_card"));
      const index = cards.indexOf(card);
      if (index >= 0) handleCardClick(index);
    };
    cardsContainer.addEventListener("click", delegatedClick, true);

    (this as any)._cardSelectionCleanup = () => {
      stock.setSelectionMode("none");
      stock.onCardClick = undefined;
      cardsContainer.removeEventListener("click", delegatedClick, true);
      this.bga.statusBar.removeActionButtons();
      (this as any)._cardSelectionCleanup = null;
    };
  }

  private updateCardSelectionButtons(args: any): void {
    if (!this.bga.players.isCurrentPlayerActive()) return;

    this.bga.statusBar.removeActionButtons();

    const a = args?.args || args || {};
    const revealedCards: any[] = a.revealedCards || [];
    const cardBacks: any[] = a.cardBacks || [];
    const tokens =
      revealedCards.length > 0
        ? revealedCards.map((rc: any) => rc.selectToken)
        : cardBacks.map((cb: any) => cb.selectToken);

    if (tokens.length === 0) return;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const label = _("Select card") + " " + (i + 1);
      this.bga.statusBar.addActionButton(label, () => {
        this.bga.actions.performAction("actSelectCard", { selectToken: token });
        this.hideCardSelectionUI();
      });
    }
  }

  private leaveCardSelection(): void {
    this.hideCardSelectionUI();
  }

  private hideCardSelectionUI(): void {
    const cleanup = (this as any)._cardSelectionCleanup;
    if (typeof cleanup === "function") {
      cleanup();
    }

    const state = this.cardSelectionState;
    this.cardSelectionState = null;

    if (state) {
      const area = document.querySelector(
        `.dlpq-opponent-hand-area[data-player-id="${state.targetPlayerId}"]`,
      ) as HTMLElement;
      if (area) {
        area.classList.remove("dlpq-card-selection-target");
      }

      const stock = this.opponentHandStocks.get(state.targetPlayerId);
      if (stock && state.restoredFakeCards) {
        stock.removeAll();
        const handSizeAfterSteal = Math.max(
          0,
          state.restoredFakeCards.length - 1,
        );
        const fakeCards: Card[] = [];
        for (let i = 0; i < handSizeAfterSteal; i++) {
          fakeCards.push({
            id: -(state.targetPlayerId * 10000 + i),
          } as Card);
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

  private enterCardNameSelection(args: any): void {
    if (!this.bga.players.isCurrentPlayerActive()) return;

    const a = args?.args || args || {};
    const cardNames: Record<string, string> = a.cardNames || {};

    this.showCardNameSelectionUI(cardNames);
  }

  private leaveCardNameSelection(): void {
    this.hideCardNameSelectionUI();
  }

  private showCardNameSelectionUI(
    cardNames: Record<string, string>,
  ): void {
    this.hideCardNameSelectionUI();

    const container = document.createElement("div");
    container.id = "dlpq-card-name-selection";
    container.className = "whiteblock";
    container.innerHTML = `<b>${_("Select a card name")}</b><div id="dlpq-card-name-buttons" style="display:flex;gap:8px;flex-wrap:wrap;padding:12px;justify-content:center;"></div>`;

    const gameArea = this.bga.gameArea.getElement();
    gameArea.appendChild(container);

    const buttonsDiv = document.getElementById(
      "dlpq-card-name-buttons",
    )!;

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

  private hideCardNameSelectionUI(): void {
    const el = document.getElementById("dlpq-card-name-selection");
    if (el) el.remove();
  }

  // ========================================================================
  //  Notifications
  // ========================================================================

  private setupNotifications(): void {
    console.log("notifications subscriptions setup");
    this.bga.notifications.setupPromiseNotifications({
      handlers: [this],
    });
  }

  async notif_handUpdated(args: any): Promise<void> {
    if (Array.isArray(args.hand)) {
      this.replaceHand(args.hand);

      const pid = this.myPlayerId();
      if (pid && this.gamedatas.players?.[pid]) {
        (this.gamedatas.players[pid] as any).handCount =
          args.hand.length;
        this.updatePlayerCardCount(pid);
      }
    }
    const dc = this.asInt(args.deckCount);
    if (dc !== null) {
      this.setDeckCount(dc);
    }
  }

  async notif_cardPlayed(args: any): Promise<void> {
    const playerId = this.asInt(args.player_id);
    const cardId = this.asInt(args.card_id);

    if (cardId !== null && playerId === this.myPlayerId()) {
      this.removeCardFromHand(cardId);
    }

    if (
      playerId !== null &&
      playerId !== this.myPlayerId()
    ) {
      const p = this.gamedatas.players?.[playerId];
      if (p) {
        const cur = Number((p as any).handCount ?? 0);
        (p as any).handCount = Math.max(0, cur - 1);
        this.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_threesomePlayed(args: any): Promise<void> {
    const playerId = this.asInt(args.player_id);
    const delta = this.asInt(args.golden_potatoes) ?? 0;
    if (playerId !== null && delta !== 0) {
      await this.applyGoldenPotatoesDelta(playerId, delta);
    }
  }

  async notif_threesomeScored(args: any): Promise<void> {
    const playerId = this.asInt(args.player_id);
    const delta = this.asInt(args.golden_potatoes) ?? 0;
    if (playerId !== null && delta !== 0) {
      await this.applyGoldenPotatoesDelta(playerId, delta);
    }
  }

  async notif_cardMovedToDiscard(args: any): Promise<void> {
    const cardId = this.asInt(args.card_id);
    const cardType = typeof args.card_type === "string" ? args.card_type : null;
    const cardTypeArg = this.asInt(args.card_type_arg);
    if (cardId === null || !cardType || cardTypeArg === null) return;

    // Remove tooltip from the previous top card before adding a new one
    const prevCards = this.discardPile.getCards();
    if (prevCards.length > 0) {
      this.removeDiscardTooltip(prevCards[prevCards.length - 1]);
    }

    const card: Card = { id: cardId, type: cardType, type_arg: cardTypeArg };
    await this.discardPile.addCard(card);
    this.applyDeterministicTransform(card);
  }

  async notif_cardCancelled(args: any): Promise<void> {
    const cardId = this.asInt(args.card_id);
    if (cardId === null) return;

    const card = this.discardPile
      .getCards()
      .find((c) => c.id === cardId);
    if (card) {
      this.discardPile.removeCard(card);
    }
  }

  async notif_threesomeCancelled(_args: any): Promise<void> {
    // No-op
  }

  async notif_cardDrawn(args: any): Promise<void> {
    this.decDeckCount(1);

    const playerId = this.asInt(args.player_id);

    if (playerId === this.myPlayerId()) {
      if (args.card_type && args.card_type_arg !== undefined) {
        const card: Card = {
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
        const cur = Number((p as any).handCount ?? 0);
        (p as any).handCount = cur + 1;
        this.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_cardsDiscarded(args: any): Promise<void> {
    const playerId = this.asInt(args.player_id);

    if (Array.isArray(args.card_ids)) {
      const ids = new Set(
        args.card_ids.map((x: any) => this.asInt(x)).filter((x: any) => x !== null),
      );
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
        const cur = Number((p as any).handCount ?? 0);
        (p as any).handCount = Math.max(0, cur - discounted);
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

        const card: Card = { id, type, type_arg: typeArg };
        await this.discardPile.addCard(card);
        this.applyDeterministicTransform(card);
      }
    }
  }

  async notif_turnEnded(_args: any): Promise<void> {
    // No-op
  }

  async notif_emptyHandDraw(args: any): Promise<void> {
    const dc = this.asInt(args.deckCount);
    if (dc !== null) {
      this.setDeckCount(dc);
    } else {
      this.decDeckCount(3);
    }

    const playerId = this.asInt(args.player_id);
    if (playerId !== null) {
      const p = this.gamedatas.players?.[playerId];
      if (p) {
        (p as any).handCount = 3;
        this.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_discardAndDraw(args: any): Promise<void> {
    const dc = this.asInt(args.deckCount);
    if (dc !== null) {
      this.setDeckCount(dc);
    } else {
      this.decDeckCount(3);
    }

    const playerId = this.asInt(args.player_id);
    if (playerId !== null) {
      const p = this.gamedatas.players?.[playerId];
      if (p) {
        (p as any).handCount = 3;
        this.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_deckReshuffled(args: any): Promise<void> {
    const dc = this.asInt(args.deckCount);
    if (dc !== null) {
      this.setDeckCount(dc);
    }
    this.discardPile.removeAll();
  }

  async notif_getOffThePony(args: any): Promise<void> {
    const playerId = this.asInt(args.player_id);
    const dc = this.asInt(args.deckCount);
    if (dc !== null) this.setDeckCount(dc);

    if (playerId !== null && playerId !== this.myPlayerId()) {
      const p = this.gamedatas.players?.[playerId];
      if (p) {
        const cur = Number((p as any).handCount ?? 0);
        (p as any).handCount = cur + 2;
        this.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_lendMeABuck(args: any): Promise<void> {
    const cardId = this.asInt(args.card_id);
    const targetPlayerId = this.asInt(args.target_player_id);
    const playerId = this.asInt(args.player_id);

    if (targetPlayerId === this.myPlayerId() && cardId !== null) {
      this.removeCardFromHand(cardId);
    }

    if (playerId === this.myPlayerId() && cardId !== null) {
      const type = args.card_type as string | undefined;
      const typeArg = this.asInt(args.card_type_arg);
      const card =
        type && typeArg !== null
          ? { id: cardId, type, type_arg: typeArg }
          : this.getRevealedCardFromCache(cardId);
      if (card) {
        await this.addCardToHandWithStealAnimation(card, targetPlayerId);
      }
    }

    this.adjustCardCountForSteal(targetPlayerId, playerId);
  }

  async notif_popePotato(args: any): Promise<void> {
    const cardId = this.asInt(args.card_id);
    const targetPlayerId = this.asInt(args.target_player_id);
    const playerId = this.asInt(args.player_id);

    if (targetPlayerId === this.myPlayerId() && cardId !== null) {
      this.removeCardFromHand(cardId);
    }

    if (playerId === this.myPlayerId() && cardId !== null) {
      const type = args.card_type as string | undefined;
      const typeArg = this.asInt(args.card_type_arg);
      const card =
        type && typeArg !== null
          ? { id: cardId, type, type_arg: typeArg }
          : this.getRevealedCardFromCache(cardId);
      if (card) {
        await this.addCardToHandWithStealAnimation(card, targetPlayerId);
      }
    }

    this.adjustCardCountForSteal(targetPlayerId, playerId);
  }

  async notif_popePotatoFail(_args: any): Promise<void> {
    // No-op
  }

  async notif_potatoDawan(args: any): Promise<void> {
    const cardId = this.asInt(args.card_id);
    const targetPlayerId = this.asInt(args.target_player_id);
    const playerId = this.asInt(args.player_id);

    if (targetPlayerId === this.myPlayerId() && cardId !== null) {
      this.removeCardFromHand(cardId);
    }

    if (playerId === this.myPlayerId() && cardId !== null) {
      const type = args.card_type as string | undefined;
      const typeArg = this.asInt(args.card_type_arg);
      const card =
        type && typeArg !== null
          ? { id: cardId, type, type_arg: typeArg }
          : this.getRevealedCardFromCache(cardId);
      if (card) {
        await this.addCardToHandWithStealAnimation(card, targetPlayerId);
      }
    }

    this.adjustCardCountForSteal(targetPlayerId, playerId);
  }

  async notif_lookAhead(args: any): Promise<void> {
    const targetPlayerId = this.asInt(args.target_player_id);
    if (targetPlayerId !== null) {
      await this.applyGoldenPotatoesDelta(targetPlayerId, -1);
    }
  }

  async notif_potatoOfTheYear(args: any): Promise<void> {
    const playerId = this.asInt(args.player_id);
    if (playerId !== null) {
      await this.applyGoldenPotatoesDelta(playerId, 1);
    }
  }

  async notif_potatoOfDestiny(args: any): Promise<void> {
    const dc = this.asInt(args.deckCount);
    if (dc !== null) this.setDeckCount(dc);

    const targetPlayerId = this.asInt(args.target_player_id);
    if (targetPlayerId !== null) {
      const p = this.gamedatas.players?.[targetPlayerId];
      if (p) {
        (p as any).handCount = 2;
        this.updatePlayerCardCount(targetPlayerId);
      }
    }
  }

  async notif_harryPotato(args: any): Promise<void> {
    const dc = this.asInt(args.deckCount);
    if (dc !== null) this.setDeckCount(dc);

    const playerId = this.asInt(args.player_id);
    if (playerId !== null && playerId !== this.myPlayerId()) {
      const p = this.gamedatas.players?.[playerId];
      if (p) {
        const cur = Number((p as any).handCount ?? 0);
        (p as any).handCount = cur + 2;
        this.updatePlayerCardCount(playerId);
      }
    }
  }

  async notif_runawayPotatoes(_args: any): Promise<void> {
    // No-op: deck count updated via handUpdated
  }

  async notif_spiderPotato(args: any): Promise<void> {
    const p1 = this.asInt(args.player1_id);
    const p2 = this.asInt(args.player2_id);
    if (p1 === null || p2 === null) return;

    const p1New = this.asInt(args.player1_handCount);
    const p2New = this.asInt(args.player2_handCount);

    if (p1New !== null && p2New !== null) {
      (this.gamedatas.players[p1] as any).handCount = p1New;
      (this.gamedatas.players[p2] as any).handCount = p2New;
    } else {
      const c1 = Number(
        (this.gamedatas.players[p1] as any)?.handCount ?? 0,
      );
      const c2 = Number(
        (this.gamedatas.players[p2] as any)?.handCount ?? 0,
      );
      (this.gamedatas.players[p1] as any).handCount = c2;
      (this.gamedatas.players[p2] as any).handCount = c1;
    }
    this.updatePlayerCardCount(p1);
    this.updatePlayerCardCount(p2);
  }

  async notif_cardSelected(args: any): Promise<void> {
    const cardId = this.asInt(args.card_id);
    const typeArg = this.asInt(args.card_type_arg);
    if (
      cardId !== null &&
      typeof args.card_type === "string" &&
      typeArg !== null
    ) {
      this.cacheRevealedCard({
        id: cardId,
        type: args.card_type,
        type_arg: typeArg,
      });
    }
  }

  async notif_cardNameSelected(_args: any): Promise<void> {
    // No-op
  }

  async notif_jumpToTheSide(args: any): Promise<void> {
    const dc = this.asInt(args.deckCount);
    if (dc !== null) this.setDeckCount(dc);
  }

  async notif_papageddonOrder(_args: any): Promise<void> {
    // No-op
  }

  async notif_papageddonSteal(args: any): Promise<void> {
    const cardId = this.asInt(args.card_id);
    const targetPlayerId = this.asInt(args.target_player_id);
    const playerId = this.asInt(args.player_id);

    if (targetPlayerId === this.myPlayerId() && cardId !== null) {
      this.removeCardFromHand(cardId);
    }

    this.adjustCardCountForSteal(targetPlayerId, playerId);
  }

  async notif_papageddonStealPrivate(args: any): Promise<void> {
    const cardId = this.asInt(args.card_id);
    const targetPlayerId = this.asInt(args.target_player_id);
    const playerId = this.asInt(args.player_id);
    if (playerId !== this.myPlayerId() || cardId === null) return;

    const type = args.card_type as string | undefined;
    const typeArg = this.asInt(args.card_type_arg);
    const card =
      type && typeArg !== null
        ? { id: cardId, type, type_arg: typeArg }
        : this.getRevealedCardFromCache(cardId);
    if (card) {
      await this.addCardToHandWithStealAnimation(card, targetPlayerId);
    }
  }

  private adjustCardCountForSteal(
    targetPlayerId: number | null,
    playerId: number | null,
  ): void {
    if (targetPlayerId !== null) {
      const p = this.gamedatas.players?.[targetPlayerId];
      if (p) {
        const cur = Number((p as any).handCount ?? 0);
        (p as any).handCount = Math.max(0, cur - 1);
        this.updatePlayerCardCount(targetPlayerId);
      }
    }
    if (playerId !== null && playerId !== targetPlayerId) {
      const p = this.gamedatas.players?.[playerId];
      if (p) {
        const cur = Number((p as any).handCount ?? 0);
        (p as any).handCount = cur + 1;
        this.updatePlayerCardCount(playerId);
      }
    }
  }
}

export { Game };
