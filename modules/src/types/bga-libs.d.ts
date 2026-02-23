/**
 * BGA runtime global to load an ESM library by name and semver version.
 */
declare function importEsmLib(name: string, version: string): Promise<any>;

/* ------------------------------------------------------------------ */
/*  bga-animations                                                     */
/* ------------------------------------------------------------------ */

declare namespace BgaAnimationsTypes {
  interface ManagerSettings {
    animationsActive: () => boolean;
  }

  class Manager {
    constructor(settings: ManagerSettings);
    animationsActive(): boolean;
    play(animation: any): Promise<any>;
    playWithDelay(animations: any[], delay: number): Promise<any>;
  }
}

/* ------------------------------------------------------------------ */
/*  bga-cards                                                          */
/* ------------------------------------------------------------------ */

declare namespace BgaCardsTypes {
  interface CardManagerSettings<T> {
    animationManager?: BgaAnimationsTypes.Manager;
    type?: string;
    getId?: (card: T) => string;
    setupDiv?: (card: T, element: HTMLDivElement) => void;
    setupFrontDiv?: (card: T, element: HTMLDivElement) => void;
    setupBackDiv?: (card: T, element: HTMLDivElement) => void;
    isCardVisible?: (card: T) => boolean;
    fakeCardGenerator?: (deckId: string) => T;
    cardWidth?: number;
    cardHeight?: number;
    cardBorderRadius?: string;
    selectableCardClass?: string | null;
    unselectableCardClass?: string | null;
    selectedCardClass?: string | null;
  }

  interface CardAnimation<T = any> {
    fromStock?: CardStock<T>;
    fromElement?: HTMLElement;
    originalSide?: "front" | "back";
    rotationDelta?: number;
    animation?: any;
  }

  interface AddCardSettings {
    forceToFront?: boolean;
    index?: number;
    updateInformations?: boolean;
    removeOtherCards?: boolean;
  }

  interface RemoveCardSettings {
    fadeOut?: boolean;
    slideTo?: HTMLElement;
  }

  type SelectionMode = "none" | "single" | "multiple";

  class CardStock<T = any> {
    element: HTMLElement;
    onCardClick?: (card: T) => void;
    onSelectionChange?: (selection: T[], lastChange: T) => void;

    getCards(): T[];
    contains(card: T): boolean;
    addCard(card: T, animation?: CardAnimation<T>, settings?: AddCardSettings): Promise<boolean>;
    addCards(cards: T[], animation?: CardAnimation<T>, settings?: AddCardSettings): Promise<boolean>;
    removeCard(card: T, settings?: RemoveCardSettings): Promise<boolean>;
    removeCards(cards: T[], settings?: RemoveCardSettings): Promise<boolean>;
    removeAll(settings?: RemoveCardSettings): Promise<boolean>;
    setSelectionMode(mode: SelectionMode): void;
    setSelectableCards(cards: T[]): void;
    getSelection(): T[];
    unselectAll(): void;
    getCardElement(card: T): HTMLElement;
  }

  interface LineStockSettings {
    wrap?: "wrap" | "nowrap";
    direction?: "row" | "column";
    center?: boolean;
    gap?: string;
    sort?: (a: any, b: any) => number;
  }

  class LineStock<T = any> extends CardStock<T> {
    constructor(manager: CardManager<T>, element: HTMLElement, settings?: LineStockSettings);
  }

  interface HandStockSettings {
    cardOverlap?: string;
    cardShift?: string;
    inclination?: number;
    sort?: (a: any, b: any) => number;
  }

  class HandStock<T = any> extends CardStock<T> {
    constructor(manager: CardManager<T>, element: HTMLElement, settings?: HandStockSettings);
  }

  type SideOrAngle = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top" | "bottom" | "left" | "right";
  type SideOrAngleOrCenter = SideOrAngle | "center";

  interface DeckCounter {
    show?: boolean;
    position?: SideOrAngleOrCenter;
    extraClasses?: string;
    hideWhenEmpty?: boolean;
    counterId?: string;
  }

  interface DeckSettings<T = any> {
    topCard?: T;
    cardNumber?: number;
    autoUpdateCardNumber?: boolean;
    autoRemovePreviousCards?: boolean;
    thicknesses?: number[];
    shadowDirection?: SideOrAngle;
    counter?: DeckCounter;
    fakeCardGenerator?: (deckId: string) => T;
  }

  class Deck<T = any> extends CardStock<T> {
    constructor(manager: CardManager<T>, element: HTMLElement, settings?: DeckSettings<T>);
    getCardNumber(): number;
    setCardNumber(cardNumber: number, topCard?: T | null): Promise<boolean>;
    getTopCard(): T | null;
    shuffle(settings?: any): Promise<boolean>;
  }

  class VoidStock<T = any> extends CardStock<T> {
    constructor(manager: CardManager<T>, element: HTMLElement);
  }

  interface FlipCardSettings {
    updateData?: boolean;
    updateMain?: boolean;
    updateFront?: boolean;
    updateBack?: boolean;
    updateMainDelay?: number;
    updateFrontDelay?: number;
    updateBackDelay?: number;
  }

  class CardManager<T = any> {
    animationManager: BgaAnimationsTypes.Manager;

    constructor(game: any, settings: CardManagerSettings<T>);
    getId(card: T): string;
    createCardElement(card: T, visible?: boolean): HTMLDivElement;
    getCardElement(card: T): HTMLElement;
    getCardStock(card: T): CardStock<T>;
    isCardVisible(card: T): boolean;
    setCardVisible(card: T, visible?: boolean, settings?: FlipCardSettings): void;
    flipCard(card: T, settings?: FlipCardSettings): void;
    updateCardInformations(card: T, settings?: Omit<FlipCardSettings, "updateData">): void;
    removeCard(card: T, settings?: RemoveCardSettings): Promise<boolean>;
    getCardWidth(): number | undefined;
    getCardHeight(): number | undefined;
    animationsActive(): boolean;
    addStock(stock: CardStock<T>): void;
    removeStock(stock: CardStock<T>): void;
  }

  function sort(...keys: string[]): (a: any, b: any) => number;
}
