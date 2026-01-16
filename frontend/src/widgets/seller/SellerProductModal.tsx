import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Product } from '../../shared/types';
import { Button } from '../../shared/ui/Button';
import { useModalFocus } from '../../shared/lib/useModalFocus';
import styles from './SellerProductModal.module.css';

const productSchema = z.object({
  title: z.string().min(2, 'Введите название'),
  price: z.coerce.number().min(1, 'Введите цену'),
  material: z.string().min(2, 'Введите материал'),
  category: z.string().min(2, 'Введите категорию'),
  size: z.string().min(2, 'Введите размер'),
  images: z.string().min(5, 'Добавьте ссылку на изображение')
});

type ProductFormValues = z.infer<typeof productSchema>;

interface SellerProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSubmit: (payload: Product) => Promise<void>;
}

export const SellerProductModal = ({ product, onClose, onSubmit }: SellerProductModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ProductFormValues>({ resolver: zodResolver(productSchema) });

  useModalFocus(true, onClose, modalRef);

  useEffect(() => {
    if (product) {
      reset({
        title: product.title,
        price: product.price,
        material: product.material,
        category: product.category,
        size: product.size,
        images: product.image
      });
    } else {
      reset({
        title: '',
        price: 0,
        material: '',
        category: '',
        size: '',
        images: ''
      });
    }
  }, [product, reset]);

  const handleFormSubmit = async (values: ProductFormValues) => {
    const imageUrl = values.images.split(',')[0].trim();
    const nextProduct: Product = {
      id: product?.id ?? `prod-${Date.now()}`,
      title: values.title,
      price: values.price,
      material: values.material as Product['material'],
      category: values.category,
      size: values.size,
      image: imageUrl,
      description: product?.description ?? 'Кастомный товар от продавца.',
      technology: product?.technology ?? 'FDM',
      printTime: product?.printTime ?? '8 часов',
      color: product?.color ?? 'Черный'
    };

    await onSubmit(nextProduct);
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
            Изображения (URL через запятую)
            <input {...register('images')} />
            {errors.images && <span>{errors.images.message}</span>}
          </label>
          <div className={styles.actions}>
            <Button type="submit">Сохранить</Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
