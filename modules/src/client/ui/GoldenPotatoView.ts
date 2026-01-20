export class GoldenPotatoView {
  /**
   * Cards are double-sided: one side shows 1, the other shows 2.
   * Display uses as many \"2\" cards as possible, then a \"1\" card if needed.
   */
  render(count: number): void {
    const cardsContainer = document.getElementById("golden-potato-cards");
    if (!cardsContainer) return;

    cardsContainer.innerHTML = "";
    if (count === 0) return;

    const cardsWith2 = Math.floor(count / 2);
    const cardsWith1 = count % 2;

    for (let i = 0; i < cardsWith2; i++) {
      const cardDiv = document.createElement("div");
      cardDiv.className = "golden-potato-card";
      cardDiv.innerHTML = `
                <div class="potato-value">2</div>
                <div class="potato-label">Golden Potato</div>
            `;
      cardsContainer.appendChild(cardDiv);
    }

    if (cardsWith1 > 0) {
      const cardDiv = document.createElement("div");
      cardDiv.className = "golden-potato-card";
      cardDiv.innerHTML = `
                <div class="potato-value">1</div>
                <div class="potato-label">Golden Potato</div>
            `;
      cardsContainer.appendChild(cardDiv);
    }
  }
}

