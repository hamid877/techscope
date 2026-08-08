import { SUPPORTED_METHODOLOGY_VERSIONS } from '../constants/methodology.constants';
import { UnsupportedMethodologyVersionError } from '../errors/UnsupportedMethodologyVersionError';

export class MethodologyVersion {
  readonly #version: string;

  constructor(version: string) {
    if (!(SUPPORTED_METHODOLOGY_VERSIONS as readonly string[]).includes(version)) {
      throw new UnsupportedMethodologyVersionError(version);
    }

    this.#version = version;
  }

  get value(): string {
    return this.#version;
  }
}
