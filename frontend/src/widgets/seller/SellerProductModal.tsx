import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Product } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import { api } from '../../shared/api';
import styles from './SellerProductModal.module.css';

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
  color: z.string().min(2, 'Введите цвет'),
  description: z.string().min(10, 'Добавьте описание'),
  weightGrossG: z.number().int().positive('Укажите вес (г)').optional(),
  dxCm: z.number().int().positive('Укажите длину (см)').optional(),
  dyCm: z.number().int().positive('Укажите ширину (см)').optional(),
  dzCm: z.number().int().positive('Укажите высоту (см)').optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

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
}

interface SellerProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSubmit: (payload: SellerProductPayload) => Promise<void>;
}

export const SellerProductModal = ({ product, onClose, onSubmit }: SellerProductModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [categories, setCategories] = useState<{ id: string; title: string }[]>([]);
  const [categoriesError, setCategoriesError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<ProductFormValues>({ resolver: zodResolver(productSchema) });

  useModalFocus(true, onClose, modalRef);

  const isImageFile = (file: File) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  const isVideoFile = (file: File) => ['video/mp4', 'video/webm'].includes(file.type);

  useEffect(() => {
    setFiles([]);
    setFileErrors([]);
    setUploadError('');
    if (product) {
      reset({
        title: product.title,
        price: product.price,
        material: product.material,
        category: product.category,
        technology: product.technology,
        productionTimeHours: product.productionTimeHours ?? 24,
        color: product.color,
        description: product.description,
        weightGrossG: product.weightGrossG ?? undefined,
        dxCm: product.dxCm ?? undefined,
        dyCm: product.dyCm ?? undefined,
        dzCm: product.dzCm ?? undefined,
      });
    } else {
      reset({
        title: '',
        price: 0,
        material: '',
        category: '',
        technology: '',
        productionTimeHours: 24,
        color: '',
        description: '',
        weightGrossG: undefined,
        dxCm: undefined,
        dyCm: undefined,
        dzCm: undefined,
      });
    }
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

  const handleIncomingFiles = (incoming: FileList | File[]) => {
    const nextErrors: string[] = [];
    const nextFiles: File[] = [];

    Array.from(incoming).forEach((file) => {
      const isImage = isImageFile(file);
      const isVideo = isVideoFile(file);

      if (!isImage && !isVideo) {
        nextErrors.push(`Файл ${file.name}: неподдерживаемый формат.`);
        return;
      }

      if (isImage && file.size > 10 * 1024 * 1024) {
        nextErrors.push(`Файл ${file.name}: изображение больше 10 МБ.`);
        return;
      }

      if (isVideo && file.size > 100 * 1024 * 1024) {
        nextErrors.push(`Файл ${file.name}: видео больше 100 МБ.`);
        return;
      }

      nextFiles.push(file);
    });

    setUploadError('');
    setFileErrors(nextErrors);
    if (nextFiles.length) {
      setFiles((prev) => [...prev, ...nextFiles]);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (event.dataTransfer.files?.length) {
      handleIncomingFiles(event.dataTransfer.files);
    }
  };

  const handleFormSubmit = async (values: ProductFormValues) => {
    setUploadError('');
    const existingImageUrls =
      product?.images?.map((image) => image.url) ?? (product?.image ? [product.image] : []);
    const existingVideoUrls = product?.videoUrls ?? [];
    let imageUrls = existingImageUrls;
    let videoUrls = existingVideoUrls;

    if (files.length > 0) {
      setIsUploading(true);
      try {
        const result = await api.uploadSellerImages(files);
        const urls = result.data.urls;

        const uploadedImageUrls: string[] = [];
        const uploadedVideoUrls: string[] = [];

        urls.forEach((url, index) => {
          const file = files[index];
          if (!file) return;
          if (isVideoFile(file)) uploadedVideoUrls.push(url);
          else uploadedImageUrls.push(url);
        });

        imageUrls = uploadedImageUrls.length ? [...existingImageUrls, ...uploadedImageUrls] : existingImageUrls;
        videoUrls = uploadedVideoUrls.length ? [...existingVideoUrls, ...uploadedVideoUrls] : existingVideoUrls;
      } catch (_error) {
        setUploadError('Не удалось загрузить файлы. Попробуйте снова.');
        return;
      } finally {
        setIsUploading(false);
      }
    }


    if (imageUrls.length === 0) {
      setUploadError('Добавьте хотя бы одно изображение.');
      return;
    }

    const payload: SellerProductPayload = {
      id: product?.id,
      title: values.title,
      price: values.price,
      material: values.material,
      category: values.category,
      technology: values.technology,
      productionTimeHours: values.productionTimeHours,
      color: values.color,
      description: values.description,
      imageUrls,
      videoUrls,
      weightGrossG: values.weightGrossG,
      dxCm: values.dxCm,
      dyCm: values.dyCm,
      dzCm: values.dzCm,
    };

    await onSubmit(payload);
    onClose();
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={styles.modal}
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h3>{product ? 'Редактировать товар' : 'Добавить товар'}</h3>
          <button className={styles.close} onClick={onClose} aria-label="Закрыть форму">
            ✕
          </button>
        </div>
        <form className={styles.form} onSubmit={handleSubmit(handleFormSubmit)}>
          <label>
            Название
            <input className={errors.title ? styles.inputError : styles.input} placeholder="Название товара" {...register('title')} />
            {errors.title && <span className={styles.errorText}>{errors.title.message}</span>}
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
          <label>
            Материал
            <input className={errors.material ? styles.inputError : styles.input} placeholder="PLA" {...register('material')} />
            {errors.material && <span className={styles.errorText}>{errors.material.message}</span>}
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
          <label>
            Технология
            <input className={errors.technology ? styles.inputError : styles.input} placeholder="FDM" {...register('technology')} />
            {errors.technology && <span className={styles.errorText}>{errors.technology.message}</span>}
          </label>
          <label>
            Время изготовления (часы)
            <input type="number" min={1} max={720} className={errors.productionTimeHours ? styles.inputError : styles.input} placeholder="24" {...register('productionTimeHours', { valueAsNumber: true })} />
            {errors.productionTimeHours && <span className={styles.errorText}>{errors.productionTimeHours.message}</span>}
          </label>
          <label>
            Цвет
            <input className={errors.color ? styles.inputError : styles.input} placeholder="Белый" {...register('color')} />
            {errors.color && <span className={styles.errorText}>{errors.color.message}</span>}
          </label>
          <label>
            Описание
            <textarea
              rows={4}
              className={errors.description ? styles.inputError : styles.input}
              placeholder="Расскажите о товаре"
              {...register('description')}
            />
            {errors.description && <span className={styles.errorText}>{errors.description.message}</span>}
          </label>

          <div>
            <h4>Характеристики</h4>
          </div>
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
          <label>
            Медиа товара
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
                accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
                multiple
                className={styles.fileInput}
                onChange={(event) => {
                  if (event.target.files?.length) {
                    handleIncomingFiles(event.target.files);
                  }
                  event.target.value = '';
                }}
              />
              <div className={styles.dropzoneContent}>
                <span className={styles.dropzoneIcon}>⬆️</span>
                <div>
                  <p>Загрузка файлов</p>
                  <p className={styles.dropzoneHint}>Перетащите файлы сюда или нажмите для выбора</p>
                </div>
              </div>
            </div>
            {files.length > 0 && (
              <div className={styles.fileList}>
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className={styles.fileItem}>
                    {isImageFile(file) ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className={styles.filePreview}
                        onLoad={(event) => URL.revokeObjectURL((event.target as HTMLImageElement).src)}
                      />
                    ) : (
                      <span className={styles.videoIcon}>▶</span>
                    )}
                    <span className={styles.fileName}>{file.name}</span>
                    <button
                      type="button"
                      className={styles.removeFile}
                      onClick={() => setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      Удалить
                    </button>
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
          </label>

          {(() => {
            const dx = watch('dxCm');
            const dy = watch('dyCm');
            const dz = watch('dzCm');
            const weight = watch('weightGrossG');
            if (!dx || !dy || !dz) return null;
            return <p className={styles.muted}>Размер: {dx}×{dy}×{dz} см{weight ? `, вес: ${weight} г` : ''}</p>;
          })()}
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
