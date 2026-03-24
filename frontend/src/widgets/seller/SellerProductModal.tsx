import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Product } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import { api } from '../../shared/api';
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

const productSchema = z.object({
  title: z.string().min(2, 'Введите название'),
  price: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? NaN : value),
    z
      .number({ invalid_type_error: 'Введите цену числом' })
      .min(1, 'Цена должна быть больше 0')
  ),
  material: z.string().min(2, 'Введите материал'),
  category: z.string().min(1, 'Выберите категорию'),
  technology: z.string().min(2, 'Введите технологию'),
  productionTimeHours: z.number().int().min(1, 'Минимум 1 час').max(720, 'Максимум 720 часов'),
  color: z.string().min(2, 'Выберите цвет'),
  description: z.string().min(10, 'Добавьте описание'),
  weightGrossG: z.number().int().positive('Укажите вес (г)').optional(),
  dxCm: z.number().int().positive('Укажите длину (см)').optional(),
  dyCm: z.number().int().positive('Укажите ширину (см)').optional(),
  dzCm: z.number().int().positive('Укажите высоту (см)').optional(),
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

export interface SellerProductVariantDraft {
  id: string;
  name: string;
  order: number;
  isBase: boolean;
  fields: ProductFormValues;
  attributes: {
    color: string;
    size?: string;
    other?: string;
  };
  media: {
    imageUrls: string[];
    videoUrls: string[];
    pendingLocalFiles: string[];
  };
}

export interface SellerProductPayload {
  id?: string;
  title: string;
  price: number;
  material: string;
  category: string;
  technology: string;
  productionTimeHours: number;
  color: string;
  description: string;
  imageUrls: string[];
  videoUrls: string[];
  weightGrossG?: number;
  dxCm?: number;
  dyCm?: number;
  dzCm?: number;
  variantsDraft?: SellerProductVariantDraft[];
}

interface VariantDraft {
  id: string;
  name: string;
  isBase: boolean;
  order: number;
  size: string;
  otherAttribute: string;
  form: ProductFormValues;
  mediaItems: MediaItem[];
}

interface SellerProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSubmit: (payload: SellerProductPayload) => Promise<void>;
}

