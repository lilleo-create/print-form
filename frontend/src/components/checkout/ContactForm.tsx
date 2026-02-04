import type { UseFormReturn } from 'react-hook-form';
import type { ContactFormValues } from './types';
import styles from '../../pages/CheckoutPage.module.css';
type ContactFormProps = {
  form: UseFormReturn<ContactFormValues>;
  disabled?: boolean;
};
import { formatRuPhoneInput } from '../../shared/lib/validation';


export const ContactForm = ({ form, disabled }: ContactFormProps) => {
  const { register, formState } = form;

  return (
    <>
      <label className={styles.label}>
        Имя
        <input {...register('name')} disabled={disabled} autoComplete="name" />
        {formState.errors.name && (
          <span className={styles.error}>{formState.errors.name.message}</span>
        )}
      </label>

      <label className={styles.label}>
        Телефон
        <input
          {...form.register('phone', {
            onChange: (e) => {
              e.target.value = formatRuPhoneInput(e.target.value);
            }
          })}
          inputMode="tel"
          autoComplete="tel"
          disabled={disabled}
        />
        {formState.errors.phone && (
          <span className={styles.error}>{formState.errors.phone.message}</span>
        )}
      </label>

      <label className={styles.label}>
        Email
        <input
          {...register('email')}
          disabled={disabled}
          autoComplete="email"
          inputMode="email"
        />
        {formState.errors.email && (
          <span className={styles.error}>{formState.errors.email.message}</span>
        )}
      </label>
    </>
  );
};
