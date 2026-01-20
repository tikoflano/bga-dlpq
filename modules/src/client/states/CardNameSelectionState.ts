import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

export class CardNameSelectionState implements ClientStateHandler {
  constructor(private game: Game) {}

  onEnter(args: any): void {
    this.show(args);
  }

  onLeave(): void {
    this.hide();
  }

  private show(args: any): void {
    if (!this.game.bga.gameui.isCurrentPlayerActive()) return;

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

    const cardTypeSelect = nameDiv.querySelector("#card-type-select") as HTMLSelectElement;
    const cardNameSelect = nameDiv.querySelector("#card-name-select") as HTMLSelectElement;
    const confirmBtn = nameDiv.querySelector("#confirm-card-name") as HTMLButtonElement;

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

  private hide(): void {
    const nameDiv = document.getElementById("card-name-selection-ui");
    if (nameDiv) nameDiv.remove();
  }
}

