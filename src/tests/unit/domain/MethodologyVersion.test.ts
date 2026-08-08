import { describe, expect, it } from 'vitest';
import { CURRENT_METHODOLOGY_VERSION, SUPPORTED_METHODOLOGY_VERSIONS } from '@/domain/constants/methodology.constants';
import { UnsupportedMethodologyVersionError } from '@/domain/errors/UnsupportedMethodologyVersionError';
import { MethodologyVersion } from '@/domain/value-objects/MethodologyVersion';

describe('MethodologyVersion', () => {
  it('accepts the supported V1 version', () => {
    const version = CURRENT_METHODOLOGY_VERSION;
    const mv = new MethodologyVersion(version);
    expect(mv.value).toBe(version);
  });

  it('rejects an unsupported version string', () => {
    expect(() => new MethodologyVersion('2.0.0')).toThrow(
      UnsupportedMethodologyVersionError,
    );
  });

  it('rejects an empty string as unsupported', () => {
    expect(() => new MethodologyVersion('')).toThrow(
      UnsupportedMethodologyVersionError,
    );
  });

  it('exposes the accepted version through the value getter', () => {
    const version = SUPPORTED_METHODOLOGY_VERSIONS[0];
    const mv = new MethodologyVersion(version);
    expect(mv.value).toBe(version);
  });

  it('throws UnsupportedMethodologyVersionError for an arbitrary unknown string', () => {
    expect(() => new MethodologyVersion('not-a-version')).toThrow(
      UnsupportedMethodologyVersionError,
    );
  });
});
