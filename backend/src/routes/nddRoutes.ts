import { Router } from "express";
import { yandexDeliveryService } from "../services/yandexDeliveryService";
// Если хочешь закрыть авторизацией - раскомментируй:
// import { requireAuth } from "../middleware/authMiddleware";
import type { AxiosError } from "axios";

export const nddRoutes = Router();

/**
 * GET /api/ndd/pickup-points?city=Москва
 *
 * Возвращает массив точек:
 * [{ id, address, lat, lon, raw }]
 *
 * Важно:
 * - НДД метод Яндекса — POST /pickup-points/list
 * - Мы делаем удобный GET для фронта
 */

// nddRoutes.get("/pickup-points", requireAuth, async (req, res) => {
nddRoutes.get("/pickup-points", async (req, res) => {
  try {
    const cityRaw = String(req.query.city ?? "").trim();
    const city = cityRaw || "Москва";

    // Минимальный bbox, чтобы ты прямо сейчас увидел точки.
    // Потом можно сделать нормальный поиск по городу (геокодер/подсказки и т.п.)
    const bboxByCity: Record<
      string,
      { latFrom: number; latTo: number; lonFrom: number; lonTo: number }
    > = {
      Москва: { latFrom: 55.4, latTo: 56.1, lonFrom: 37.2, lonTo: 38.1 },
      Moscow: { latFrom: 55.4, latTo: 56.1, lonFrom: 37.2, lonTo: 38.1 },
      "Санкт-Петербург": {
        latFrom: 59.7,
        latTo: 60.2,
        lonFrom: 29.7,
        lonTo: 30.7,
      },
      "Saint Petersburg": {
        latFrom: 59.7,
        latTo: 60.2,
        lonFrom: 29.7,
        lonTo: 30.7,
      },
    };

    const bbox = bboxByCity[city] ?? bboxByCity["Москва"];

    // Это тот payload, который у тебя уже мелькал в логах (latitude/longitude + is_post_office)
    const payload = {
      is_post_office: false,
      latitude: { from: bbox.latFrom, to: bbox.latTo },
      longitude: { from: bbox.lonFrom, to: bbox.lonTo },
      // если нужно фильтровать типы:
      // type: "PVZ",
    };

    const raw = await yandexDeliveryService.listPickupPoints(payload);

    // В ответе Яндекса обычно { points: [...] }.
    // Делаем максимально "жирный" парсер, чтобы не зависеть от полей.
    const points = Array.isArray((raw as any)?.points)
      ? (raw as any).points
      : Array.isArray(raw)
        ? raw
        : [];

    const mapped = points
      .map((p: any) => {
        const id = String(p?.id ?? p?.point_id ?? p?.platform_station_id ?? "");

        const lat = Number(p?.latitude ?? p?.location?.latitude ?? p?.geo?.lat);
        const lon = Number(
          p?.longitude ?? p?.location?.longitude ?? p?.geo?.lon,
        );

        const address = String(
          p?.address?.full_address ??
            p?.address?.address ??
            p?.address ??
            p?.name ??
            "",
        );

        if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        return { id, address, lat, lon, raw: p };
      })
      .filter(Boolean);

    return res.json(mapped);
  } catch (e: any) {
    const err = e as AxiosError<any>;
    const status = err.response?.status ?? 500;
    const data = err.response?.data ?? null;

    console.error("NDD pickup-points error:", {
      message: err.message,
      status,
      data,
    });

    return res.status(status).json({
      message: err.message || "NDD_PICKUP_POINTS_FAILED",
      upstreamStatus: status,
      upstreamData: data,
    });
  }
});
