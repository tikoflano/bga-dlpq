import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

type TargetSelectionArgs = {
  selectablePlayers: any[];
  targetCount: number;
  requiresMultipleTargets: boolean;
};

export class TargetSelectionState implements ClientStateHandler {
  private selectedTargets: number[] = [];

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

  onLeave(): void {
    this.selectedTargets = [];
    this.hideTargetSelection();
  }

  onUpdateActionButtons(args: any): void {
    if (!this.game.bga.gameui.isCurrentPlayerActive()) return;
    if (!args) return;

    const a = args.args || args;
    this.updateButtons({
      selectablePlayers: a.selectablePlayers || [],
      targetCount: a.targetCount || 1,
      requiresMultipleTargets: !!a.requiresMultipleTargets,
    });
  }

  private updateButtons(args: TargetSelectionArgs): void {
    this.game.bga.statusBar.removeActionButtons();

    const { selectablePlayers, targetCount, requiresMultipleTargets } = args;

    selectablePlayers.forEach((player: any) => {
      const isSelected = this.selectedTargets.includes(player.id);
      const colorBox = this.getPlayerColorBox(player.color || "");
      const playerNameWithColor = (player.name || "") + " " + colorBox;
      const buttonText = isSelected
        ? _("Deselect ${player_name}").replace("${player_name}", playerNameWithColor)
        : _("Select ${player_name}").replace("${player_name}", playerNameWithColor);

      const button = this.game.bga.statusBar.addActionButton(
        buttonText,
        () => {
          const index = this.selectedTargets.indexOf(player.id);
          if (index > -1) {
            this.selectedTargets.splice(index, 1);
          } else {
            if (this.selectedTargets.length < targetCount) {
              this.selectedTargets.push(player.id);
            }
          }

          // For single target, auto-submit when selected
          if (this.selectedTargets.length === targetCount && !requiresMultipleTargets) {
            this.game.bga.actions.performAction("actSelectTargets", {
              targetPlayerIds: this.selectedTargets,
            });
            this.selectedTargets = [];
          } else {
            // For multiple targets, refresh buttons to show updated state
            this.updateButtons(args);
          }
        },
        { color: isSelected ? "secondary" : "primary" },
      );
      // Set innerHTML to support the color box HTML
      if (button && colorBox) {
        button.innerHTML = buttonText;
      }
    });

    if (requiresMultipleTargets && this.selectedTargets.length === targetCount) {
      this.game.bga.statusBar.addActionButton(
        _("Confirm Selection"),
        () => {
          this.game.bga.actions.performAction("actSelectTargets", {
            targetPlayerIds: this.selectedTargets,
          });
          this.selectedTargets = [];
        },
        { color: "primary" },
      );
    }
  }

  private hideTargetSelection(): void {
    const targetDiv = document.getElementById("target-selection-ui");
    if (targetDiv) targetDiv.remove();
  }
}
