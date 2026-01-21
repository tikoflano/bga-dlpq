import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

export class CardNameSelectionState implements ClientStateHandler {
  private dialog: PopinDialog | null = null;

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

    this.dialog = new ebg.popindialog();
    this.dialog.create("card-name-selection-dialog");
    this.dialog.setTitle(_("Name a card"));
    this.dialog.setMaxWidth(500);
    this.dialog.hideCloseIcon();

    const cardNames = args?.cardNames || {};

    let contentHtml = `
      <div id="card-name-selection-content" style="padding: 20px;">
        <div style="margin-bottom: 15px;">
          <label for="card-type-select" style="display: block; margin-bottom: 5px; font-weight: bold;">${_("Card Type")}</label>
          <select id="card-type-select" class="card-type-select" style="width: 100%; padding: 8px; font-size: 14px;">
            <option value="">${_("Select card type...")}</option>
          </select>
        </div>
        <div style="margin-bottom: 15px;">
          <label for="card-name-select" style="display: block; margin-bottom: 5px; font-weight: bold;">${_("Card Name")}</label>
          <select id="card-name-select" class="card-name-select" disabled style="width: 100%; padding: 8px; font-size: 14px;">
            <option value="">${_("Select card name...")}</option>
          </select>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <button id="confirm-card-name" class="bgabutton" disabled style="cursor: not-allowed;">${_("Confirm")}</button>
        </div>
      </div>
    `;

    this.dialog.setContent(contentHtml);
    this.dialog.show();

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
    if (this.dialog) {
      this.dialog.hide();
      this.dialog.destroy();
      this.dialog = null;
    }
  }
}

