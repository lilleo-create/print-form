import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { Controller, useForm } from 'react-hook-form';
import { ImageCropModal } from './ImageCropModal';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPortal } from 'react-dom';
import { Product, ProductVariant } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import { useOverlayClose } from '../../shared/lib/useOverlayClose';
import { toEditableProduct } from '../../shared/lib/editableProduct';
import { api } from '../../shared/api';
import { getModerationStatusLabelRu } from '../../shared/lib/productModeration';
import { sellerProductVariantsService } from '../../shared/api/sellerProductVariantsService';
import { normalizeApiError } from '../../shared/api/client';
import {
  formatPriceFromMinorUnits,
  normalizeRublesInput,
  parsePriceToMinorUnits
} from '../../shared/lib/productPrice';
import { cmToMm, mmToCm } from '../../shared/lib/productDimensions';
import styles from './SellerProductModal.module.css';
import {
  detectProductMediaKind,
  formatSize,
  getVideoDuration,
  IMAGE_MAX_SIZE_BYTES,
  PRODUCT_MEDIA_ACCEPT,
  VIDEO_MAX_DURATION_SECONDS,
  VIDEO_MAX_SIZE_BYTES,
  type ProductMediaKind
} from './productMedia';
import {
  findColorOptionByLabel,
  normalizeProductColor,
  PRODUCT_COLOR_OPTIONS
} from './productColors';

const ENABLE_PRODUCT_EDIT_DRAFT = false;

const TECHNOLOGY_OPTIONS = [
  'FDM',
  'SLA',
  'SLS',
  'DLP',
  'MSLA',
  'MJF',
  'PolyJet',
  'DMLS',
  'Смола (Resin)',
];

const productSchema = z.object({
  title: z.string().min(2, 'Введите название'),
  descriptionShort: z.string().min(5, 'Добавьте краткое описание'),
  descriptionFull: z.string().min(10, 'Добавьте описание'),
  sku: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().regex(/^PF-\d{1,8}$/, 'Формат: PF-0001').optional()
  ),
  price: z.preprocess(
    (value) => normalizeRublesInput(value),
    z
      .string()
      .min(1, 'Введите цену')
      .refine((value) => /^\d+([.,]\d{1,2})?$/.test(value), 'Введите цену в формате 1200.50')
      .refine((value) => parsePriceToMinorUnits(value) > 0, 'Цена должна быть больше 0')
  ),
  material: z.string().min(2, 'Введите материал'),
  category: z.string().min(1, 'Выберите категорию'),
  technology: z.string().min(2, 'Введите технологию'),
  productionTimeHours: z.number().int().min(1, 'Минимум 1 час').max(720, 'Максимум 720 часов'),
  color: z.string().min(2, 'Выберите цвет'),
  weightGrossG: z.number().int().positive('Укажите вес (г)').optional(),
  dxCm: z.number().int().positive('Укажите ширину (мм)').optional(),
  dyCm: z.number().int().positive('Укажите глубину (мм)').optional(),
  dzCm: z.number().int().positive('Укажите высоту (мм)').optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

type MediaItem = {
  id: string;
  kind: ProductMediaKind;
  source: 'existing' | 'new';
  previewUrl: string;
  name: string;
  file?: File;
  remoteUrl?: string;
};

export interface SellerProductPayload {
  id?: string;
  title: string;
  price: number;
  material: string;
  category: string;
  technology: string;
  productionTimeHours: number;
  color: string;
  descriptionShort: string;
  description: string;
  descriptionFull: string;
  sku?: string;
  imageUrls: string[];
  videoUrls: string[];
  weightGrossG?: number;
  dxCm?: number;
  dyCm?: number;
  dzCm?: number;
}

interface VariantDraft {
  id: string;
  name: string;
  isBase: boolean;
  order: number;
  form: ProductFormValues;
  mediaItems: MediaItem[];
}

interface SellerProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSubmit: (payload: SellerProductPayload) => Promise<void>;
}

interface PersistedVariantDraft {
  id: string;
  name: string;
  isBase: boolean;
  order: number;
  form: ProductFormValues;
  mediaItems: Array<{
    id: string;
    kind: ProductMediaKind;
    source: 'existing';
    previewUrl: string;
    name: string;
    remoteUrl?: string;
  }>;
  pendingLocalFiles: string[];
}

interface PersistedSellerProductDraft {
  activeVariantId: string;
  variantDrafts: PersistedVariantDraft[];
}

const SELLER_PRODUCT_DRAFT_PREFIX = 'pf_seller_product_form';

const getSellerProductDraftKey = (product: Product | null) =>
  `${SELLER_PRODUCT_DRAFT_PREFIX}:${product ? `edit:${product.id}` : 'create:new'}`;

const sanitizeFormValues = (form?: Partial<ProductFormValues>): ProductFormValues => ({
  ...getDefaultFormValues(),
  ...form,
  productionTimeHours: form?.productionTimeHours ?? 24,
  price: typeof form?.price === 'string' ? form.price : ''
});

