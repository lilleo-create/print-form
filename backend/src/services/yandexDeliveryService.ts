import axios, { AxiosError, type AxiosInstance } from "axios";
import { getOperatorStationId, normalizeStationId } from "./yandexNdd/getOperatorStationId";
import { getYandexNddConfig, isYandexNddTestEnvironment } from "../config/yandexNdd";

class YandexDeliveryService {
  private readonly client: AxiosInstance;

  constructor() {
    const config = getYandexNddConfig();
    const tokenRaw = (config.token ?? '').trim().replace(/^Bearer\s+/i, '');

    if (!tokenRaw) {
      throw new Error("YD_TOKEN_MISSING");
    }

    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Bearer ${tokenRaw}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    this.client.interceptors.request.use((request) => {
      const auth = String(request.headers?.Authorization ?? request.headers?.authorization ?? '');
      const tokenPrefix = auth.replace(/^Bearer\s+/i, '').slice(0, 10);
      console.info('[YANDEX_NDD][request]', {
        method: String(request.method ?? 'get').toUpperCase(),
        url: `${request.baseURL ?? ''}${request.url ?? ''}`,
        hasAuthorization: Boolean(auth),
        authorizationTokenPrefix: tokenPrefix ? `${tokenPrefix}...` : null
      });
      return request;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('[YANDEX_NDD] axios error', {
          method: String(error.config?.method ?? 'get').toUpperCase(),
          url: `${error.config?.baseURL ?? ''}${error.config?.url ?? ''}`,
          status: error.response?.status ?? null,
          data: error.response?.data ?? null
        });
        return Promise.reject(error);
      }
    );
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === retries) throw error;
      }
    }
    throw lastError;
  }

  async listPickupPoints(payload: Record<string, unknown>) {
    const { data } = await this.withRetry(() =>
      this.client.post("/api/b2b/platform/pickup-points/list", payload),
    );
    return data;
  }

  private extractPoints(payload: unknown): Record<string, unknown>[] {
    const asRecord = (value: unknown): Record<string, unknown> | null =>
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;

    if (Array.isArray(payload)) {
      return payload.filter((item) => asRecord(item)) as Record<string, unknown>[];
    }

    const root = asRecord(payload);
    if (!root) {
      return [];
    }

    const directCandidates = [root.points, root.pickup_points, root.items];
    for (const candidate of directCandidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter((item) => asRecord(item)) as Record<string, unknown>[];
      }
    }

    const nested = asRecord(root.result) ?? asRecord(root.data) ?? asRecord(root.payload);
    if (!nested) {
      return [];
    }

    const nestedCandidates = [nested.points, nested.pickup_points, nested.items];
    for (const candidate of nestedCandidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter((item) => asRecord(item)) as Record<string, unknown>[];
      }
    }

    return [];
  }

  async getPickupPointDetails(pvzId: string) {
    const normalizedPvzId = String(pvzId ?? "").trim();
    if (!normalizedPvzId) {
      return null;
    }

    const responses = await Promise.allSettled([
      this.listPickupPoints({ ids: [normalizedPvzId] }),
      this.listPickupPoints({ pickup_point_ids: [normalizedPvzId] }),
      this.listPickupPoints({ point_ids: [normalizedPvzId] }),
    ]);

    const allPoints = responses
      .filter((response): response is PromiseFulfilledResult<unknown> => response.status === "fulfilled")
      .flatMap((response) => this.extractPoints(response.value));

    const matchedPoint = allPoints.find((point) => {
      const candidates = [point.id, point.point_id, point.pickup_point_id, point.external_id]
        .map((candidate) => String(candidate ?? "").trim())
        .filter(Boolean);
      return candidates.includes(normalizedPvzId);
    });

    if (!matchedPoint) {
      return null;
    }

    const { baseUrl } = getYandexNddConfig();
    const stationIdPolicy = { allowUuid: isYandexNddTestEnvironment(baseUrl) };
    const stationRecord =
      matchedPoint.station && typeof matchedPoint.station === 'object' && !Array.isArray(matchedPoint.station)
        ? (matchedPoint.station as Record<string, unknown>)
        : null;
    const stationId =
      getOperatorStationId(matchedPoint, stationIdPolicy) ??
      normalizeStationId(stationRecord?.id, stationIdPolicy) ??
      normalizeStationId(stationRecord?.station_id, stationIdPolicy);

    return {
      point: matchedPoint,
      stationId,
    };
  }

  async createOffers(payload: Record<string, unknown>) {
    try {
      const { data } = await this.withRetry(() =>
        this.client.post(
          "/api/b2b/platform/offers/create?send_unix=true",
          payload,
        ),
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError<{ code?: string }>;
      if (
        axiosError.response?.status === 400 &&
        axiosError.response.data?.code === "no_delivery_options"
      ) {
        throw new Error("NO_DELIVERY_OPTIONS");
      }
      throw error;
    }
  }

  async confirmOffer(offerId: string) {
    const { data } = await this.withRetry(() =>
      this.client.post("/api/b2b/platform/offers/confirm", {
        offer_id: offerId,
      }),
    );
    return data;
  }

  async createRequest(payload: Record<string, unknown>) {
    const { data } = await this.withRetry(() =>
      this.client.post(
        "/api/b2b/platform/request/create?send_unix=true",
        payload,
      ),
    );
    return data;
  }

  async getRequestInfo(requestId: string) {
    try {
      const { data } = await this.withRetry(() =>
        this.client.get("/api/b2b/platform/request/info", {
          params: { request_id: requestId },
        }),
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) return null;
      throw error;
    }
  }

  async getRequestHistory(requestId: string) {
    try {
      const { data } = await this.withRetry(() =>
        this.client.get("/api/b2b/platform/request/history", {
          params: { request_id: requestId },
        }),
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) return null;
      throw error;
    }
  }

  async getActualInfo(requestId: string) {
    try {
      const { data } = await this.withRetry(() =>
        this.client.get("/api/b2b/platform/request/actual_info", {
          params: { request_id: requestId },
        }),
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) return null;
      throw error;
    }
  }

  async cancelRequest(requestId: string) {
    const { data } = await this.withRetry(() =>
      this.client.post("/api/b2b/platform/request/cancel", {
        request_id: requestId,
      }),
    );
    return data;
  }

  async generateLabels(
    requestIds: string[],
    generateType: "one" | "many" = "one",
    language = "ru",
  ) {
    const response = await this.withRetry(() =>
      this.client.post(
        "/api/b2b/platform/request/generate-labels",
        { request_ids: requestIds, generate_type: generateType, language },
        { responseType: "arraybuffer" },
      ),
    );

    return {
      buffer: Buffer.from(response.data),
      contentType: String(
        response.headers["content-type"] ?? "application/pdf",
      ),
    };
  }

  async getHandoverAct(
    params: Record<string, unknown>,
    body?: Record<string, unknown>,
  ) {
    const response = await this.withRetry(() =>
      this.client.post(
        "/api/b2b/platform/request/get-handover-act",
        body ?? {},
        {
          params,
          responseType: "arraybuffer",
        },
      ),
    );

    return {
      buffer: Buffer.from(response.data),
      contentType: String(
        response.headers["content-type"] ?? "application/pdf",
      ),
    };
  }
}

export const yandexDeliveryService = new YandexDeliveryService();
