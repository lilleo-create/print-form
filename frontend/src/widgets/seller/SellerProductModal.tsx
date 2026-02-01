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
  price: z.coerce.number().min(1, 'Введите цену'),
  material: z.string().min(2, 'Введите материал'),
  category: z.string().min(2, 'Введите категорию'),
  size: z.string().min(2, 'Введите размер'),
  technology: z.string().min(2, 'Введите технологию'),
  printTime: z.string().min(2, 'Введите время печати'),
  color: z.string().min(2, 'Введите цвет'),
  description: z.string().min(10, 'Добавьте описание'),
  deliveryDateEstimated: z.string().optional(),
  deliveryDates: z.string().optional()
});

type ProductFormValues = z.infer<typeof productSchema>;

export interface SellerProductPayload {
  id?: string;
  title: string;
  price: number;
  material: string;
  category: string;
  size: string;
  technology: string;
  printTime: string;
  color: string;
  description: string;
  imageUrls: string[];
  videoUrls: string[];
  deliveryDateEstimated?: string;
  deliveryDates?: string[];
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
  const {
    register,
    handleSubmit,
    reset,
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
        size: product.size,
        technology: product.technology,
        printTime: product.printTime,
        color: product.color,
        description: product.description,
        deliveryDateEstimated: product.deliveryDateEstimated?.slice(0, 10) ?? '',
        deliveryDates: product.deliveryDates?.join(', ') ?? ''
      });
    } else {
      reset({
        title: '',
        price: 0,
        material: '',
        category: '',
        size: '',
        technology: '',
        printTime: '',
        color: '',
        description: '',
        deliveryDateEstimated: '',
        deliveryDates: ''
      });
    }
  }, [product, reset]);

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
        const response = await api.uploadSellerImages(files);
        const uploadedImageUrls: string[] = [];
        const uploadedVideoUrls: string[] = [];
        response.data.urls.forEach((url, index) => {
          const file = files[index];
          if (!file) {
            return;
          }
          if (isVideoFile(file)) {
            uploadedVideoUrls.push(url);
          } else {
            uploadedImageUrls.push(url);
          }
        });
        imageUrls = uploadedImageUrls.length ? uploadedImageUrls : existingImageUrls;
        videoUrls = uploadedVideoUrls.length ? uploadedVideoUrls : existingVideoUrls;
      } catch (error) {
        setUploadError('Не удалось загрузить файлы. Попробуйте снова.');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    if (imageUrls.length === 0) {
      setUploadError('Добавьте хотя бы одно изображение.');
      return;
    }

    const deliveryDates = values.deliveryDates
      ? values.deliveryDates
          .split(',')
          .map((date) => date.trim())
          .filter(Boolean)
      : [];

    const payload: SellerProductPayload = {
      id: product?.id,
      title: values.title,
      price: values.price,
      material: values.material,
      category: values.category,
      size: values.size,
      technology: values.technology,
      printTime: values.printTime,
      color: values.color,
      description: values.description,
      imageUrls,
      videoUrls,
      deliveryDateEstimated: values.deliveryDateEstimated ? new Date(values.deliveryDateEstimated).toISOString() : undefined,
      deliveryDates
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
            <input {...register('title')} />
            {errors.title && <span>{errors.title.message}</span>}
          </label>
          <label>
            Цена
            <input type="number" {...register('price')} />
            {errors.price && <span>{errors.price.message}</span>}
          </label>
          <label>
            Материал
            <input {...register('material')} />
            {errors.material && <span>{errors.material.message}</span>}
          </label>
          <label>
            Категория
            <input {...register('category')} />
            {errors.category && <span>{errors.category.message}</span>}
          </label>
          <label>
            Размер
            <input {...register('size')} />
            {errors.size && <span>{errors.size.message}</span>}
          </label>
          <label>
            Технология
            <input {...register('technology')} />
            {errors.technology && <span>{errors.technology.message}</span>}
          </label>
          <label>
            Время печати
            <input {...register('printTime')} />
            {errors.printTime && <span>{errors.printTime.message}</span>}
          </label>
          <label>
            Цвет
            <input {...register('color')} />
            {errors.color && <span>{errors.color.message}</span>}
          </label>
          <label>
            Описание
            <textarea rows={4} {...register('description')} />
            {errors.description && <span>{errors.description.message}</span>}
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
            {uploadError && <span>{uploadError}</span>}
          </label>
          <label>
            Ближайшая дата доставки
            <input type="date" {...register('deliveryDateEstimated')} />
          </label>
          <label>
            Даты доставки (через запятую)
            <input {...register('deliveryDates')} placeholder="2024-10-01, 2024-10-03" />
          </label>
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
