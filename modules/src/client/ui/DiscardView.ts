import { getCardName, getCardValue } from "../domain/CardRules";

export class DiscardView {
  render(card: Card | null): void {
    const discardCardEl = document.getElementById("discard-card");
    if (!discardCardEl) return;

    if (card) {
      const cardName = getCardName(card);
      const cardValue = getCardValue(card);

      discardCardEl.innerHTML = `
                <div class="card-type">${card.type}</div>
                <div class="card-name">${cardName}</div>
                <div class="card-value">Value: ${cardValue}</div>
            `;
      discardCardEl.classList.remove("empty");
      return;
    }

    discardCardEl.innerHTML = '<div class="card-placeholder">Discard Pile</div>';
    discardCardEl.classList.add("empty");
  }
}

