export abstract class DomainError extends Error {
  protected constructor(message: string) {
    super(message);

    // Automatically assign this.name using the subclass name
    this.name = this.constructor.name;

    // Correctly restore the prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack traces when supported by the runtime
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