const createExistingMediaItems = (product: Product | null): MediaItem[] => {
  if (!product) return [];

  const imageUrls = product.images?.length
    ? [...product.images].sort((a, b) => a.sortOrder - b.sortOrder).map((image) => image.url)
    : product.imageUrls?.length
      ? product.imageUrls
      : product.image
        ? [product.image]
        : [];

  const imageItems = imageUrls.map((url, index) => ({
    id: `existing-image-${index}`,
    kind: 'image' as const,
    source: 'existing' as const,
    previewUrl: url,
    remoteUrl: url,
    name: `Изображение ${index + 1}`
  }));

  const videoItems = (product.videoUrls ?? []).map((url, index) => ({
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
  price: 0,
  material: '',
  category: '',
  technology: '',
  productionTimeHours: 24,
  color: PRODUCT_COLOR_OPTIONS[0].label,
  description: '',
  weightGrossG: undefined,
  dxCm: undefined,
  dyCm: undefined,
  dzCm: undefined,
});

const getProductFormValues = (product: Product): ProductFormValues => ({
  title: product.title,
  price: product.price,
  material: product.material,
  category: product.category,
  technology: product.technology,
  productionTimeHours: product.productionTimeHours ?? 24,
  color: normalizeProductColor(product.color),
  description: product.description,
  weightGrossG: product.weightGrossG ?? undefined,
  dxCm: product.dxCm ?? undefined,
  dyCm: product.dyCm ?? undefined,
  dzCm: product.dzCm ?? undefined,
});

const createVariantFromCurrent = (source: VariantDraft, count: number): VariantDraft => ({
  id: `variant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: `Вариант ${count}`,
  isBase: false,
  order: count,
  size: '',
  otherAttribute: '',
  form: {
    ...source.form,
    color: source.form.color
  },
  mediaItems: []
});

const revokeNewMediaUrls = (drafts: VariantDraft[]) => {
  drafts.forEach((draft) => {
    draft.mediaItems.forEach((item) => {
      if (item.source === 'new') {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  });
};

export const SellerProductModal = ({ product, onClose, onSubmit }: SellerProductModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [categories, setCategories] = useState<{ id: string; title: string }[]>([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [activeVariantId, setActiveVariantId] = useState('');

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    formState: { errors }
  } = useForm<ProductFormValues>({ resolver: zodResolver(productSchema) });

  useModalFocus(true, onClose, modalRef);

  const activeVariant = useMemo(
    () => variantDrafts.find((variant) => variant.id === activeVariantId) ?? null,
    [variantDrafts, activeVariantId]
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
      size: '',
      otherAttribute: '',
      form: initialForm,
      mediaItems: createExistingMediaItems(product)
    };

    setVariantDrafts((prev) => {
      revokeNewMediaUrls(prev);
      return [initialDraft];
    });
    setActiveVariantId(initialDraft.id);
    setFileErrors([]);
    setUploadError('');
    reset(initialForm);
  }, [product, reset]);

  useEffect(() => {
    let isMounted = true;
    api
      .getReferenceCategories()
      .then((response) => {
        if (!isMounted) return;
        setCategories(response.data.map((item) => ({ id: item.id, title: item.title })));
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
    const subscription = watch((values) => {
      if (!activeVariantId) return;
      setVariantDrafts((prev) =>
        prev.map((variant) =>
          variant.id === activeVariantId
            ? {
                ...variant,
                form: {
                  ...variant.form,
                  ...values,
                }
              }
            : variant
        )
      );
    });

    return () => subscription.unsubscribe();
  }, [watch, activeVariantId]);

  useEffect(() => {
    if (!activeVariant) return;
    reset(activeVariant.form);
  }, [activeVariant, reset]);

  useEffect(() => {
    return () => {
      revokeNewMediaUrls(variantDrafts);
    };
  }, [variantDrafts]);

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

  const addVariant = () => {
    const currentValues = getValues();
    const source = activeVariant ?? variantDrafts[0];
    if (!source) return;

    const sourceWithCurrent: VariantDraft = {
      ...source,
      form: {
        ...source.form,
        ...currentValues
      }
    };

    const nextVariant = createVariantFromCurrent(sourceWithCurrent, variantDrafts.length + 1);

    setVariantDrafts((prev) => [...prev, nextVariant]);
    setActiveVariantId(nextVariant.id);
    reset(nextVariant.form);
    setUploadError('');
    setFileErrors([]);
  };

  const removeVariant = (variantId: string) => {
    setVariantDrafts((prev) => {
      const target = prev.find((variant) => variant.id === variantId);
      if (!target || target.isBase) return prev;
      target.mediaItems.forEach((item) => {
        if (item.source === 'new') {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      const next = prev.filter((variant) => variant.id !== variantId).map((variant, index) => ({
        ...variant,
        order: index + 1,
        name: variant.isBase ? 'Базовый товар' : `Вариант ${index + 1}`
      }));
      const fallback = next[0];
      if (fallback) {
        setActiveVariantId(fallback.id);
        reset(fallback.form);
      }
      return next;
    });
  };

  const switchVariant = (variantId: string) => {
    const next = variantDrafts.find((variant) => variant.id === variantId);
    if (!next) return;
    setActiveVariantId(variantId);
    reset(next.form);
    setUploadError('');
    setFileErrors([]);
  };

  const handleFormSubmit = async (values: ProductFormValues) => {
    if (!activeVariant) return;
    setUploadError('');

    const currentMediaItems = activeVariant.mediaItems;
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

    const variantsDraft: SellerProductVariantDraft[] = variantDrafts.map((variant, index) => {
      const knownMedia = variant.mediaItems
        .map((item) => (item.source === 'existing' ? { kind: item.kind, url: item.remoteUrl ?? item.previewUrl } : null))
        .filter((item): item is { kind: ProductMediaKind; url: string } => Boolean(item));

      return {
        id: variant.id,
        name: variant.name,
        order: index + 1,
        isBase: variant.isBase,
        fields: variant.form,
        attributes: {
          color: normalizeProductColor(variant.form.color),
          size: variant.size || undefined,
          other: variant.otherAttribute || undefined,
        },
        media: {
          imageUrls: knownMedia.filter((item) => item.kind === 'image').map((item) => item.url),
          videoUrls: knownMedia.filter((item) => item.kind === 'video').map((item) => item.url),
          pendingLocalFiles: variant.mediaItems.filter((item) => item.source === 'new').map((item) => item.name)
        }
      };
    });

    const payload: SellerProductPayload = {
      id: product?.id,
      title: values.title,
      price: values.price,
      material: values.material,
      category: values.category,
      technology: values.technology,
      productionTimeHours: values.productionTimeHours,
      color: normalizeProductColor(values.color),
      description: values.description,
      imageUrls,
      videoUrls,
      weightGrossG: values.weightGrossG,
      dxCm: values.dxCm,
      dyCm: values.dyCm,
      dzCm: values.dzCm,
      variantsDraft,
    };

    await onSubmit(payload);
    onClose();
  };

  const activeMediaItems = activeVariant?.mediaItems ?? [];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={styles.modal}
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h3>{product ? 'Редактировать товар' : 'Добавить товар'}</h3>
          <button className={styles.close} onClick={onClose} aria-label="Закрыть форму" type="button">
            ✕
          </button>
        </div>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Объединение вариантов на одной карточке</h4>
          <p className={styles.muted}>
            Если товар выпускается в разных вариантах, например по цвету или размеру, объедините их в одну карточку.
            Это позволит покупателю переключаться между вариантами внутри одной страницы товара.
          </p>
          <p className={styles.warningText}>
            На текущем этапе backend не сохраняет variants: отправляется только активный вариант,
            а структура вариантов хранится как интеграционный контракт на frontend.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.variantHeaderRow}>
            <h4 className={styles.sectionTitle}>Варианты товара</h4>
            <Button type="button" variant="secondary" onClick={addVariant}>
              Добавить вариант
            </Button>
          </div>
          <div className={styles.variantsList}>
            {variantDrafts.map((variant) => (
              <div key={variant.id} className={`${styles.variantCard} ${variant.id === activeVariantId ? styles.variantCardActive : ''}`}>
                <button type="button" className={styles.variantSwitch} onClick={() => switchVariant(variant.id)}>
                  <span className={styles.variantName}>{variant.name}</span>
                  <span className={styles.muted}>Цвет: {normalizeProductColor(variant.form.color)}</span>
                </button>
                {!variant.isBase ? (
                  <button type="button" className={styles.removeFile} onClick={() => removeVariant(variant.id)}>
                    Удалить
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <form className={styles.form} onSubmit={handleSubmit(handleFormSubmit)}>
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Главное о товаре</h4>
            <label>
              Название
              <input className={errors.title ? styles.inputError : styles.input} placeholder="Название товара" {...register('title')} />
              {errors.title && <span className={styles.errorText}>{errors.title.message}</span>}
            </label>
            <label>
              Краткое описание
              <input className={errors.material ? styles.inputError : styles.input} placeholder="Материал / ключевая особенность" {...register('material')} />
              {errors.material && <span className={styles.errorText}>{errors.material.message}</span>}
            </label>
            <label>
              Полное описание
              <textarea
                rows={4}
                className={errors.description ? styles.inputError : styles.input}
                placeholder="Расскажите о товаре"
                {...register('description')}
              />
              {errors.description && <span className={styles.errorText}>{errors.description.message}</span>}
            </label>
            <label>
              Категория
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
                Технология
                <input className={errors.technology ? styles.inputError : styles.input} placeholder="FDM" {...register('technology')} />
                {errors.technology && <span className={styles.errorText}>{errors.technology.message}</span>}
              </label>
              <label>
                Срок изготовления (часы)
                <input type="number" min={1} max={720} className={errors.productionTimeHours ? styles.inputError : styles.input} placeholder="24" {...register('productionTimeHours', { valueAsNumber: true })} />
                {errors.productionTimeHours && <span className={styles.errorText}>{errors.productionTimeHours.message}</span>}
              </label>
              <label>
                Цена
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className={errors.price ? styles.inputError : styles.input}
                  placeholder="Например, 1200"
                  {...register('price', { valueAsNumber: true })}
                />
                {errors.price && <span className={styles.errorText}>{errors.price.message}</span>}
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Особенности варианта</h4>
            <div className={styles.inlineFields}>
              <label>
                Цвет товара
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
              <label>
                Размер (опционально)
                <input
                  className={styles.input}
                  value={activeVariant?.size ?? ''}
                  onChange={(event) => updateActiveVariant((variant) => ({ ...variant, size: event.target.value }))}
                  placeholder="Например, M / 42"
                />
              </label>
              <label>
                Другое отличие (опционально)
                <input
                  className={styles.input}
                  value={activeVariant?.otherAttribute ?? ''}
                  onChange={(event) => updateActiveVariant((variant) => ({ ...variant, otherAttribute: event.target.value }))}
                  placeholder="Например, матовый / глянец"
                />
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
                Длина (см)
                <input type="number" min={1} className={errors.dxCm ? styles.inputError : styles.input} {...register('dxCm', { setValueAs: (value) => (value === '' ? undefined : Number(value)) })} />
                {errors.dxCm && <span className={styles.errorText}>{errors.dxCm.message}</span>}
              </label>
              <label>
                Ширина (см)
                <input type="number" min={1} className={errors.dyCm ? styles.inputError : styles.input} {...register('dyCm', { setValueAs: (value) => (value === '' ? undefined : Number(value)) })} />
                {errors.dyCm && <span className={styles.errorText}>{errors.dyCm.message}</span>}
              </label>
              <label>
                Высота (см)
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
              return <p className={styles.muted}>Размер: {dx}×{dy}×{dz} см{weight ? `, вес: ${weight} г` : ''}</p>;
            })()}
          </section>

          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Изображения и видео варианта</h4>
            <p className={styles.muted}>Поддержка: JPG, PNG, WEBP, HEIC/HEIF, MP4, MOV/QuickTime, WEBM. Лимиты: изображение до {formatSize(IMAGE_MAX_SIZE_BYTES)}, видео до {formatSize(VIDEO_MAX_SIZE_BYTES)} и до {VIDEO_MAX_DURATION_SECONDS} сек.</p>
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
                    {item.kind === 'image' ? (
                      <img src={item.previewUrl} alt={item.name} className={styles.filePreview} />
                    ) : (
                      <video src={item.previewUrl} className={styles.filePreview} muted playsInline preload="metadata" />
                    )}
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
    </div>
  );
};
