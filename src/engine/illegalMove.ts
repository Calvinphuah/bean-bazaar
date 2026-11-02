// Raised when a player tries a move the rules don't allow.
export class IllegalMove extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IllegalMove"
  }
}
