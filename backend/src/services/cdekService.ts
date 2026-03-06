import axios, { type AxiosRequestConfig } from "axios";
import { getCdekConfig } from "../config/cdek";

type CdekTokenResponse = {
  access_token: string;
  expires_in: number;
};

type CdekPickupPoint = {
  code: string;
  name: string;
  location?: {
    city_code?: number;
    city?: string;
    latitude?: number;
    longitude?: number;
    address_full?: string;
  };
  work_time?: string;
  type?: string;
};

type CalculateDeliveryParams = {
  fromCityCode: number;
  toCityCode: number;
  weightGrams: number;
  tariffCode?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
};

type CreateOrderItem = {
  id: string;
  name: string;
  article?: string;
  price: number;
  quantity: number;
};

type CreateOrderParams = {
  orderId: string;
  fromPvzCode: string;
  toPvzCode: string;
  comment?: string;
  recipientName: string;
  recipientPhone: string;
  senderName?: string;
  senderPhone?: string;
  weightGrams?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  items: CreateOrderItem[];
};

type CdekApiError = {
  code?: string;
  additional_code?: string;
  message?: string;
};

type CdekApiRequestInfo = {
  type?: string;
  date_time?: string;
  state?: string; // OK / INVALID / etc
  request_uuid?: string;
  errors?: CdekApiError[];
};

type CdekOrderEntity = {
  uuid?: string;
  uuids?: string[]; // ✅ важное поле: после POST /v2/orders часто приходит именно массив uuids
  order_uuid?: string;
  cdek_number?: string;
  statuses?: Array<{ code?: string }>;
};

type CdekOrderResponse = {
  entity?: CdekOrderEntity;
  requests?: CdekApiRequestInfo[];
  related_entities?: Array<{ type?: string; url?: string }>;
  cdek_number?: string;
  statuses?: Array<{ code?: string }>;
};

type CdekOrdersListResponse = {
  entity?: Array<CdekOrderEntity & { statuses?: Array<{ code?: string }> }>;
  requests?: CdekApiRequestInfo[];
};

export type CdekOrderSnapshot = {
  cdekOrderId: string;
  status: string;
  trackingNumber: string;
  requestUuid: string;
  requestState: string;
  requestErrors: CdekApiError[];
  isRequestInvalid: boolean;
  relatedEntities: {
    waybillUrl: string | null;
    barcodeUrls: string[];
  };
  raw: CdekOrderResponse;
};

type CdekPrintTaskResponse = {
  entity?: { uuid?: string; statuses?: Array<{ code?: string; date_time?: string; city?: string }> };
  requests?: CdekApiRequestInfo[];
};

export type CdekPrintTaskStatusCode = 'ACCEPTED' | 'INVALID' | 'PROCESSING' | 'READY' | 'REMOVED';

export type CdekPrintTaskSnapshot = {
  uuid: string;
  status: CdekPrintTaskStatusCode | 'UNKNOWN';
  statuses: Array<{ code: string; dateTime?: string; city?: string }>;
};

type CdekBarcodePrintFormat = 'A4' | 'A5' | 'A6' | 'A7';
type CdekPrintLang = 'RUS' | 'ENG';

class CdekService {
  private readonly pickupPointTariffCandidates = [136, 138, 234];
  private tokenCache: { token: string; expiresAtMs: number } | null = null;

