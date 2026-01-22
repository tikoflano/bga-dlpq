export class GoldenPotatoPileView {
  setCount(count: number): void {
    const pileCountEl = document.querySelector("#golden-potato-pile-card .pile-count");
    if (pileCountEl) {
      pileCountEl.textContent = count.toString();
    }
  }
}
