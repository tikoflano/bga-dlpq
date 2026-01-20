export class DeckView {
  setCount(count: number): void {
    const deckCountEl = document.querySelector("#deck-card .deck-count");
    if (deckCountEl) {
      deckCountEl.textContent = count.toString();
    }
  }
}

