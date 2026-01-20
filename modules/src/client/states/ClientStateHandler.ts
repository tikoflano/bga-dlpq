export interface ClientStateHandler {
  onEnter?(args: any): void;
  onLeave?(): void;
  onUpdateActionButtons?(args: any): void;
}

