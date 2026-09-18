export type AdapterErrorCode =
  | 'AUTHENTICATION_FAILURE'
  | 'RATE_LIMITING'
  | 'NETWORK_FAILURE'
  | 'MALFORMED_RESPONSE'
  | 'SOURCE_UNAVAILABLE'
  | 'PARSING_FAILURE'
  | 'UNSUPPORTED_SOURCE'
  | 'VALIDATION_FAILURE';

export class AdapterError extends Error {
  public readonly code: AdapterErrorCode;
  public readonly sourceId?: string;
  public readonly retryable: boolean;
  public readonly cause?: unknown;

  constructor(params: {
    code: AdapterErrorCode;
    message: string;
    sourceId?: string;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'AdapterError';
    this.code = params.code;
    this.sourceId = params.sourceId;
    this.retryable = params.retryable ?? false;
    this.cause = params.cause;
    Object.setPrototypeOf(this, AdapterError.prototype);
  }
}

export class AuthenticationFailureError extends AdapterError {
  constructor(message: string, sourceId?: string, cause?: unknown) {
    super({ code: 'AUTHENTICATION_FAILURE', message, sourceId, retryable: false, cause });
    this.name = 'AuthenticationFailureError';
  }
}

export class RateLimitingError extends AdapterError {
  public readonly retryAfterMs?: number;
  constructor(message: string, sourceId?: string, retryAfterMs?: number, cause?: unknown) {
    super({ code: 'RATE_LIMITING', message, sourceId, retryable: true, cause });
    this.name = 'RateLimitingError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class NetworkFailureError extends AdapterError {
  constructor(message: string, sourceId?: string, cause?: unknown) {
    super({ code: 'NETWORK_FAILURE', message, sourceId, retryable: true, cause });
    this.name = 'NetworkFailureError';
  }
}

export class MalformedResponseError extends AdapterError {
  constructor(message: string, sourceId?: string, cause?: unknown) {
    super({ code: 'MALFORMED_RESPONSE', message, sourceId, retryable: false, cause });
    this.name = 'MalformedResponseError';
  }
}

export class SourceUnavailableError extends AdapterError {
  constructor(message: string, sourceId?: string, cause?: unknown) {
    super({ code: 'SOURCE_UNAVAILABLE', message, sourceId, retryable: true, cause });
    this.name = 'SourceUnavailableError';
  }
}

export class ParsingFailureError extends AdapterError {
  constructor(message: string, sourceId?: string, cause?: unknown) {
    super({ code: 'PARSING_FAILURE', message, sourceId, retryable: false, cause });
    this.name = 'ParsingFailureError';
  }
}

export class UnsupportedSourceError extends AdapterError {
  constructor(message: string, sourceId?: string) {
    super({ code: 'UNSUPPORTED_SOURCE', message, sourceId, retryable: false });
    this.name = 'UnsupportedSourceError';
  }
}

export class ValidationFailureError extends AdapterError {
  public readonly validationErrors: string[];
  constructor(message: string, sourceId?: string, validationErrors: string[] = []) {
    super({ code: 'VALIDATION_FAILURE', message, sourceId, retryable: false });
    this.name = 'ValidationFailureError';
    this.validationErrors = validationErrors;
  }
}
