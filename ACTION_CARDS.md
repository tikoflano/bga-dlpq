# Action Cards Reference

This document describes all action cards in DondeLasPapasQueman, their properties, effects, and implementation details.

## Card Properties

Each action card has:

- **name_index**: Unique identifier for the card name (used in card_type_arg encoding)
- **value**: Card value (0-3)
- **isAlarm**: Boolean flag - if true, ends turn automatically after reaction phase (if not interrupted)
- **target_required**: Whether the card requires selecting a target player before playing

## Card Distribution

### Potato Cards

- **potato**: 16 copies
- **duchesses potatoes**: 12 copies
- **french fries**: 5 copies

### Wildcards

- **Wildcard**: 3 copies

### Action Cards

- **No dude**: 10 copies
- **I told you no dude**: 3 copies
- **Get off the pony**: 5 copies
- **Lend me a buck**: 10 copies
- **Runaway potatoes**: 3 copies
- **Harry Potato**: 10 copies
- **Pope Potato**: 3 copies
- **Look ahead**: 3 copies
- **The potato of the year**: 5 copies
- **Potato of destiny**: 3 copies
- **Potato Dawan**: 3 copies
- **Jump to the side**: 3 copies
- **Papageddon**: 3 copies
- **Spider potato**: 3 copies

**Total Deck Size**: 106 cards (33 potato + 3 wildcard + 70 action)

## Action Cards List

### Interrupt Cards (Reaction Phase Only)

#### 1. "No dude" (name_index: 1)

- **Copies**: 10
- **Value**: 0
- **isAlarm**: false
- **Target Required**: No
- **Effect**: Interrupt card played during reaction phase. Can cancel regular cards and other "No dude" cards. Cannot cancel "I told you no dude" or threesomes.
- **Implementation**: Already implemented in `ReactionPhase.php`

#### 2. "I told you no dude" (name_index: 2)

- **Copies**: 3
- **Value**: 0
- **isAlarm**: false
- **Target Required**: No
- **Effect**: Interrupt card played during reaction phase. Can cancel everything including "No dude", regular cards, and threesomes.
- **Implementation**: Already implemented in `ReactionPhase.php`

### Action Cards (Played During Turn)

#### 3. "Get off the pony" (name_index: 3)

- **Copies**: 5
- **Value**: 2
- **isAlarm**: true
- **Target Required**: Yes (single opponent)
- **Effect**: Steals 1 golden potato from target player and adds it to your own.
- **Implementation Notes**:
  - Requires target selection before reaction phase
  - Use `updateGoldenPotatoes(targetId, -1)` and `updateGoldenPotatoes(activePlayerId, 1)`
  - If not interrupted, turn ends automatically (alarm card)

#### 4. "Lend me a buck" (name_index: 4)

- **Copies**: 10
- **Value**: 1
- **isAlarm**: false
- **Target Required**: Yes (single opponent)
- **Effect**: Steals a random card from target player and adds it to your hand. Player chooses card but only sees card backs (blind selection).
- **Implementation Notes**:
  - Requires target selection before reaction phase
  - Use card back selection UI to show target's hand
  - Player clicks a card back to select it (without seeing actual card)
  - Move selected card from target's hand to active player's hand
  - Card is revealed only after selection

#### 5. "Runaway potatoes" (name_index: 5)

- **Copies**: 3
- **Value**: 3
- **isAlarm**: false
- **Target Required**: No (affects all other players)
- **Effect**: Takes 1 card from each other player's hand and puts them back into the deck. Shuffles the deck.
- **Implementation Notes**:
  - For each other player: take 1 random card from their hand
  - Move all taken cards to deck
  - Shuffle deck after all cards moved
  - No target selection needed (affects all opponents)

#### 6. "Harry Potato" (name_index: 6)

- **Copies**: 10
- **Value**: 1
- **isAlarm**: true
- **Target Required**: No
- **Effect**: Draw 2 cards from the deck.
- **Implementation Notes**:
  - Use `pickCards(2, "deck", activePlayerId)`
  - Handle deck exhaustion (reshuffle if needed)
  - If not interrupted, turn ends automatically (alarm card)

#### 7. "Pope Potato" (name_index: 7)

