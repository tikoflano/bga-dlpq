# DondeLasPapasQueman - Game Rules

This document outlines the core rules of the game for reference and verification purposes.

## Card Structure

### Card Properties

- **type**: The card type (`potato`, `wildcard`, or `action`)
- **name**: The card name (e.g., "papa", "papas duquesas", "papas fritas", "No Poh", "Te Dije Que No Poh", "Wildcard")
- **value**: A numeric value representing the card's power (currently tracked but not actively used in gameplay)
- **isAlarm**: Boolean flag indicating if the card is an alarm card (ends turn automatically when played)

### Card Types

#### Potato Cards

All potato cards have type `potato` but different names:

- **"papa"** (potatoes)
- **"papas duquesas"** (duchesses potatos)
- **"papas fritas"** (fried potatoes)

#### Wildcard Cards

- Type: `wildcard`
- Can substitute for potato cards in type-based threesomes (1-2 wildcards allowed)

#### Action Cards

- Type: `action`
- **"No Poh"**: Interrupt card that can cancel regular cards and other "No Poh" cards. Cannot cancel "Te Dije Que No Poh" or threesomes.
- **"Te Dije Que No Poh"**: More powerful interrupt card that can cancel everything including "No Poh", regular cards, and threesomes.

## Deck Setup

- **Total Cards**: 103 cards
- **Distribution** (example):
  - Potato cards: papa (30), papas duquesas (25), papas fritas (20) = 75 cards
  - Wildcards: 15 cards
  - Action cards: "No Poh" (10), "Te Dije Que No Poh" (3) = 13 cards
  - Total: 103 cards

## Starting Conditions

- Each player starts with **5 cards** in their hand
- Remaining cards form the **common deck**
- All players start with **0 golden potatoes**
- Golden potato pile starts with unlimited cards (tracked but unlimited)

## Turn Structure

### Turn Start Checks

1. **Empty Hand (0 cards)**:

   - Automatically draw 3 cards
   - End turn immediately (skip end-of-turn draw)

2. **Single Card (1 card)**:
   - Player may choose to discard it to draw 3 new cards
   - If chosen, end turn immediately (skip end-of-turn draw)
   - Option is available via "Discard and Draw 3" button

### During Turn

Players can:

- Play **multiple cards** from their hand (one at a time)
- Play **threesomes** (3 cards with same type/name or same value)
- **End turn** explicitly at any time after playing at least one card

### Card Play Sequence

1. Player plays a card or threesome
2. **Reaction Phase** begins (3-second timer)
3. Other players may play interrupt cards ("No Poh" or "Te Dije Que No Poh")
4. If interrupted, the card/threesome is cancelled
5. If not interrupted (or if alarm card), continue or end turn

### Turn End

- After ending turn, player **draws 1 card** from the common deck
- If hand size > 7 after drawing, enter **Discard Phase**
- Player must discard cards until hand size ≤ 7

## Threesome Mechanics

### Type-Based Threesomes

- Play exactly **3 cards** of type `potato` with the **same name**
- Names: "papa", "papas duquesas", or "papas fritas"
- **Wildcards can substitute** for 1-2 cards in a threesome
- Rewards:
  - "papa" threesome = **1 golden potato**
  - "papas duquesas" threesome = **2 golden potatoes**
  - "papas fritas" threesome = **3 golden potatoes**

### Value-Based Threesomes

- Play any **3 cards with the same value**
- **Wildcards cannot be used** in value-based threesomes
- Reward: **1 golden potato**

## Reaction Phase

### Trigger

- Occurs **after any card play** or threesome play
- All players can react simultaneously

### Timer

