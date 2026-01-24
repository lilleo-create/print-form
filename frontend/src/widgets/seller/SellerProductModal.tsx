import { useEffect, useRef, useState } from 'react';
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
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ProductFormValues>({ resolver: zodResolver(productSchema) });

  useModalFocus(true, onClose, modalRef);

  useEffect(() => {
    setFiles(null);
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

  const handleFormSubmit = async (values: ProductFormValues) => {
    setUploadError('');
    const existingImageUrls =
      product?.images?.map((image) => image.url) ?? (product?.image ? [product.image] : []);
    let imageUrls = existingImageUrls;

    if (files && files.length > 0) {
      setIsUploading(true);
      try {
        const response = await api.uploadSellerImages(files);
        imageUrls = response.data.urls;
      } catch (error) {
        setUploadError('Не удалось загрузить изображения. Попробуйте снова.');
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
            Фото товара (файлы)
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setFiles(event.target.files)}
            />
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
