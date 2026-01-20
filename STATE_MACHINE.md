# Game State Machine Diagram

```mermaid
stateDiagram-v2
    [*] --> PlayerTurn: Game Start
    
    state PlayerTurn {
        [*] --> CheckHand: Enter State
        CheckHand --> AutoDraw: 0 cards
        CheckHand --> OfferDiscard: 1 card
        CheckHand --> NormalTurn: 2+ cards
        AutoDraw --> [*]
        OfferDiscard --> [*]
        NormalTurn --> [*]
    }
    
    PlayerTurn --> NextPlayer: End Turn (hand ≤7) / Empty Hand / Discard & Draw
    PlayerTurn --> ReactionPhase: Play Card (no target) / Play Threesome
    PlayerTurn --> TargetSelection: Play Action Card (requires target)
    PlayerTurn --> DiscardPhase: End Turn (hand >7 after draw)
    
    state TargetSelection {
        [*] --> SelectTargets
        SelectTargets --> [*]
    }
    
    TargetSelection --> ReactionPhase: Select Targets
    
    state CardSelection {
        [*] --> SelectCard
        SelectCard --> [*]
    }
    
    CardSelection --> ActionResolution: Card Selected
    
    state CardNameSelection {
        [*] --> SelectCardName
        SelectCardName --> [*]
    }
    
    CardNameSelection --> ActionResolution: Card Name Selected
    
    state ReactionPhase {
        [*] --> WaitForReactions
        WaitForReactions --> InterruptPlayed: Player plays interrupt
        WaitForReactions --> NoInterrupt: Timer expires / All skip
        InterruptPlayed --> [*]
        NoInterrupt --> [*]
    }
    
    ReactionPhase --> PlayerTurn: Interrupt Played / Regular Card (no alarm) / Cancelled
    ReactionPhase --> CardSelection: Action Card (no interrupt, needs card selection)
    ReactionPhase --> CardNameSelection: Action Card (no interrupt, needs card name selection)
    ReactionPhase --> ActionResolution: Action Card (no interrupt, no further selection)
    ReactionPhase --> NextPlayer: Alarm Card (no interrupt)
    
    state ActionResolution {
        [*] --> ResolveAction
        ResolveAction --> [*]
    }
    
    ActionResolution --> PlayerTurn: Action Resolved (continue turn)
    ActionResolution --> NextPlayer: Action Resolved (alarm card)
    
    state DiscardPhase {
        [*] --> DiscardCards
        DiscardCards --> CheckHandSize
        CheckHandSize --> DiscardCards: Still >7 cards
        CheckHandSize --> [*]: ≤7 cards
    }
    
    DiscardPhase --> NextPlayer: Hand Size ≤7
    
    state NextPlayer {
        [*] --> CheckSkipDraw
        CheckSkipDraw --> DrawCard: Not skipped
        CheckSkipDraw --> CheckWin: Skipped
        DrawCard --> CheckHandSize
        CheckHandSize --> DiscardPhase: Hand >7
        CheckHandSize --> CheckWin: Hand ≤7
        CheckWin --> EndScore: Win condition met
        CheckWin --> NextTurn: Continue game
        NextTurn --> [*]
    }
    
    NextPlayer --> PlayerTurn: Next Player's Turn
    NextPlayer --> DiscardPhase: Hand Size >7 after draw
    NextPlayer --> EndScore: Win Condition Met
    
    state EndScore {
        [*] --> CalculateScores
        CalculateScores --> [*]
    }
    
    EndScore --> GameEnd: Final Scoring Complete
    
    GameEnd --> [*]
    
    note right of PlayerTurn
        Actions:
        - Play Card
        - Play Threesome (trio)
        - End Turn (draws card, checks hand size)
        - Discard & Draw (if 1 card)
        
        Notes:
        - Potato cards, wildcards, and interrupt cards
          ("No dude", "I told you no dude") cannot be played as single cards.
        - Valid trios are:
          - 3 potato cards with the same name
          - Potato trio with 1-2 wildcards (potato name must match)
          - 3 wildcards (treated as french fries)
          - 3 cards of any type with value==3 each
    end note
    
    note right of ReactionPhase
        All players except card player
        can react with interrupt cards:
        - "No dude"
        - "I told you no dude"
        (Actions are performed by the requesting player;
        no `playerId` parameter is required from the client.)
    end note
    
    note right of ActionResolution
        Resolves various action card effects:
        - Steal cards/golden potatoes
        - Draw cards
        - Reverse turn order
        - Exchange hands
        etc.
    end note
```