  private async request<T>(
    methodName: string,
    config: AxiosRequestConfig,
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const response = await axios.request<T>(config);
      console.info(`[CDEK][${methodName}]`, {
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response.data;
    } catch (error: any) {
      console.info(`[CDEK][${methodName}]`, {
        status: Number(error?.response?.status ?? 0),
        durationMs: Date.now() - startedAt,
        data: error?.response?.data,
      });
      throw error;
    }
  }

  private looksLikeCdekPvz(code?: string) {
    return typeof code === "string" && /^[A-Z]{3}\d{2,6}$/.test(code.trim());
  }

  private extractOrderUuid(resp: CdekOrderResponse): string {
    const e = resp?.entity ?? {};
    const uuid =
      e.uuid ??
      e.order_uuid ??
      (Array.isArray(e.uuids) ? e.uuids[0] : undefined);

    return String(uuid ?? "").trim();
  }

  private extractCdekNumber(resp: CdekOrderResponse): string {
    const e = resp?.entity ?? {};
    return String(e.cdek_number ?? resp?.cdek_number ?? "").trim();
  }

  private extractLastStatusCode(resp: CdekOrderResponse): string {
    const statuses = (resp?.entity?.statuses ?? resp?.statuses ?? []) as Array<{
      code?: string;
    }>;
    const last =
      statuses.length > 0 ? (statuses[statuses.length - 1]?.code ?? "") : "";
    return String(last ?? "").trim();
  }

  private extractErrors(resp: { requests?: CdekApiRequestInfo[] } | undefined) {
    const requests = resp?.requests ?? [];
    const state = String(requests?.[0]?.state ?? "");
    const errors = requests.flatMap((r) => r?.errors ?? []);
    return { state, errors };
  }

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && now < this.tokenCache.expiresAtMs - 60_000) {
      return this.tokenCache.token;
    }

    const { baseUrl, clientId, clientSecret } = getCdekConfig();

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await this.request<CdekTokenResponse>("getToken", {
      method: "POST",
      url: `${baseUrl}/v2/oauth/token`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: body.toString(),
    });

    this.tokenCache = {
      token: response.access_token,
      expiresAtMs: now + response.expires_in * 1000,
    };

