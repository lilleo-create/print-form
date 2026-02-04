import type { UseFormReturn } from 'react-hook-form';
import { Button } from '../../shared/ui/Button';
import type { ContactFormValues } from './types';
import styles from '../../pages/CheckoutPage.module.css';

type ContactFormProps = {
  form: UseFormReturn<ContactFormValues>;
  onSave: (values: ContactFormValues) => void;
  saveToProfile: boolean;
  onToggleSaveToProfile: (next: boolean) => void;
};

export const ContactForm = ({
  form,
  onSave,
  saveToProfile,
  onToggleSaveToProfile
}: ContactFormProps) => (
  <form className={styles.form} onSubmit={form.handleSubmit(onSave)}>
    <h3>Контактные данные</h3>
    <label>
      Имя
      <input {...form.register('name')} />
      {form.formState.errors.name && <span>{form.formState.errors.name.message}</span>}
    </label>
    <label>
      Телефон
      <input {...form.register('phone')} />
      {form.formState.errors.phone && <span>{form.formState.errors.phone.message}</span>}
    </label>
    <label>
      Email (опционально)
      <input {...form.register('email')} />
      {form.formState.errors.email && <span>{form.formState.errors.email.message}</span>}
    </label>
    <Button type="submit">Сохранить контакт</Button>
    <label className={styles.saveProfile}>
      <input
        type="checkbox"
        checked={saveToProfile}
        onChange={(event) => onToggleSaveToProfile(event.target.checked)}
      />
      Сохранить в профиль
    </label>
  </form>
);