## State Descriptions

### PlayerTurn (ID: 2)
- **Type**: ACTIVE_PLAYER
- **Description**: Active player's turn to play cards or take actions
- **Transitions**:
  - → NextPlayer: End turn (hand ≤7 after draw), empty hand auto-draw, discard & draw
  - → ReactionPhase: Play card (including action cards that don't require a target) or play threesome
  - → TargetSelection: Play action card requiring target
  - → DiscardPhase: End turn results in hand >7 after draw

### ReactionPhase (ID: 20)
- **Type**: MULTIPLE_ACTIVE_PLAYER
- **Description**: All players (except card player) can react with interrupt cards
- **Transitions**:
  - → PlayerTurn: Interrupt played, regular card (no alarm), or cancelled
  - → ActionResolution: Action card played (no interrupt), including action cards that required no target selection
  - → NextPlayer: Alarm card played (no interrupt)

### TargetSelection (ID: 25)
- **Type**: ACTIVE_PLAYER
- **Description**: Select target(s) for action card
- **Transitions**:
  - → ReactionPhase: Target(s) selected (interrupt window before any follow-up selection)

### CardSelection (ID: 26)
- **Type**: ACTIVE_PLAYER
- **Description**: Select a card from target's hand (blind selection)
- **Notes**:
  - Selection uses a **0-based position** in the target hand (the server reindexes the hand to avoid gaps/keys).
- **Transitions**:
  - → ActionResolution: Card selected

### CardNameSelection (ID: 28)
- **Type**: ACTIVE_PLAYER
- **Description**: Name a card type (for Pope Potato)
- **Transitions**:
  - → ActionResolution: Card name selected

### ActionResolution (ID: 27)
- **Type**: GAME
- **Description**: Resolve the effect of an action card
- **Transitions**:
  - → PlayerTurn: Action resolved (continue turn)
  - → NextPlayer: Action resolved (alarm card ends turn)

### DiscardPhase (ID: 30)
- **Type**: ACTIVE_PLAYER
- **Description**: Discard cards down to 7 or fewer
- **Transitions**:
  - → NextPlayer: Hand size ≤7

### NextPlayer (ID: 90)
- **Type**: GAME
- **Description**: Transition between turns, handle end-of-turn draw, check win conditions
- **Transitions**:
  - → PlayerTurn: Next player's turn
  - → DiscardPhase: Hand size >7 after draw
  - → EndScore: Win condition met (golden potatoes threshold reached)

### EndScore (ID: 98)
- **Type**: GAME
- **Description**: Final scoring and game end
- **Transitions**:
  - → ST_END_GAME (99): Game ends

## Key Game Flow Paths

1. **Normal Turn Flow**:
   PlayerTurn → (Play Card) → ReactionPhase → (No Interrupt) → PlayerTurn / NextPlayer / ActionResolution

2. **Action Card with Target Flow**:
   PlayerTurn → TargetSelection → (CardSelection/CardNameSelection) → ReactionPhase → ActionResolution → PlayerTurn / NextPlayer

3. **Threesome Flow**:
   PlayerTurn → (Play Threesome) → ReactionPhase → (No Interrupt) → PlayerTurn

4. **Hand Size Management Flow**:
   PlayerTurn → (End Turn) → (Draw Card) → DiscardPhase (if hand >7) → NextPlayer

5. **End Game Flow**:
   NextPlayer → (Win Condition) → EndScore → GameEnd