- **3-second timer** for all players
- Timer **always runs** (even if players don't have interrupt cards) to avoid revealing information

### Interrupt Rules

1. **"No Poh"**:

   - Can cancel regular cards
   - Can cancel other "No Poh" cards (chain reaction)
   - **Cannot cancel** "Te Dije Que No Poh"
   - **Cannot cancel** threesomes

2. **"Te Dije Que No Poh"**:

   - Can cancel everything:
     - Regular cards
     - "No Poh" cards
     - "Te Dije Que No Poh" cards
     - Threesomes

3. **First-Request-Wins**:

   - If multiple players react simultaneously, only the **first request received** is valid
   - Other players' attempts are rejected

4. **Chain Reactions**:
   - Interrupt cards can be reacted to
   - "No Poh" can cancel "No Poh"
   - Chain continues until no more interrupts are played

### Alarm Card Behavior

- If a card with `isAlarm = true` is played:
  - Turn ends automatically **after reaction phase** (if not interrupted)
  - If interrupted, the player's turn **continues** (alarm effect is cancelled)

## Hand Management

### Maximum Hand Size

- **7 cards maximum**
- After drawing at end of turn, if hand > 7, player must discard down to 7

### Discard Phase

- Triggered when hand size > 7 after drawing
- Player selects cards to discard
- Must discard enough to reach 7 or fewer cards
- Discarded cards go to discard pile

## Golden Potatoes

### Collection Methods

1. **Threesome Rewards**:

   - Type-based: 1-3 golden potatoes (based on card name)
   - Value-based: 1 golden potato

2. **Action Cards** (to be implemented):
   - Some cards allow getting golden potatoes from common pile
   - Some cards allow stealing golden potatoes from other players

### Win Conditions

- **2-3 players**: Need **8 golden potatoes** to win
- **4-5 players**: Need **6 golden potatoes** to win
- **6 players**: Need **5 golden potatoes** to win

### Tracking

- Golden potatoes are tracked per player using a PlayerCounter
- Displayed in player scoring area
- Win condition checked after each turn

## Card Locations

- **deck**: Common deck (face-down, shuffled)
- **hand**: Player's hand (private, only visible to that player)
- **discard**: Discard pile (face-up, visible to all)
- **golden_potato_pile**: Common golden potato pile (unlimited, tracked)

## UI Display

### Deck Display

- The deck is displayed as a **red card rectangle** (card back)
- Shows a **counter** displaying the number of remaining cards in the deck
- Positioned in the common game area

### Discard Pile Display

- The discard pile is displayed as a **card rectangle** showing the **latest played card**
- Displays the card's type, name, and value (same format as hand cards)
- When empty, shows a placeholder "Discard Pile" message
- Positioned in the common game area next to the deck

### Player Hand Display

- Cards in the player's hand are displayed as **card rectangles**
- Each card shows:
  - Card type (potato/wildcard/action)
  - Card name (e.g., "papa", "No Poh")
  - Card value
- Cards can be clicked to select/play them
- Selected cards are highlighted with a green border

### Scoring Display

- Golden potatoes are tracked as the **player score**
- Displayed in the BGA player panel (standard score display)
- No separate "Golden Potatoes" counter is shown in the game area

## Deck Exhaustion

- When deck runs out:
  - Shuffle discard pile into deck
  - Continue drawing from reshuffled deck
  - Notify all players of reshuffle

## Special Rules

### Target Selection

- For action cards that target players:
  - Target must be selected **before** reaction phase
  - Reaction phase happens **after** target selection

### Zombie Mode

- Disconnected players:
  - If 0 cards: automatically draw 3 and end turn
  - If 1 card: discard and draw 3
  - Otherwise: play random valid card or end turn

## Game Flow Summary

```
Setup → PlayerTurn → [Check Hand: 0 cards? Draw 3, End]
                  → [Check Hand: 1 card? Option to Discard & Draw 3, End]
                  → [Play Card(s)] → ReactionPhase → [Resolve/Chain]
                  → [Continue/End Turn] → Draw Card → [Hand > 7? DiscardPhase] → NextPlayer → PlayerTurn
                                                                          ↑
                                                                    (or Alarm Card)
```

## Notes for Implementation Verification

- All card plays trigger reaction phase (except when turn is auto-ended)
- Reaction phase timer always runs for 3 seconds
- Hand size checks happen at turn start and after drawing
- Threesome validation: type-based allows wildcards, value-based does not
- Interrupt cancellation rules must be strictly enforced
- First-request-wins for simultaneous interrupts
- Alarm cards end turn only if not interrupted
- Win condition checked after each turn ends
