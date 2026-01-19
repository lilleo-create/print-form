import { FieldErrors, UseFormRegister } from 'react-hook-form';
import { AddressFormValues } from './addressFormSchema';
import styles from './AddressModal.module.css';

type AddressFormProps = {
  register: UseFormRegister<AddressFormValues>;
  errors: FieldErrors<AddressFormValues>;
  isFavorite: boolean;
};

export const AddressForm = ({ register, errors, isFavorite }: AddressFormProps) => {
  return (
    <div className={styles.fields}>
      <label>
        Адрес
        <input {...register('addressText')} />
        {errors.addressText && <span>{errors.addressText.message}</span>}
      </label>
      <label>
        Квартира
        <input {...register('apartment')} />
      </label>
      <label>
        Этаж
        <input {...register('floor')} />
      </label>
      <label>
        Название адреса
        <input {...register('label')} />
        {errors.label && <span>{errors.label.message}</span>}
      </label>
      <label>
        Комментарий для курьера
        <input {...register('courierComment')} />
      </label>
      <label className={styles.favoriteToggle}>
        <input type="checkbox" {...register('isFavorite')} />
        В избранное
      </label>
      {!isFavorite && (
        <p className={styles.favoriteHint}>Название адреса необязательно без избранного.</p>
      )}
    </div>
  );
};