- **Copies**: 3
- **Value**: 3
- **isAlarm**: false
- **Target Required**: Yes (single opponent)
- **Effect**: Select an opponent and name a card. If the player has that card, you steal it. If the player has multiple copies, you only steal one.
- **Implementation Notes**:
  - Requires target selection before reaction phase
  - Show card name selection dropdown (all possible card types/names)
  - Check if target has that card (by type + name_index)
  - If found, steal one copy (move to active player's hand)
  - If not found, card has no effect

#### 8. "Look ahead" (name_index: 8)

- **Copies**: 3
- **Value**: 3
- **isAlarm**: true
- **Target Required**: Yes (single opponent)
- **Effect**: Destroys 1 golden potato from target player.
- **Implementation Notes**:
  - Requires target selection before reaction phase
  - Use `updateGoldenPotatoes(targetId, -1)` (no gain for active player)
  - If not interrupted, turn ends automatically (alarm card)

#### 9. "The potato of the year" (name_index: 9)

- **Copies**: 5
- **Value**: 2
- **isAlarm**: false
- **Target Required**: No
- **Effect**: Get 1 golden potato from the supply.
- **Implementation Notes**:
  - Use `updateGoldenPotatoes(activePlayerId, 1)`
  - No target selection needed
  - Simplest action card effect

#### 10. "Potato of destiny" (name_index: 10)

- **Copies**: 3
- **Value**: 3
- **isAlarm**: false
- **Target Required**: Yes (single opponent)
- **Effect**: Target discards their entire hand and draws 2 new cards from the deck.
- **Implementation Notes**:
  - Requires target selection before reaction phase
  - Move all cards from target's hand to discard
  - Target draws 2 cards from deck (handle deck exhaustion)

#### 11. "Potato Dawan" (name_index: 11)

- **Copies**: 3
- **Value**: 3
- **isAlarm**: false
- **Target Required**: Yes (single opponent)
- **Effect**: See an opponent's hand and steal a card from it. Player chooses card but only sees card backs (blind selection).
- **Implementation Notes**:
  - Requires target selection before reaction phase
  - Use card back selection UI to show target's hand
  - Player clicks a card back to select it (without seeing actual card)
  - Move selected card from target's hand to active player's hand
  - Card is revealed only after selection

#### 12. "Jump to the side" (name_index: 12)

- **Copies**: 3
- **Value**: 3
- **isAlarm**: true
- **Target Required**: No
- **Effect**: Draw 1 card from the deck. Next player skips their turn entirely (no draw, no play).
- **Implementation Notes**:
  - Draw 1 card: `pickCard("deck", activePlayerId)`
  - Set game state value `skip_next_player` flag
  - In `NextPlayer` state: if flag set, skip to player after next
  - If not interrupted, turn ends automatically (alarm card)

#### 13. "Papageddon" (name_index: 13)

- **Copies**: 3
- **Value**: 3
- **isAlarm**: true
- **Target Required**: No (affects next player)
- **Effect**: Switch game order (reverse turn order for rest of game) and steal a random card from the next player. Player chooses card but only sees card backs (blind selection).
- **Implementation Notes**:
  - Reverse turn order: Use BGA's `createNextPlayerTable()` with reversed order
  - Steal random card from next player using card back selection UI
  - If not interrupted, turn ends automatically (alarm card)
  - Turn order reversal persists for entire game

#### 14. "Spider potato" (name_index: 14)

- **Copies**: 3
- **Value**: 3
- **isAlarm**: false
- **Target Required**: Yes (2 players, can include self)
- **Effect**: Select two players. Those players must exchange their hands. The selected players can include the current player.
- **Implementation Notes**:
  - Requires target selection for 2 players (can select self)
  - Exchange hands: swap all cards between the two players
  - Use `getPlayerHand()` for both players, then swap card locations

## Implementation Summary

### Cards Requiring Target Selection (Single)

- "Get off the pony" (name_index: 3)
- "Lend me a buck" (name_index: 4)
- "Pope Potato" (name_index: 7)
- "Look ahead" (name_index: 8)
- "Potato of destiny" (name_index: 10)
- "Potato Dawan" (name_index: 11)

### Cards Requiring Target Selection (Multiple)

- "Spider potato" (name_index: 14) - 2 players

### Cards Using Card Back Selection UI

- "Lend me a buck" (name_index: 4)
- "Potato Dawan" (name_index: 11)
- "Papageddon" (name_index: 13)

### Alarm Cards (End Turn Automatically)

- "Get off the pony" (name_index: 3)
- "Harry Potato" (name_index: 6)
- "Look ahead" (name_index: 8)
- "Jump to the side" (name_index: 12)
- "Papageddon" (name_index: 13)

### Cards Affecting Multiple Players

- "Runaway potatoes" (name_index: 5) - All other players
- "Spider potato" (name_index: 14) - Two selected players

### Cards Affecting Turn Order

- "Jump to the side" (name_index: 12) - Skip next player
- "Papageddon" (name_index: 13) - Reverse turn order

## Card Flow

1. **Player plays action card** → Check if target required
2. **If target required** → Transition to `TargetSelection` state
3. **Player selects target(s)** → Store in game state
4. **Transition to `ReactionPhase`** → Other players can interrupt
5. **If not interrupted** → Resolve action card effect
6. **If alarm card** → End turn automatically

## Special Cases

- **Card Back Selection**: Cards are shown as backs only, player selects blindly
- **Turn Order Reversal**: "Papageddon" reverses order for entire game
- **Skip Turn**: "Jump to the side" makes next player skip entirely
- **Hand Exchange**: "Spider potato" swaps all cards between two players
- **Deck Reshuffle**: "Runaway potatoes" shuffles deck after moving cards