    return response.access_token;
  }

  async getPickupPoints(cityCode?: number, city?: string) {
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const response = await this.request<CdekPickupPoint[]>("getPickupPoints", {
      method: "GET",
      url: `${baseUrl}/v2/deliverypoints`,
      params: {
        city_code: cityCode,
        type: "PVZ",
        is_handout: true,
        is_reception: true,
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    return response
      .map((point) => {
        const lat = Number(point.location?.latitude ?? 0);
        const lon = Number(point.location?.longitude ?? 0);

        return {
          code: String(point.code ?? "").trim(),
          name: String(point.name ?? "").trim(),
          address: String(point.location?.address_full ?? "").trim(),
          cityCode: Number(point.location?.city_code ?? 0),
          cityName: String(point.location?.city ?? "").trim(),
          latitude: Number.isFinite(lat) ? lat : 0,
          longitude: Number.isFinite(lon) ? lon : 0,
          workTime: String(point.work_time ?? "").trim(),
          type: String(point.type ?? "PVZ").trim(),
        };
      })
      .filter((point) => {
        if (!point.code) return false;
        if (!city) return true;
        return point.cityName.toLowerCase().includes(city.toLowerCase());
      });
  }

  /**
   * ⚠️ Не идеально: без cityCode это может быть очень много точек.
   * Но оставляю как было, чтобы не ломать проект.
   */
  async getPickupPointByCode(pvzCode: string) {
    const code = String(pvzCode ?? "").trim();
    if (!code) throw new Error("CDEK_PVZ_CODE_REQUIRED");

    const points = await this.getPickupPoints(); // может быть тяжело
    const found = points.find(
      (p) => String(p.code).toUpperCase() === code.toUpperCase(),
    );

    if (!found) {
      const err: any = new Error(`CDEK_PVZ_NOT_FOUND: ${code}`);
      err.code = "CDEK_PVZ_NOT_FOUND";
      throw err;
    }

    return {
      code: found.code,
      name: found.name,
      type: found.type ?? "PVZ",
      location: {
        city_code: found.cityCode,
        city: found.cityName,
        latitude: found.latitude,
        longitude: found.longitude,
        address_full: found.address,
      },
      work_time: found.workTime,
    };
  }

  async calculateDelivery(params: CalculateDeliveryParams) {
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const response = await this.request<{
      total_sum: number;
      period_min: number;
      period_max: number;
    }>("calculateDelivery", {
      method: "POST",
      url: `${baseUrl}/v2/calculator/tariff`,
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tariff_code: params.tariffCode ?? 136,
        from_location: { code: params.fromCityCode },
        to_location: { code: params.toCityCode },
        packages: [
          {
            weight: params.weightGrams,
            length: params.lengthCm ?? 10,
            width: params.widthCm ?? 10,
            height: params.heightCm ?? 10,
          },
        ],
      },
    });

    return {
      totalSum: Number(response.total_sum ?? 0),
      deliveryDaysMin: Number(response.period_min ?? 0),
      deliveryDaysMax: Number(response.period_max ?? 0),
      tariffCode: params.tariffCode ?? 136,
    };
  }

  private hasRequestErrors(resp: CdekOrderResponse): boolean {
    const requests = Array.isArray(resp?.requests) ? resp.requests : [];
    return requests.some((request) => Array.isArray(request?.errors) && request.errors.length > 0);
  }

  private isInvalidRequestState(state?: string | null): boolean {
    return String(state ?? '').trim().toUpperCase() === 'INVALID';
  }

  private isCreateRequestInvalid(resp: CdekOrderResponse) {
    const requests = Array.isArray(resp?.requests) ? resp.requests : [];
    const createRequest = requests.find((request) => String(request?.type ?? '').toUpperCase() === 'CREATE') ?? requests[0];
    const requestState = String(createRequest?.state ?? '').trim().toUpperCase();
    const requestErrors = requests.flatMap((request) => request?.errors ?? []);
    const hasErrors = requestErrors.length > 0;
    const isInvalid = this.isInvalidRequestState(requestState) || hasErrors;

    return { isInvalid, requestState, requestErrors };
  }

  private async createOrderWithTariff(params: CreateOrderParams, tariffCode: number): Promise<CdekOrderResponse> {
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    return this.request<CdekOrderResponse>('createOrder', {
      method: 'POST',
      url: `${baseUrl}/v2/orders`,
      headers: { Authorization: `Bearer ${token}` },
      data: {
        number: params.orderId,
        tariff_code: tariffCode,
        shipment_point: params.fromPvzCode,
        delivery_point: params.toPvzCode,
        comment: params.comment ?? '',

        recipient: {
          name: params.recipientName,
          phones: [{ number: params.recipientPhone }],
        },

        sender: {
          name: params.senderName ?? 'Маркетплейс PrintForm',
          phones: [{ number: params.senderPhone ?? '+70000000000' }],
        },

        services: [],

        packages: [
          {
            number: params.orderId,
            weight: params.weightGrams ?? 500,
            length: params.lengthCm ?? 10,
            width: params.widthCm ?? 10,
            height: params.heightCm ?? 10,
            comment: params.comment ?? '',
            items: params.items.map((item) => ({
              name: item.name,
              ware_key: item.article ?? item.id,
              payment: { value: 0 },
              cost: item.price,
              weight: 50,
              amount: item.quantity,
            })),
          },
        ],
      },
    });
  }

  async createOrder(params: CreateOrderParams) {
    // ✅ валидации ДО запроса
    if (!params.fromPvzCode) throw new Error("CDEK_FROM_PVZ_MISSING");
    if (!params.toPvzCode) throw new Error("CDEK_DESTINATION_PVZ_MISSING");

    if (!this.looksLikeCdekPvz(params.fromPvzCode)) {
      throw new Error(`CDEK_FROM_PVZ_INVALID_CODE: ${params.fromPvzCode}`);
    }
    if (!this.looksLikeCdekPvz(params.toPvzCode)) {
      throw new Error(`CDEK_DESTINATION_PVZ_INVALID_CODE: ${params.toPvzCode}`);
    }
    if (!params.recipientName) throw new Error("CDEK_RECIPIENT_NAME_MISSING");
    if (!params.recipientPhone) throw new Error("CDEK_RECIPIENT_PHONE_MISSING");
    if (!params.orderId) throw new Error("CDEK_ORDER_ID_MISSING");
    if (!Array.isArray(params.items) || params.items.length === 0)
      throw new Error("CDEK_ITEMS_MISSING");

    console.info("[CDEK][createOrder] pvz", {
      from: params.fromPvzCode,
      to: params.toPvzCode,
      orderId: params.orderId,
    });

    let response: CdekOrderResponse | null = null;
    let selectedTariffCode: number | null = null;
    for (const tariffCode of this.pickupPointTariffCandidates) {
      const candidateResponse = await this.createOrderWithTariff(params, tariffCode);
      const candidateValidation = this.isCreateRequestInvalid(candidateResponse);
      response = candidateResponse;
      selectedTariffCode = tariffCode;
      if (!candidateValidation.isInvalid) break;
    }

    if (!response || !selectedTariffCode) {
      throw new Error('CDEK_CREATE_ORDER_EMPTY_RESPONSE');
    }

    console.info("[CDEK][createOrder][raw]", JSON.stringify(response, null, 2));

    const cdekOrderUuid = this.extractOrderUuid(response);
    const cdekRequestUuid = String(response?.requests?.[0]?.request_uuid ?? '').trim();
    const state = String(response?.requests?.[0]?.state ?? '').trim().toUpperCase();
    const trackingNumber = this.extractCdekNumber(response);
    const validation = this.isCreateRequestInvalid(response);

    // лог на один раз (потом уберешь)
    console.info("[CDEK][createOrder][parsed]", {
      cdekOrderId: cdekOrderUuid,
      cdekRequestUuid,
      trackingNumber,
      state,
      errors: validation.requestErrors,
      selectedTariffCode,
    });

    return {
      cdekOrderId: cdekOrderUuid,
      trackingNumber,
      cdekRequestUuid,
      state,
      requestState: validation.requestState,
      requestErrors: validation.requestErrors,
      isRequestInvalid: validation.isInvalid,
      tariffCode: selectedTariffCode,
      raw: response,
    };
  }

  async getOrderInfo(cdekOrderId: string) {
    return this.getOrderByUuid(cdekOrderId);
  }

  async getOrderByTracking(trackingNumber: string): Promise<CdekOrderSnapshot> {
    const number = String(trackingNumber ?? '').trim();
    if (!number) throw new Error('CDEK_TRACKING_NUMBER_REQUIRED');

    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const response = await this.request<CdekOrdersListResponse>('getOrderByTracking', {
      method: 'GET',
      url: `${baseUrl}/v2/orders`,
      headers: { Authorization: `Bearer ${token}` },
      params: { cdek_number: number }
    });

    const first = Array.isArray(response.entity) ? response.entity[0] : null;
    if (!first) throw new Error('CDEK_ORDER_NOT_FOUND_BY_TRACKING');

    const cdekOrderId = String(first.uuid ?? first.order_uuid ?? '').trim();
    if (!cdekOrderId) throw new Error('CDEK_ORDER_UUID_MISSING_BY_TRACKING');

    return this.getOrderByUuid(cdekOrderId);
  }

  async getOrderByUuid(cdekOrderId: string): Promise<CdekOrderSnapshot> {
    const id = String(cdekOrderId ?? '').trim();
    if (!id) throw new Error('CDEK_ORDER_ID_REQUIRED');

    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const response = await this.request<CdekOrderResponse>('getOrderInfo', {
      method: 'GET',
      url: `${baseUrl}/v2/orders/${id}`,
      headers: { Authorization: `Bearer ${token}` }
    });

    const requestUuid = String(response?.requests?.[0]?.request_uuid ?? '').trim();
    const relatedEntities = this.extractPrintForms(response);
    const requestState = String(response?.requests?.[0]?.state ?? '').trim().toUpperCase();
    const requestErrors = (response?.requests ?? []).flatMap((request) => request?.errors ?? []);
    const isRequestInvalid = this.isInvalidRequestState(requestState) || this.hasRequestErrors(response);

    return {
      cdekOrderId: this.extractOrderUuid(response),
      status: this.extractLastStatusCode(response),
      trackingNumber: this.extractCdekNumber(response),
      requestUuid,
      requestState,
      requestErrors,
      isRequestInvalid,
      relatedEntities,
      raw: response
    };
  }

  getPrintForms(snapshot: CdekOrderSnapshot) {
    return snapshot.relatedEntities;
  }

  private extractPrintForms(resp: CdekOrderResponse) {
    const entities = Array.isArray(resp.related_entities) ? resp.related_entities : [];
    const waybillEntity = entities.find((entry) => String(entry?.type ?? '').toLowerCase() === 'waybill');
    const barcodeUrls = entities
      .filter((entry) => String(entry?.type ?? '').toLowerCase() === 'barcode')
      .map((entry) => String(entry?.url ?? '').trim())
      .filter(Boolean);

    return {
      waybillUrl: String(waybillEntity?.url ?? '').trim() || null,
      barcodeUrls
    };
  }

  /**
   * ✅ Обертка под “старый” вызов из проекта:
   * cdekService.createOrderFromMarketplaceOrder(...)
   */
  async createOrderFromMarketplaceOrder(payload: {
    orderId: string;
    fromPvzCode: string;
    toPvzCode: string;
    recipientName: string;
    recipientPhone: string;
    items: CreateOrderItem[];
    comment?: string;
    senderName?: string;
    senderPhone?: string;
    weightGrams?: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  }) {
    return this.createOrder({
      orderId: payload.orderId,
      fromPvzCode: payload.fromPvzCode,
      toPvzCode: payload.toPvzCode,
      recipientName: payload.recipientName,
      recipientPhone: payload.recipientPhone,
      items: payload.items,
      comment: payload.comment,
      senderName: payload.senderName,
      senderPhone: payload.senderPhone,
      weightGrams: payload.weightGrams,
      lengthCm: payload.lengthCm,
      widthCm: payload.widthCm,
      heightCm: payload.heightCm,
    });
  }

  async createWaybillPrintTask(orderUuid: string) {
    const uuid = String(orderUuid ?? "").trim();
    if (!uuid) throw new Error("CDEK_ORDER_UUID_REQUIRED");

    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const resp = await this.request<CdekPrintTaskResponse>(
      "createWaybillPrintTask",
      {
        method: "POST",
        url: `${baseUrl}/v2/print/orders`,
        headers: { Authorization: `Bearer ${token}` },
        data: {
          orders: [{ order_uuid: uuid }],
          copy_count: 1,
        },
      },
    );

    const printUuid = String(resp.entity?.uuid ?? "").trim();
    if (!printUuid) {
      const { state, errors } = this.extractErrors(resp);
      throw new Error(
        `CDEK_PRINT_TASK_UUID_MISSING: ${JSON.stringify({ state, errors }, null, 2)}`,
      );
    }

    return printUuid;
  }

  async createReceiptPrintTask(params: {
    orderUuid: string;
    copyCount?: number;
    type?: string;
  }) {
    const orderUuid = String(params.orderUuid ?? '').trim();
    if (!orderUuid) throw new Error('CDEK_ORDER_UUID_REQUIRED');

    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();
    const response = await this.request<CdekPrintTaskResponse>('createReceiptPrintTask', {
      method: 'POST',
      url: `${baseUrl}/v2/print/orders`,
      headers: { Authorization: `Bearer ${token}` },
      data: {
        orders: [{ order_uuid: orderUuid }],
        copy_count: params.copyCount ?? 2,
        type: String(params.type ?? 'tpl_russia')
      }
    });

    const printUuid = String(response.entity?.uuid ?? '').trim();
    if (!printUuid) {
      const { state, errors } = this.extractErrors(response);
      throw new Error(`CDEK_RECEIPT_PRINT_TASK_UUID_MISSING: ${JSON.stringify({ state, errors }, null, 2)}`);
    }

    return printUuid;
  }

  async createBarcodePrintTask(params: {
    orderUuid: string;
    copyCount?: number;
    format?: CdekBarcodePrintFormat;
    lang?: CdekPrintLang;
  }) {
    const orderUuid = String(params.orderUuid ?? '').trim();
    if (!orderUuid) throw new Error('CDEK_ORDER_UUID_REQUIRED');

    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();
    const response = await this.request<CdekPrintTaskResponse>('createBarcodePrintTask', {
      method: 'POST',
      url: `${baseUrl}/v2/print/barcodes`,
      headers: { Authorization: `Bearer ${token}` },
      data: {
        orders: [{ order_uuid: orderUuid }],
        copy_count: params.copyCount ?? 1,
        format: params.format ?? 'A4',
        lang: params.lang ?? 'RUS'
      }
    });

    const printUuid = String(response.entity?.uuid ?? '').trim();
    if (!printUuid) {
      const { state, errors } = this.extractErrors(response);
      throw new Error(`CDEK_BARCODE_PRINT_TASK_UUID_MISSING: ${JSON.stringify({ state, errors }, null, 2)}`);
    }

    return printUuid;
  }

  private normalizePrintTaskStatus(response: CdekPrintTaskResponse): CdekPrintTaskSnapshot {
    const uuid = String(response.entity?.uuid ?? '').trim();
    const statuses = Array.isArray(response.entity?.statuses) ? response.entity!.statuses! : [];
    const normalizedStatuses = statuses.map((entry) => ({
      code: String(entry?.code ?? '').trim().toUpperCase(),
      dateTime: entry?.date_time,
      city: entry?.city
    })).filter((entry) => Boolean(entry.code));
    const status = (normalizedStatuses[normalizedStatuses.length - 1]?.code ?? 'UNKNOWN') as CdekPrintTaskSnapshot['status'];
    return { uuid, status, statuses: normalizedStatuses };
  }

  async getReceiptPrintTask(printTaskUuid: string): Promise<CdekPrintTaskSnapshot> {
    const uuid = String(printTaskUuid ?? '').trim();
    if (!uuid) throw new Error('CDEK_PRINT_TASK_UUID_REQUIRED');
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();
    const response = await this.request<CdekPrintTaskResponse>('getReceiptPrintTask', {
      method: 'GET',
      url: `${baseUrl}/v2/print/orders/${uuid}`,
      headers: { Authorization: `Bearer ${token}` }
    });
    return this.normalizePrintTaskStatus(response);
  }

  async getBarcodePrintTask(printTaskUuid: string): Promise<CdekPrintTaskSnapshot> {
    const uuid = String(printTaskUuid ?? '').trim();
    if (!uuid) throw new Error('CDEK_PRINT_TASK_UUID_REQUIRED');
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();
    const response = await this.request<CdekPrintTaskResponse>('getBarcodePrintTask', {
      method: 'GET',
      url: `${baseUrl}/v2/print/barcodes/${uuid}`,
      headers: { Authorization: `Bearer ${token}` }
    });
    return this.normalizePrintTaskStatus(response);
  }

  async getWaybillPdfByPrintTaskUuid(printTaskUuid: string): Promise<Buffer> {
    const uuid = String(printTaskUuid ?? "").trim();
    if (!uuid) throw new Error("CDEK_PRINT_TASK_UUID_REQUIRED");

    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const arrayBuffer = await this.request<ArrayBuffer>(
      "getWaybillPdfByPrintTaskUuid",
      {
        method: "GET",
        url: `${baseUrl}/v2/print/orders/${uuid}.pdf`,
        headers: { Authorization: `Bearer ${token}` },
        responseType: "arraybuffer",
      },
    );

    return Buffer.from(arrayBuffer);
  }

  async getReceiptPdfByPrintTaskUuid(printTaskUuid: string): Promise<Buffer> {
    const uuid = String(printTaskUuid ?? '').trim();
    if (!uuid) throw new Error('CDEK_PRINT_TASK_UUID_REQUIRED');

    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();
    const arrayBuffer = await this.request<ArrayBuffer>('getReceiptPdfByPrintTaskUuid', {
      method: 'GET',
      url: `${baseUrl}/v2/print/orders/${uuid}.pdf`,
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });

    return Buffer.from(arrayBuffer);
  }

  async getBarcodePdfByPrintTaskUuid(printTaskUuid: string): Promise<Buffer> {
    const uuid = String(printTaskUuid ?? '').trim();
    if (!uuid) throw new Error('CDEK_PRINT_TASK_UUID_REQUIRED');

    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();
    const arrayBuffer = await this.request<ArrayBuffer>('getBarcodePdfByPrintTaskUuid', {
      method: 'GET',
      url: `${baseUrl}/v2/print/barcodes/${uuid}.pdf`,
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });

    return Buffer.from(arrayBuffer);
  }

  async getWaybillPdfByOrderUuid(orderUuid: string): Promise<Buffer> {
    const printTaskUuid = await this.createWaybillPrintTask(orderUuid);
    return this.getWaybillPdfByPrintTaskUuid(printTaskUuid);
  }
}

export const cdekService = new CdekService();
