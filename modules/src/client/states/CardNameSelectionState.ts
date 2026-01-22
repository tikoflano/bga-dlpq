import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

export class CardNameSelectionState implements ClientStateHandler {
  private panelElement: HTMLElement | null = null;
  private backdropElement: HTMLElement | null = null;
  private gameAreaPositionModified: boolean = false;
  private handArea: HTMLElement | null = null;
  private handAreaParent: Node | null = null;
  private handAreaNextSibling: Node | null = null;

  constructor(private game: Game) {}

  onEnter(args: any): void {
    const a = args?.args || args;
    this.show(a);
  }

  onLeave(): void {
    this.hide();
  }

  private show(args: any): void {
    if (!this.game.bga.gameui.isCurrentPlayerActive()) return;

    this.hide();

    const cardNames = args?.cardNames || {};

    // Get the hand area to move it into the panel
    const handArea = document.getElementById("hand-area");
    if (!handArea) return;

    // Store hand area references for restoration
    this.handArea = handArea;
    this.handAreaParent = handArea.parentNode;
    this.handAreaNextSibling = handArea.nextSibling;

    // Get the game area to position the backdrop
    const gameArea = this.game.bga.gameArea.getElement();
    if (!gameArea) return;

    // Ensure game area has position relative for backdrop positioning
    const gameAreaStyle = window.getComputedStyle(gameArea);
    if (gameAreaStyle.position === "static") {
      gameArea.style.position = "relative";
      this.gameAreaPositionModified = true;
    } else {
      this.gameAreaPositionModified = false;
    }

    // Create backdrop overlay - append to game area so it only covers the player area
    const backdrop = document.createElement("div");
    backdrop.id = "card-name-selection-backdrop";
    backdrop.className = "card-name-selection-backdrop";
    gameArea.appendChild(backdrop);
    this.backdropElement = backdrop;

    // Create the inline selection panel
    const panel = document.createElement("div");
    panel.id = "card-name-selection-panel";
    panel.className = "card-name-selection-panel";

    panel.innerHTML = `
      <div class="card-name-selection-header">
        <h3>${_("Name a card")}</h3>
      </div>
      <div class="card-name-selection-content">
        <div class="card-name-selection-field">
          <label for="card-type-select">${_("Card Type")}</label>
          <select id="card-type-select" class="card-type-select">
            <option value="">${_("Select card type...")}</option>
          </select>
        </div>
        <div class="card-name-selection-field">
          <label for="card-name-select">${_("Card Name")}</label>
          <select id="card-name-select" class="card-name-select" disabled>
            <option value="">${_("Select card name...")}</option>
          </select>
        </div>
        <div class="card-name-selection-actions">
          <button id="confirm-card-name" class="bgabutton" disabled>${_("Confirm")}</button>
        </div>
      </div>
      <div class="card-name-selection-hand-container"></div>
    `;

    // Insert the panel where the hand area was
    if (this.handAreaParent) {
      this.handAreaParent.insertBefore(panel, this.handAreaNextSibling);
    }

    // Move the hand area into the panel
    const handContainer = panel.querySelector(".card-name-selection-hand-container");
    if (handContainer) {
      handContainer.appendChild(handArea);
    }

    this.panelElement = panel;

    // Setup event handlers
    setTimeout(() => {
      const cardTypeSelect = document.getElementById("card-type-select") as HTMLSelectElement;
      const cardNameSelect = document.getElementById("card-name-select") as HTMLSelectElement;
      const confirmBtn = document.getElementById("confirm-card-name") as HTMLButtonElement;

      if (!cardTypeSelect || !cardNameSelect || !confirmBtn) return;

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
        } else {
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

  private hide(): void {
    // Restore hand area to its original position before removing panel
    if (this.handArea && this.handAreaParent) {
      if (this.handAreaNextSibling) {
        this.handAreaParent.insertBefore(this.handArea, this.handAreaNextSibling);
      } else {
        this.handAreaParent.appendChild(this.handArea);
      }
    }

    if (this.panelElement) {
      this.panelElement.remove();
      this.panelElement = null;
    }
    if (this.backdropElement) {
      const gameArea = this.game.bga.gameArea.getElement();
      this.backdropElement.remove();
      this.backdropElement = null;
      // Reset game area position if we modified it
      if (this.gameAreaPositionModified && gameArea) {
        gameArea.style.position = "";
        this.gameAreaPositionModified = false;
      }
    }

    // Clear references
    this.handArea = null;
    this.handAreaParent = null;
    this.handAreaNextSibling = null;
  }
}

