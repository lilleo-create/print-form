import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { ensureYaNddWidgetLoaded } from "../../shared/lib/yaNddWidget";

export type YaPvzSelection = {
  pvzId: string;
  addressFull?: string;
  raw?: unknown;
};

type YaNddPvzModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sel: YaPvzSelection) => void;

  title?: string;

  // Город можно менять
  city?: string;

  // Важно: станция отгрузки продавца (GUID).
  // Если не передашь, виджет часто работает плохо/не показывает расчет и часть точек.
  sourcePlatformStationId?: string;

  // Вес, если нужно фильтровать точки по допустимому весу
  weightGrossG?: number;

  // Хочешь постаматы тоже? тогда includeTerminals=true
  includeTerminals?: boolean;

  // Параметры фильтра оплаты (можно выключить)
  paymentMethods?: Array<"already_paid" | "cash_on_receipt" | "card_on_receipt">;
};

export const YaNddPvzModal = ({
  isOpen,
  onClose,
  onSelect,
  title = "Выберите ПВЗ получения",
  city = "Москва",
  sourcePlatformStationId,
  weightGrossG = 10000,
  includeTerminals = true,
  paymentMethods = ["already_paid", "card_on_receipt"],
}: YaNddPvzModalProps) => {
  const containerId = useMemo(
    () => `ya-ndd-widget-${Math.random().toString(16).slice(2)}`,
    []
  );

  const portalRoot = useMemo(() => {
    const el = document.createElement("div");
    el.setAttribute("data-ya-ndd-portal-root", "true");
    return el;
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    document.body.appendChild(portalRoot);
    return () => portalRoot.remove();
  }, [portalRoot]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setError("");

      try {
        await ensureYaNddWidgetLoaded();
        if (cancelled) return;

        // Небольшая проверка: если нет станции отгрузки, виджет может работать,
        // но часто это не то поведение, которое тебе нужно в проде.
        // Пока не блочим жестко, но предупреждаем.
        if (!sourcePlatformStationId) {
          console.warn(
            "[YaNddPvzModal] sourcePlatformStationId is missing. " +
              "Widget may show incomplete results."
          );
        }

        // 1) Подписываемся на событие выбора точки
        const onPointSelected = (evt: any) => {
          const d = evt?.detail;
          if (!d?.id) return;

          onSelect({
            pvzId: String(d.id),
            addressFull: d?.address?.full_address,
            raw: d,
          });

          onClose();
        };

        document.addEventListener("YaNddWidgetPointSelected", onPointSelected);

        // 2) Создаем виджет
        // Важно: контейнер должен существовать в DOM
        const container = document.getElementById(containerId);
        if (!container) return;

        // иногда виджет не любит повторный createWidget в тот же контейнер
        container.innerHTML = "";

        (window as any).YaDelivery.createWidget({
          containerId,
          params: {
            city,
            size: { width: "100%", height: "100%" },

            // расчет и фильтрация по весу
            physical_dims_weight_gross: weightGrossG,

            // если есть станция отгрузки (ПВЗ продавца) - передаем
            ...(sourcePlatformStationId
              ? { source_platform_station: sourcePlatformStationId }
              : {}),

            show_select_button: true,

            filter: {
              type: includeTerminals ? ["pickup_point", "terminal"] : ["pickup_point"],
              is_yandex_branded: false,
              payment_methods: paymentMethods,
              payment_methods_filter: "or",
            },
          },
        });

        // 3) Cleanup
        return () => {
          document.removeEventListener("YaNddWidgetPointSelected", onPointSelected);
        };
      } catch (e: any) {
        setError(e?.message || "Ошибка инициализации виджета ПВЗ");
      } finally {
        setLoading(false);
      }
    };

    let cleanup: any;
    init().then((c) => (cleanup = c));

    return () => {
      cancelled = true;
      if (typeof cleanup === "function") cleanup();
    };
  }, [
    isOpen,
    city,
    containerId,
    onClose,
    onSelect,
    sourcePlatformStationId,
    weightGrossG,
    includeTerminals,
    paymentMethods,
  ]);

  if (!isOpen) return null;

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 96vw)",
          height: "min(720px, 90vh)",
          background: "#0b1630",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "56px 1fr",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          <span>{title}</span>
          <button
            onClick={onClose}
            style={{
              cursor: "pointer",
              background: "transparent",
              border: 0,
              color: "inherit",
              fontSize: 22,
              lineHeight: 1,
              padding: 8,
            }}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div style={{ position: "relative", height: "100%" }}>
          <div
            id={containerId}
            style={{
              width: "100%",
              height: "100%",
              background: "rgba(255,255,255,0.06)",
            }}
          />

          {loading && (
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: 12,
                padding: 10,
                borderRadius: 10,
                background: "rgba(0,0,0,0.35)",
                color: "#fff",
                fontSize: 13,
              }}
            >
              Загружаю виджет ПВЗ…
            </div>
          )}

          {error && (
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: 12,
                padding: 10,
                borderRadius: 10,
                background: "rgba(255, 0, 0, 0.18)",
                border: "1px solid rgba(255, 0, 0, 0.35)",
                color: "#fff",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, portalRoot);
};
