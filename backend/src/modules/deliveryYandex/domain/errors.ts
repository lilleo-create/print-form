/**
 * Map Yandex API errors to our domain codes. No magic strings in controllers.
 */

export const NDD_ERROR_CODES = {
  NO_PERMISSIONS: 'NDD_NO_PERMISSIONS',
  UNAUTHORIZED: 'NDD_UNAUTHORIZED',
  PICKUP_POINTS_FAILED: 'NDD_PICKUP_POINTS_FAILED',
  VALIDATION_ERROR: 'NDD_VALIDATION_ERROR',
  UPSTREAM_ERROR: 'NDD_UPSTREAM_ERROR',
  SMARTCAPTCHA_BLOCK: 'NDD_SMARTCAPTCHA_BLOCK',
} as const;

export type NddErrorCode = (typeof NDD_ERROR_CODES)[keyof typeof NDD_ERROR_CODES];

export type MappedNddError = {
  code: NddErrorCode;
  statusCode: number;
  message: string;
  upstreamStatus?: number;
  upstreamData?: unknown;
};

/**
 * Map HTTP status and optional body to our error shape.
 */
export function mapYandexError(
  status: number,
  body?: unknown,
  operation?: string
): MappedNddError {
  const upstreamData = body ?? null;

  if (status === 401) {
    return {
      code: NDD_ERROR_CODES.UNAUTHORIZED,
      statusCode: 401,
      message: 'NDD: неверный или истёкший токен',
      upstreamStatus: status,
      upstreamData,
    };
  }

  if (status === 403) {
    const message =
      typeof body === 'object' && body !== null && 'code' in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).code)
        : 'no_permissions';
    return {
      code: NDD_ERROR_CODES.NO_PERMISSIONS,
      statusCode: 403,
      message: `NDD: нет прав (${message})`,
      upstreamStatus: status,
      upstreamData,
    };
  }

  if (status === 403 && typeof body === 'object' && body !== null) {
    const raw = body as Record<string, unknown>;
    if (raw.uniqueKey || String(raw).includes('captcha')) {
      return {
        code: NDD_ERROR_CODES.SMARTCAPTCHA_BLOCK,
        statusCode: 503,
        message: 'NDD: блокировка по IP (SmartCaptcha)',
        upstreamStatus: status,
        upstreamData,
      };
    }
  }

  if (status >= 400 && status < 500) {
    return {
      code: NDD_ERROR_CODES.VALIDATION_ERROR,
      statusCode: status,
      message: `NDD: ошибка запроса (${operation ?? 'unknown'})`,
      upstreamStatus: status,
      upstreamData,
    };
  }

  return {
    code: NDD_ERROR_CODES.UPSTREAM_ERROR,
    statusCode: status >= 500 ? status : 502,
    message: `NDD: ошибка сервера (${operation ?? 'unknown'})`,
    upstreamStatus: status,
    upstreamData,
  };
}