const toPersistedVariantDraft = (variant: VariantDraft): PersistedVariantDraft => ({
  id: variant.id,
  name: variant.name,
  isBase: variant.isBase,
  order: variant.order,
  form: sanitizeFormValues(variant.form),
  mediaItems: variant.mediaItems
    .filter((item) => item.source === 'existing')
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      source: 'existing' as const,
      previewUrl: item.previewUrl,
      remoteUrl: item.remoteUrl,
      name: item.name
    })),
  pendingLocalFiles: variant.mediaItems
    .filter((item) => item.source === 'new')
    .map((item) => item.name)
});

const createExistingMediaItems = (product: Product | null): MediaItem[] => {
  const editableProduct = toEditableProduct(product);
  if (!editableProduct) return [];

  const imageUrls = editableProduct.imageUrls;

  const imageItems = imageUrls.map((url, index) => ({
    id: `existing-image-${index}`,
    kind: 'image' as const,
    source: 'existing' as const,
    previewUrl: url,
    remoteUrl: url,
    name: `Изображение ${index + 1}`
  }));

  const videoItems = editableProduct.videoUrls.map((url, index) => ({
    id: `existing-video-${index}`,
    kind: 'video' as const,
    source: 'existing' as const,
    previewUrl: url,
    remoteUrl: url,
    name: `Видео ${index + 1}`
  }));

  return [...imageItems, ...videoItems];
};

const getDefaultFormValues = (): ProductFormValues => ({
  title: '',
  descriptionShort: '',
  descriptionFull: '',
  sku: '',
  price: '',
  material: '',
  category: '',
  technology: '',
  productionTimeHours: 24,
  color: PRODUCT_COLOR_OPTIONS[0].label,
  weightGrossG: undefined,
  dxCm: undefined,
  dyCm: undefined,
  dzCm: undefined,
});

const getProductFormValues = (product: Product): ProductFormValues => {
  const editableProduct = toEditableProduct(product);
  return {
    title: editableProduct?.title ?? '',
    descriptionShort: editableProduct?.descriptionShort ?? '',
    descriptionFull: editableProduct?.descriptionFull ?? editableProduct?.description ?? '',
    sku: editableProduct?.sku ?? '',
    price: editableProduct ? formatPriceFromMinorUnits(editableProduct.price) : '',
    material: editableProduct?.material ?? '',
    category: editableProduct?.category ?? '',
    technology: editableProduct?.technology ?? '',
    productionTimeHours: editableProduct?.productionTimeHours ?? 24,
    color: normalizeProductColor(editableProduct?.color ?? ''),
    weightGrossG: editableProduct?.weightGrossG,
    dxCm: cmToMm(editableProduct?.dxCm),
    dyCm: cmToMm(editableProduct?.dyCm),
    dzCm: cmToMm(editableProduct?.dzCm)
  } satisfies ProductFormValues;
};

