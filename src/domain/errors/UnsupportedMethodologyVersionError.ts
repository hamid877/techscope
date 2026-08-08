import { SUPPORTED_METHODOLOGY_VERSIONS } from '../constants/methodology.constants';
import { DomainError } from './DomainError';

export class UnsupportedMethodologyVersionError extends DomainError {
  constructor(version: string) {
    super(
      `Methodology version "${version}" is not supported. Supported versions: ${SUPPORTED_METHODOLOGY_VERSIONS.join(', ')}.`,
    );
  }
}
