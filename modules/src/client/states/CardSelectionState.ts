import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";
import { CardRenderer } from "../ui/CardRenderer";

export class CardSelectionState implements ClientStateHandler {
  private dialog: PopinDialog | null = null;

  constructor(private game: Game) {}

  /**
   * Generate HTML for a player color indicator box
   */
  private getPlayerColorBox(color: string): string {
    if (!color) return "";
    // Ensure color is in hex format (add # if missing)
    const hexColor = color.startsWith("#") ? color : `#${color}`;
    return `<span class="player-color-indicator" style="background-color: ${hexColor};"></span>`;
  }

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
    this.dialog.create("card-selection-dialog");
    const targetName = args.targetPlayerName || "";
    this.dialog.setTitle(
      _("Select a card from ${target_name}'s hand").replace("${target_name}", targetName),
    );
    this.dialog.setMaxWidth(600);
    this.dialog.hideCloseIcon();

    // Check if cards are revealed (Potato Dawan) or just card backs (blind selection)
    const revealedCards = args.revealedCards && Array.isArray(args.revealedCards) ? args.revealedCards : null;
    const cardBacks = args.cardBacks && Array.isArray(args.cardBacks) ? args.cardBacks : [];

    // Create container div HTML first - use flexbox to display cards in a row
    const cardsHtml = '<div id="card-selection-cards" style="display: flex; flex-direction: row; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; padding: 20px;"></div>';
    this.dialog.setContent(cardsHtml);
    this.dialog.show();

    // Helper function to center dialog relative to game area
    const centerDialog = () => {
      const dialogElement = document.getElementById("card-selection-dialog");
      const gameArea = this.game.bga.gameArea.getElement();
      
      if (!dialogElement) {
        console.warn("Dialog element not found for centering");
        return;
      }
      
      if (!gameArea) {
        console.warn("Game area not found for centering");
        return;
      }
      
      const gameAreaRect = gameArea.getBoundingClientRect();
      const dialogRect = dialogElement.getBoundingClientRect();
      
      console.log("Centering dialog - gameArea:", gameAreaRect, "dialog:", dialogRect);
      
      // Only position if we have valid dimensions
      if (dialogRect.width > 0 && dialogRect.height > 0 && gameAreaRect.width > 0) {
        // Calculate center position relative to game area
        const centerX = gameAreaRect.left + gameAreaRect.width / 2;
        const centerY = gameAreaRect.top + gameAreaRect.height / 2;
        
        // Position dialog at center, accounting for dialog's own dimensions
        const left = Math.max(0, centerX - dialogRect.width / 2);
        const top = Math.max(0, centerY - dialogRect.height / 2);
        
        console.log("Positioning dialog at:", left, top);
        
        // Apply positioning (use fixed positioning relative to viewport, but calculated from game area)
        (dialogElement as HTMLElement).style.position = "fixed";
        (dialogElement as HTMLElement).style.left = `${left}px`;
        (dialogElement as HTMLElement).style.top = `${top}px`;
        (dialogElement as HTMLElement).style.margin = "0";
        (dialogElement as HTMLElement).style.transform = "none";
      } else {
        console.warn("Dialog or game area has invalid dimensions, skipping positioning");
      }
    };

    // Now that dialog is shown, get the container and append cards
    setTimeout(() => {
      const cardsContainer = document.getElementById("card-selection-cards");
      if (!cardsContainer) {
        console.error("Card selection container not found");
        // Try to find the dialog to see if it exists
        const dialogElement = document.getElementById("card-selection-dialog");
        console.error("Dialog element exists:", !!dialogElement);
        if (dialogElement) {
          console.error("Dialog HTML:", dialogElement.innerHTML.substring(0, 200));
        }
        return;
      }

      // Check what we have
      const hasRevealedCards = revealedCards && revealedCards.length > 0;
      const hasCardBacks = cardBacks && cardBacks.length > 0;
      
      console.log("Card selection args:", {
        revealedCards: revealedCards,
        cardBacks: cardBacks,
        hasRevealedCards,
        hasCardBacks,
        targetName: args.targetPlayerName
      });

      if (hasRevealedCards) {
        // Show actual cards with their names and values (Potato Dawan)
        // Use CardRenderer to ensure they look exactly like hand cards
        console.log("Rendering revealed cards, count:", revealedCards.length);
        revealedCards.forEach((revealedCard: any) => {
          const cardDiv = CardRenderer.createCardElementFromRevealed(revealedCard, {
            onClick: (position: number) => {
              this.game.bga.actions.performAction("actSelectCard", {
                cardPosition: position,
              });
              this.hide();
            },
            attachTooltip: (nodeId: string, html: string) => {
              // Safe on rerenders: remove then re-add.
              this.game.bga.gameui.removeTooltip(nodeId);
              this.game.bga.gameui.addTooltipHtml(nodeId, html);
            },
          });
          cardsContainer.appendChild(cardDiv);
          console.log("Appended revealed card:", revealedCard);
          
          // Attach tooltip after element is in DOM
          CardRenderer.attachTooltipAfterAppend(cardDiv);
        });
      } else if (hasCardBacks) {
        // Show card backs only (blind selection)
        console.log("Rendering card backs, count:", cardBacks.length);
        cardBacks.forEach((cardBack: any) => {
          const backDiv = document.createElement("div");
          backDiv.className = "card-back";
          backDiv.dataset.position = cardBack.position.toString();
          
          // Apply styles directly since CSS might not be matching
          backDiv.style.width = "60px";
          backDiv.style.height = "90px";
          backDiv.style.backgroundColor = "#8b0000";
          backDiv.style.border = "2px solid #000";
          backDiv.style.borderRadius = "5px";
          backDiv.style.cursor = "pointer";
          backDiv.style.flexShrink = "0";
          backDiv.style.transition = "all 0.2s ease";
          
          // Add hover effect via event listeners
          backDiv.addEventListener("mouseenter", () => {
            backDiv.style.transform = "translateY(-5px)";
            backDiv.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.3)";
            backDiv.style.borderColor = "#ff6b6b";
          });
          backDiv.addEventListener("mouseleave", () => {
            backDiv.style.transform = "";
            backDiv.style.boxShadow = "";
            backDiv.style.borderColor = "#000";
          });
          
          backDiv.addEventListener("click", () => {
            const position = parseInt(backDiv.dataset.position || "0");
            this.game.bga.actions.performAction("actSelectCard", {
              cardPosition: position,
            });
            this.hide();
          });
          cardsContainer.appendChild(backDiv);
          console.log("Appended card back at position:", cardBack.position, "element:", backDiv);
        });
        console.log("Container after appending card backs:", cardsContainer.innerHTML.substring(0, 300));
      } else {
        console.warn("No cards to display in card selection - args:", args);
      }
      
      // Center the dialog after cards are added (dialog size may have changed)
      // Use a small delay to ensure DOM is updated
      setTimeout(() => {
        centerDialog();
      }, 100);
    }, 150);
  }

  private hide(): void {
    if (this.dialog) {
      this.dialog.hide();
      this.dialog.destroy();
      this.dialog = null;
    }
  }
}