const revokeNewMediaUrls = (drafts: VariantDraft[]) => {
  drafts.forEach((draft) => {
    draft.mediaItems.forEach((item) => {
      if (item.source === 'new') {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  });
};

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeVariantOptions = (value: unknown): Record<string, string[]> => {
  if (!isRecord(value)) return {};

  return Object.entries(value).reduce<Record<string, string[]>>((acc, [key, optionValue]) => {
    if (Array.isArray(optionValue)) {
      const nextValues = optionValue.filter((entry): entry is string => typeof entry === 'string');
      if (nextValues.length > 0) {
        acc[key] = nextValues;
      }
      return acc;
    }

    if (typeof optionValue === 'string' && optionValue.trim().length > 0) {
      acc[key] = [optionValue];
    }

    return acc;
  }, {});
};

const normalizeVariant = (value: unknown): ProductVariant | null => {
  if (!isRecord(value) || typeof value.id !== 'string') return null;

  return {
    id: value.id,
    name: typeof value.name === 'string' && value.name.trim().length > 0 ? value.name : 'Новый вариант',
    options: normalizeVariantOptions(value.options),
    sku: typeof value.sku === 'string' ? value.sku : undefined,
    stock: typeof value.stock === 'number' ? value.stock : undefined,
    priceDelta: typeof value.priceDelta === 'number' ? value.priceDelta : undefined,
    productId: typeof value.productId === 'string' ? value.productId : undefined
  };
};

const parseProductVariants = (payload: unknown): ProductVariant[] => {
  if (Array.isArray(payload)) {
    return payload.map(normalizeVariant).filter((variant): variant is ProductVariant => Boolean(variant));
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.variants)) {
    return parseProductVariants(payload.variants);
  }

  if (Array.isArray(payload.items)) {
    return parseProductVariants(payload.items);
  }

  if ('variant' in payload) {
    return parseProductVariants(payload.variant);
  }

  if ('productVariants' in payload) {
    return parseProductVariants(payload.productVariants);
  }

  const singleVariant = normalizeVariant(payload);
  return singleVariant ? [singleVariant] : [];
};

export const SellerProductModal = ({ product, onClose, onSubmit }: SellerProductModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variantDraftsRef = useRef<VariantDraft[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [skuError, setSkuError] = useState('');
  const [technologyCustom, setTechnologyCustom] = useState(false);
  const [cropTarget, setCropTarget] = useState<{ itemId: string; previewUrl: string; fileName: string } | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [categories, setCategories] = useState<{ id: string; title: string }[]>([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [activeProductVariantId, setActiveProductVariantId] = useState<string>('base');
  const [variantForm, setVariantForm] = useState({
    name: '',
    color: '',
    sku: '',
    stock: '',
    priceDelta: '',
  });
  const [variantError, setVariantError] = useState<string | null>(null);
  const [isVariantBusy, setIsVariantBusy] = useState(false);
  const [isVariantRouteUnavailable, setIsVariantRouteUnavailable] = useState(false);
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [activeVariantId, setActiveVariantId] = useState('');
  const [brokenMedia, setBrokenMedia] = useState<Record<string, boolean>>({});
  const draftKey = useMemo(() => getSellerProductDraftKey(product), [product]);
  const persistedPayload = useMemo<PersistedSellerProductDraft | null>(
    () =>
      ENABLE_PRODUCT_EDIT_DRAFT && variantDrafts.length
        ? {
            activeVariantId,
            variantDrafts: variantDrafts.map(toPersistedVariantDraft)
          }
        : null,
    [variantDrafts, activeVariantId]
  );
  const { clearDraft } = usePersistedForm<PersistedSellerProductDraft>({
    storageKey: draftKey,
    data: persistedPayload,
    enabled: ENABLE_PRODUCT_EDIT_DRAFT,
    debounceMs: 300
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ProductFormValues>({ resolver: zodResolver(productSchema) });

  useModalFocus(true, onClose, modalRef);
  const { handlePointerDown, handleClick } = useOverlayClose(onClose);

  const activeVariant = useMemo(
    () => variantDrafts.find((variant) => variant.id === activeVariantId) ?? null,
    [variantDrafts, activeVariantId]
  );
  const activeProductVariant = useMemo(
    () => productVariants.find((variant) => variant.id === activeProductVariantId) ?? null,
    [productVariants, activeProductVariantId]
  );

  const currentColor = watch('color');
  const selectedColorOption = useMemo(() => findColorOptionByLabel(currentColor ?? ''), [currentColor]);

  useEffect(() => {
    const initialForm = product ? getProductFormValues(product) : getDefaultFormValues();
    const initialDraft: VariantDraft = {
      id: product?.id ? `base-${product.id}` : 'base-new',
      name: 'Базовый товар',
      isBase: true,
      order: 1,
      form: initialForm,
      mediaItems: createExistingMediaItems(product)
    };

    const nextDrafts: VariantDraft[] = [initialDraft];
    const nextActiveVariantId = initialDraft.id;

    setVariantDrafts((prev) => {
      revokeNewMediaUrls(prev);
      return nextDrafts;
    });
    setActiveVariantId(nextActiveVariantId);
    setFileErrors([]);
    setUploadError('');

    const activeDraft = nextDrafts.find((variant) => variant.id === nextActiveVariantId) ?? nextDrafts[0] ?? initialDraft;
    reset(activeDraft.form);

    const tech = activeDraft.form.technology ?? '';
    setTechnologyCustom(tech.length > 0 && !TECHNOLOGY_OPTIONS.includes(tech));
  }, [product, reset]);

  useEffect(() => {
    if (!ENABLE_PRODUCT_EDIT_DRAFT) {
      clearDraft();
    }
  }, [clearDraft, draftKey]);

  useEffect(() => {
    if (!product?.id) {
      setProductVariants([]);
      setActiveProductVariantId('base');
      setVariantError(null);
      setIsVariantRouteUnavailable(false);
      return;
    }

    const localVariants = parseProductVariants(product.variants);
    setProductVariants(localVariants);
    setActiveProductVariantId('base');
    setVariantError(null);

    let isMounted = true;
    sellerProductVariantsService
      .list(product.id)
      .then((response) => {
        if (!isMounted) return;
        setProductVariants(parseProductVariants(response.data));
        setActiveProductVariantId('base');
        setIsVariantRouteUnavailable(false);
        setVariantError(null);
      })
      .catch((error) => {
        if (!isMounted) return;
        const normalized = normalizeApiError(error);
        const isRouteIssue =
          normalized.status === 404 ||
          normalized.code === 'ROUTE_NOT_FOUND' ||
          normalized.message.includes('404');
        setIsVariantRouteUnavailable(isRouteIssue);
        setProductVariants(localVariants);
        setVariantError(
          isRouteIssue
            ? localVariants.length
              ? 'Отдельный endpoint вариантов недоступен. Показаны варианты из карточки товара.'
              : 'Варианты доступны только в карточке товара: отдельный endpoint сейчас недоступен.'
            : 'Не удалось загрузить варианты товара.'
        );
      });

    return () => {
      isMounted = false;
    };
  }, [product?.id]);

  useEffect(() => {
    let isMounted = true;
    api
      .getReferenceCategories()
      .then((response) => {
        if (!isMounted) return;
        setCategories(
          toArray<{ id: string; title: string }>(response.data).map((item) => ({
            id: item.id,
            title: item.title
          }))
        );
        setCategoriesError('');
      })
      .catch(() => {
        if (!isMounted) return;
        setCategories([]);
        setCategoriesError('Не удалось загрузить категории.');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeProductVariant) {
      setVariantForm({
        name: '',
        color: '',
        sku: '',
        stock: '',
        priceDelta: '',
      });
      return;
    }

    setVariantForm({
      name: activeProductVariant.name,
      color: activeProductVariant.options?.color?.[0] ?? 'Без цвета',
      sku: activeProductVariant.sku ?? '',
      stock: activeProductVariant.stock !== undefined ? String(activeProductVariant.stock) : '',
      priceDelta:
        activeProductVariant.priceDelta !== undefined ? String(activeProductVariant.priceDelta) : '',
    });
  }, [activeProductVariant]);

  useEffect(() => {
    variantDraftsRef.current = variantDrafts;
  }, [variantDrafts]);

  useEffect(() => {
    return () => {
      revokeNewMediaUrls(variantDraftsRef.current);
    };
  }, []);

  const updateActiveVariant = (updater: (variant: VariantDraft) => VariantDraft) => {
    if (!activeVariantId) return;
    setVariantDrafts((prev) => prev.map((variant) => (variant.id === activeVariantId ? updater(variant) : variant)));
  };

  const handleIncomingFiles = async (incoming: FileList | File[]) => {
    const nextErrors: string[] = [];
    const nextItems: MediaItem[] = [];

    for (const file of Array.from(incoming)) {
      const kind = detectProductMediaKind(file);

      if (!kind) {
        nextErrors.push(`Файл ${file.name}: неподдерживаемый формат.`);
        continue;
      }

      if (kind === 'image' && file.size > IMAGE_MAX_SIZE_BYTES) {
        nextErrors.push(`Файл ${file.name}: изображение больше ${formatSize(IMAGE_MAX_SIZE_BYTES)}.`);
        continue;
      }

      if (kind === 'video' && file.size > VIDEO_MAX_SIZE_BYTES) {
        nextErrors.push(`Файл ${file.name}: видео больше ${formatSize(VIDEO_MAX_SIZE_BYTES)}.`);
        continue;
      }

      if (kind === 'video') {
        try {
          const duration = await getVideoDuration(file);
          if (duration > VIDEO_MAX_DURATION_SECONDS) {
            nextErrors.push(`Файл ${file.name}: длительность больше ${VIDEO_MAX_DURATION_SECONDS} сек.`);
            continue;
          }
        } catch {
          nextErrors.push(`Файл ${file.name}: не удалось прочитать длительность видео.`);
          continue;
        }
      }

      nextItems.push({
        id: `${Date.now()}-${file.name}-${Math.random().toString(16).slice(2)}`,
        kind,
        source: 'new',
        file,
        name: file.name,
        previewUrl: URL.createObjectURL(file)
      });
    }

    setUploadError('');
    setFileErrors(nextErrors);
    if (nextItems.length) {
      updateActiveVariant((variant) => ({
        ...variant,
        mediaItems: [...variant.mediaItems, ...nextItems]
      }));
    }
  };

  const handleCropConfirm = (blob: Blob) => {
    if (!cropTarget) return;
    URL.revokeObjectURL(cropTarget.previewUrl);
    const croppedFile = new File([blob], cropTarget.fileName, { type: blob.type });
    const previewUrl = URL.createObjectURL(croppedFile);
    updateActiveVariant((variant) => ({
      ...variant,
      mediaItems: variant.mediaItems.map((item) =>
        item.id === cropTarget.itemId
          ? { ...item, file: croppedFile, previewUrl, source: 'new' as const }
          : item
      )
    }));
    setCropTarget(null);
  };

  const handleCropCancel = () => setCropTarget(null);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (event.dataTransfer.files?.length) {
      void handleIncomingFiles(event.dataTransfer.files);
    }
  };

  const removeMediaItem = (itemId: string) => {
    updateActiveVariant((variant) => {
      const target = variant.mediaItems.find((item) => item.id === itemId);
      if (target?.source === 'new') {
        URL.revokeObjectURL(target.previewUrl);
      }
      return {
        ...variant,
        mediaItems: variant.mediaItems.filter((item) => item.id !== itemId)
      };
    });
  };

  const moveMediaItem = (index: number, direction: -1 | 1) => {
    updateActiveVariant((variant) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= variant.mediaItems.length) {
        return variant;
      }
      const nextItems = [...variant.mediaItems];
      const [item] = nextItems.splice(index, 1);
      nextItems.splice(nextIndex, 0, item);
      return {
        ...variant,
        mediaItems: nextItems
      };
    });
  };

  const reloadProductVariants = async () => {
    if (!product?.id) return;
    if (isVariantRouteUnavailable) return;
    const response = await sellerProductVariantsService.list(product.id);
    const nextVariants = parseProductVariants(response.data);
    setProductVariants(nextVariants);
    return nextVariants;
  };

  const handleAddVariant = async () => {
    if (!product?.id) return;
    if (isVariantRouteUnavailable) {
      setVariantError('Сейчас нельзя добавить вариант: endpoint вариантов недоступен.');
      return;
    }
    setVariantError(null);
    setIsVariantBusy(true);
    try {
      const created = await sellerProductVariantsService.create(product.id, {
        name: `Вариант ${productVariants.length + 1}`
      });
      const createdVariant = parseProductVariants(created.data)[0] ?? null;
      const nextVariants = await reloadProductVariants();

      if (createdVariant && !nextVariants?.some((variant) => variant.id === createdVariant.id)) {
        setProductVariants((prev) => [...prev, createdVariant]);
      }

      if (createdVariant?.id) {
        setActiveProductVariantId(createdVariant.id);
      }
    } catch {
      setVariantError('Не удалось добавить вариант.');
    } finally {
      setIsVariantBusy(false);
    }
  };

  const handleSaveVariant = async () => {
    if (!product?.id || !activeProductVariant) return;
    if (isVariantRouteUnavailable) {
      setVariantError('Сейчас нельзя сохранить вариант: endpoint вариантов недоступен.');
      return;
    }
    setVariantError(null);
    setIsVariantBusy(true);
    try {
      const nextStock = variantForm.stock.trim();
      const nextPriceDelta = variantForm.priceDelta.trim();
      const nextColor = variantForm.color.trim();
      await sellerProductVariantsService.update(product.id, activeProductVariant.id, {
        name: variantForm.name.trim() || activeProductVariant.name,
        sku: variantForm.sku.trim() || undefined,
        stock: nextStock && !Number.isNaN(Number(nextStock)) ? Number(nextStock) : undefined,
        priceDelta:
          nextPriceDelta && !Number.isNaN(Number(nextPriceDelta))
            ? Number(nextPriceDelta)
            : undefined,
        options: nextColor
          ? { ...(activeProductVariant.options ?? {}), color: [nextColor] }
          : activeProductVariant.options,
      });
      await reloadProductVariants();
    } catch {
      setVariantError('Не удалось сохранить вариант.');
    } finally {
      setIsVariantBusy(false);
    }
  };

  const handleDeleteVariant = async () => {
    if (!product?.id || !activeProductVariant) return;
    if (isVariantRouteUnavailable) {
      setVariantError('Сейчас нельзя удалить вариант: endpoint вариантов недоступен.');
      return;
    }
    setVariantError(null);
    setIsVariantBusy(true);
    try {
      await sellerProductVariantsService.remove(product.id, activeProductVariant.id);
      await reloadProductVariants();
      setActiveProductVariantId('base');
    } catch {
      setVariantError('Не удалось удалить вариант.');
    } finally {
      setIsVariantBusy(false);
    }
  };

  const handleFormSubmit = async (values: ProductFormValues) => {
    if (!activeVariant) return;
    setUploadError('');
    setSkuError('');

    const currentMediaItems = toArray<MediaItem>(activeVariant.mediaItems);
    const newItems = currentMediaItems.filter((item): item is MediaItem & { source: 'new'; file: File } => item.source === 'new' && Boolean(item.file));
    const uploadedById = new Map<string, string>();

    if (newItems.length > 0) {
      setIsUploading(true);
      try {
        const uploadFiles = newItems.map((item) => item.file);
        const result = await api.uploadSellerImages(uploadFiles);
        const urls = result.data.urls;

        newItems.forEach((item, index) => {
          const url = urls[index];
          if (url) uploadedById.set(item.id, url);
        });
      } catch {
        setUploadError('Не удалось загрузить файлы. Попробуйте снова.');
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const resolvedMedia = currentMediaItems
      .map((item) => {
        if (item.source === 'existing') {
          return {
            kind: item.kind,
            url: item.remoteUrl ?? item.previewUrl
          };
        }

        const uploadedUrl = uploadedById.get(item.id);
        if (!uploadedUrl) return null;
        return {
          kind: item.kind,
          url: uploadedUrl
        };
      })
      .filter((item): item is { kind: ProductMediaKind; url: string } => Boolean(item));

    const imageUrls = resolvedMedia.filter((item) => item.kind === 'image').map((item) => item.url);
    const videoUrls = resolvedMedia.filter((item) => item.kind === 'video').map((item) => item.url);

    if (imageUrls.length === 0) {
      setUploadError('Добавьте хотя бы одно изображение.');
      return;
    }


    const payload: SellerProductPayload = {
      id: product?.id,
      title: values.title,
      price: parsePriceToMinorUnits(values.price),
      material: values.material,
      category: values.category,
      technology: values.technology,
      productionTimeHours: values.productionTimeHours,
      color: normalizeProductColor(values.color),
      descriptionShort: values.descriptionShort,
      description: values.descriptionFull,
      descriptionFull: values.descriptionFull,
      sku: values.sku?.trim() || undefined,
      imageUrls,
      videoUrls,
      weightGrossG: values.weightGrossG,
      dxCm: mmToCm(values.dxCm),
      dyCm: mmToCm(values.dyCm),
      dzCm: mmToCm(values.dzCm),
    };

    try {
      await onSubmit(payload);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const isSkuConflict =
        message.toLowerCase().includes('sku') ||
        message.toLowerCase().includes('артикул') ||
        message.includes('409') ||
        message.toLowerCase().includes('conflict') ||
        message.toLowerCase().includes('duplicate');
      if (isSkuConflict) {
        setSkuError('Этот артикул уже занят. Введите другой.');
      } else {
        setUploadError(message || 'Не удалось сохранить товар. Попробуйте снова.');
      }
      return;
    }
    if (ENABLE_PRODUCT_EDIT_DRAFT) {
      clearDraft();
    }
    onClose();
  };

  const activeMediaItems = activeVariant?.mediaItems ?? [];

  useEffect(() => {
    setBrokenMedia({});
  }, [activeVariantId, activeMediaItems.length]);

  return (
    <>
    {createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" onPointerDown={handlePointerDown} onClick={handleClick}>
      <div
        className={styles.modal}
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h3>{product ? 'Редактировать товар' : 'Добавить товар'}</h3>
          <button className={styles.close} onClick={onClose} aria-label="Закрыть форму" type="button">
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>



        <form className={styles.form} onSubmit={handleSubmit(handleFormSubmit)}>
          {product ? (
            <section className={styles.section}>
              <div className={styles.variantHeaderRow}>
                <h4 className={styles.sectionTitle}>Варианты товара</h4>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddVariant}
                  disabled={isVariantBusy || isVariantRouteUnavailable}
                >
                  Добавить вариант
                </Button>
              </div>
              <p className={styles.muted}>
                Если товар выпускается в нескольких вариантах, например по цвету или размеру, вы можете объединить их в одну карточку.
                Покупатель будет переключаться между вариантами на странице товара.
              </p>
              <div className={styles.variantsRow}>
                <button
                  type="button"
                  className={`${styles.variantPill} ${activeProductVariantId === 'base' ? styles.variantPillActive : ''}`}
                  onClick={() => setActiveProductVariantId('base')}
                >
                  Базовый товар
                </button>
                {productVariants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className={`${styles.variantPill} ${activeProductVariantId === variant.id ? styles.variantPillActive : ''}`}
                    onClick={() => setActiveProductVariantId(variant.id)}
                  >
                    {variant.name}
                  </button>
                ))}
              </div>
              {activeProductVariant ? (
                <div className={styles.variantEditor}>
                  <label>
                    Название
                    <input
                      className={styles.input}
                      value={variantForm.name}
                      onChange={(event) => {
                        setVariantError(null);
                        setVariantForm((prev) => ({ ...prev, name: event.target.value }));
                      }}
                    />
                  </label>
                  <label>
                    Цвет
                    <input
                      className={styles.input}
                      value={variantForm.color}
                      onChange={(event) => {
                        setVariantError(null);
                        setVariantForm((prev) => ({ ...prev, color: event.target.value }));
                      }}
                    />
                  </label>
                  <label>
                    SKU (необязательно)
                    <input
                      className={styles.input}
                      value={variantForm.sku}
                      onChange={(event) => {
                        setVariantError(null);
                        setVariantForm((prev) => ({ ...prev, sku: event.target.value }));
                      }}
                    />
                  </label>
                  <label>
                    Остаток
                    <input
                      className={styles.input}
                      value={variantForm.stock}
                      onChange={(event) => {
                        setVariantError(null);
                        setVariantForm((prev) => ({ ...prev, stock: event.target.value }));
                      }}
                    />
                  </label>
                  <label>
                    Δ цены
                    <input
                      className={styles.input}
                      value={variantForm.priceDelta}
                      onChange={(event) => {
                        setVariantError(null);
                        setVariantForm((prev) => ({ ...prev, priceDelta: event.target.value }));
                      }}
                    />
                  </label>
                  <div className={styles.variantActions}>
                    <Button type="button" onClick={handleSaveVariant} disabled={isVariantBusy || isVariantRouteUnavailable}>
                      Сохранить вариант
                    </Button>
                    <Button type="button" variant="secondary" onClick={handleDeleteVariant} disabled={isVariantBusy || isVariantRouteUnavailable}>
                      Удалить вариант
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={styles.muted}>Выбран базовый товар. Для него варианты не редактируются.</p>
              )}
              {variantError ? <p className={styles.errorText}>{variantError}</p> : null}
            </section>
          ) : null}

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Главное о товаре</h4>
            <p className={styles.muted}><span className={styles.requiredMark}>*</span> — обязательные поля</p>
            <label>
              <span>Название <span className={styles.requiredMark}>*</span></span>
              <input className={errors.title ? styles.inputError : styles.input} placeholder="Название товара" {...register('title')} />
              {errors.title && <span className={styles.errorText}>{errors.title.message}</span>}
            </label>
            <label>
              <span>Материал <span className={styles.requiredMark}>*</span></span>
              <input className={errors.material ? styles.inputError : styles.input} placeholder="Материал / ключевая особенность" {...register('material')} />
              {errors.material && <span className={styles.errorText}>{errors.material.message}</span>}
            </label>
            <label>
              <span>Краткое описание <span className={styles.requiredMark}>*</span></span>
              <input className={errors.descriptionShort ? styles.inputError : styles.input} placeholder="Коротко о товаре" {...register('descriptionShort')} />
              {errors.descriptionShort && <span className={styles.errorText}>{errors.descriptionShort.message}</span>}
            </label>
            <label>
              <span>Описание <span className={styles.requiredMark}>*</span></span>
              <textarea
                rows={4}
                className={errors.descriptionFull ? styles.inputError : styles.input}
                placeholder="Подробное описание товара"
                {...register('descriptionFull')}
              />
              {errors.descriptionFull && <span className={styles.errorText}>{errors.descriptionFull.message}</span>}
            </label>
            <label>
              <span>Артикул</span>
              <input
                {...register('sku')}
                className={(errors.sku || skuError) ? styles.inputError : styles.input}
                placeholder="PF-0001"
                value={watch('sku') ?? ''}
                onChange={(e) => {
                  setSkuError('');
                  const raw = e.target.value;
                  const suffix = (raw.startsWith('PF-') ? raw.slice(3) : raw).replace(/\D/g, '').slice(0, 8);
                  setValue('sku', suffix ? `PF-${suffix}` : undefined, { shouldValidate: true });
                }}
              />
              <span className={styles.muted}>Если не заполнить — артикул будет присвоен автоматически</span>
              {errors.sku && <span className={styles.errorText}>{errors.sku.message}</span>}
              {skuError && <span className={styles.errorText}>{skuError}</span>}
            </label>
            <label>
              <span>Категория <span className={styles.requiredMark}>*</span></span>
              <select className={errors.category ? styles.inputError : styles.input} {...register('category')}>
                <option value="">Выберите категорию</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.title}>
                    {category.title}
                  </option>
                ))}
              </select>
              {categoriesError && <span className={styles.errorText}>{categoriesError}</span>}
              {errors.category && <span className={styles.errorText}>{errors.category.message}</span>}
            </label>
            <div className={styles.inlineFields}>
              <label>
                <span>Технология <span className={styles.requiredMark}>*</span></span>
                <select
                  className={errors.technology && !technologyCustom ? styles.inputError : styles.input}
                  value={technologyCustom ? 'other' : (watch('technology') ?? '')}
                  onChange={(e) => {
                    if (e.target.value === 'other') {
                      setTechnologyCustom(true);
                      setValue('technology', '', { shouldValidate: false });
                    } else {
                      setTechnologyCustom(false);
                      setValue('technology', e.target.value, { shouldValidate: true });
                    }
                  }}
                >
                  <option value="">Выберите технологию</option>
                  {TECHNOLOGY_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="other">Свой вариант...</option>
                </select>
                {technologyCustom && (
                  <input
                    className={errors.technology ? styles.inputError : styles.input}
                    placeholder="Например, Polyjet"
                    autoFocus
                    {...register('technology')}
                  />
                )}
                {errors.technology && <span className={styles.errorText}>{errors.technology.message}</span>}
              </label>
              <label>
                <span>Срок изготовления (часы) <span className={styles.requiredMark}>*</span></span>
                <input type="number" min={1} max={720} className={errors.productionTimeHours ? styles.inputError : styles.input} placeholder="24" {...register('productionTimeHours', { valueAsNumber: true })} />
                {errors.productionTimeHours && <span className={styles.errorText}>{errors.productionTimeHours.message}</span>}
              </label>
              <label>
                <span>Цена <span className={styles.requiredMark}>*</span></span>
                <input
                  type="text"
                  inputMode="decimal"
                  className={errors.price ? styles.inputError : styles.input}
                  placeholder="Например, 1200"
                  {...register('price')}
                />
                {errors.price && <span className={styles.errorText}>{errors.price.message}</span>}
              </label>
              {product ? (
                <label>
                  Статус модерации
                  <input
                    className={styles.input}
                    value={getModerationStatusLabelRu(
                      product.moderationStatus,
                      product.moderationStatusLabelRu
                    )}
                    readOnly
                  />
                </label>
              ) : null}
            </div>
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Параметры товара</h4>
            <div className={styles.inlineFields}>
              <label>
                <span>Цвет товара <span className={styles.requiredMark}>*</span></span>
                <Controller
                  control={control}
                  name="color"
                  render={({ field }) => (
                    <select
                      className={errors.color ? styles.inputError : styles.input}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    >
                      {PRODUCT_COLOR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.label}>
                          {option.label}
                        </option>
                      ))}
                      {field.value && !findColorOptionByLabel(field.value) ? <option value={field.value}>Другое: {field.value}</option> : null}
                    </select>
                  )}
                />
                <div className={styles.colorHelperRow}>
                  {selectedColorOption ? (
                    <>
                      <span
                        className={styles.colorDot}
                        style={{
                          background: selectedColorOption.hex,
                          borderColor: selectedColorOption.needsBorder ? 'var(--border)' : 'transparent'
                        }}
                      />
                      <span className={styles.muted}>Выбран цвет: {selectedColorOption.label}</span>
                    </>
                  ) : currentColor ? (
                    <span className={styles.muted}>Старое значение: {currentColor}</span>
                  ) : null}
                </div>
                {errors.color && <span className={styles.errorText}>{errors.color.message}</span>}
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Вес и габариты с упаковкой</h4>
            <div className={styles.inlineFields}>
              <label>
                Вес брутто (г)
                <input type="number" min={1} className={errors.weightGrossG ? styles.inputError : styles.input} {...register('weightGrossG', { setValueAs: (value) => (value === '' ? undefined : Number(value)) })} />
                {errors.weightGrossG && <span className={styles.errorText}>{errors.weightGrossG.message}</span>}
              </label>
              <label>
                Ширина (мм)
                <input type="number" min={1} className={errors.dxCm ? styles.inputError : styles.input} {...register('dxCm', { setValueAs: (value) => (value === '' ? undefined : Number(value)) })} />
                {errors.dxCm && <span className={styles.errorText}>{errors.dxCm.message}</span>}
              </label>
              <label>
                Глубина (мм)
                <input type="number" min={1} className={errors.dyCm ? styles.inputError : styles.input} {...register('dyCm', { setValueAs: (value) => (value === '' ? undefined : Number(value)) })} />
                {errors.dyCm && <span className={styles.errorText}>{errors.dyCm.message}</span>}
              </label>
              <label>
                Высота (мм)
                <input type="number" min={1} className={errors.dzCm ? styles.inputError : styles.input} {...register('dzCm', { setValueAs: (value) => (value === '' ? undefined : Number(value)) })} />
                {errors.dzCm && <span className={styles.errorText}>{errors.dzCm.message}</span>}
              </label>
            </div>

            {(() => {
              const dx = watch('dxCm');
              const dy = watch('dyCm');
              const dz = watch('dzCm');
              const weight = watch('weightGrossG');
              if (!dx || !dy || !dz) return null;
              return <p className={styles.muted}>Размер: {dx}×{dy}×{dz} мм{weight ? `, вес: ${weight} г` : ''}</p>;
            })()}
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Изображения и видео товара</h4>
            <p className={styles.muted}>
              Фото: JPG, PNG, WEBP, HEIC/HEIF · <strong>рекомендуемый размер 800×800 px (1:1, квадрат)</strong> · до {formatSize(IMAGE_MAX_SIZE_BYTES)}.<br />
              Видео: MP4, MOV, WEBM · до {formatSize(VIDEO_MAX_SIZE_BYTES)}, до {VIDEO_MAX_DURATION_SECONDS} сек.<br />
              После выбора фото откроется редактор для кадрирования под квадрат.
            </p>
            <div
              className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={PRODUCT_MEDIA_ACCEPT}
                multiple
                className={styles.fileInput}
                onChange={(event) => {
                  if (event.target.files?.length) {
                    void handleIncomingFiles(event.target.files);
                  }
                  event.target.value = '';
                }}
              />
              <div className={styles.dropzoneContent}>
                <span className={styles.dropzoneIcon}>⬆️</span>
                <div>
                  <p>Загрузка медиа</p>
                  <p className={styles.dropzoneHint}>Перетащите файлы сюда или нажмите для выбора</p>
                </div>
              </div>
            </div>

            {activeMediaItems.length > 0 && (
              <div className={styles.fileList}>
                {activeMediaItems.map((item, index) => (
                  <div key={item.id} className={styles.fileItem}>
                    <div className={styles.filePreviewWrap}>
                      {brokenMedia[item.id] ? (
                        <div className={styles.filePreviewPlaceholder}>
                          {item.kind === 'image' ? 'Фото недоступно' : 'Видео недоступно'}
                        </div>
                      ) : item.kind === 'image' ? (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className={styles.filePreview}
                          onError={() =>
                            setBrokenMedia((prev) => ({ ...prev, [item.id]: true }))
                          }
                        />
                      ) : (
                        <video
                          src={item.previewUrl}
                          className={styles.filePreview}
                          muted
                          playsInline
                          preload="metadata"
                          onError={() =>
                            setBrokenMedia((prev) => ({ ...prev, [item.id]: true }))
                          }
                        />
                      )}
                      {item.kind === 'image' && item.source === 'new' && !brokenMedia[item.id] && (
                        <button
                          type="button"
                          className={styles.cropBtn}
                          title="Обрезать фото"
                          onClick={() => setCropTarget({ itemId: item.id, previewUrl: item.previewUrl, fileName: item.name })}
                        >
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M4 1v10h10M1 4h10v10"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className={styles.fileMeta}>
                      <span className={styles.fileName}>{item.name}</span>
                      <span className={styles.fileType}>{item.kind === 'image' ? 'Фото' : 'Видео'}{index === 0 ? ' • Главное медиа' : ''}</span>
                    </div>
                    <div className={styles.fileActions}>
                      <button type="button" className={styles.sortButton} disabled={index === 0} onClick={() => moveMediaItem(index, -1)}>
                        ↑
                      </button>
                      <button type="button" className={styles.sortButton} disabled={index === activeMediaItems.length - 1} onClick={() => moveMediaItem(index, 1)}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className={styles.removeFile}
                        onClick={() => removeMediaItem(item.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {fileErrors.length > 0 && (
              <ul className={styles.errorList}>
                {fileErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
            {uploadError && <span className={styles.errorText}>{uploadError}</span>}
          </section>

          <div className={styles.actions}>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? 'Загрузка…' : 'Сохранить'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )}
  {cropTarget && createPortal(
    <ImageCropModal
      src={cropTarget.previewUrl}
      fileName={cropTarget.fileName}
      onConfirm={handleCropConfirm}
      onCancel={handleCropCancel}
    />,
    document.body
  )}
  </>
  );
};
