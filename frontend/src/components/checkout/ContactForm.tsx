import type { UseFormReturn } from 'react-hook-form';
import type { ContactFormValues } from './types';
import { Input } from '../../shared/ui/Input';

type ContactFormProps = {
  form: UseFormReturn<ContactFormValues>;
  disabled?: boolean;
};

export const ContactForm = ({ form, disabled }: ContactFormProps) => {
  const { register, formState: { errors } } = form;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Input
        label="Имя и фамилия"
        disabled={disabled}
        {...register('name', { required: 'Укажите имя' })}
        error={errors.name?.message}
      />
      <Input
        label="Телефон"
        type="tel"
        disabled={disabled}
        {...register('phone', { required: 'Укажите телефон' })}
        error={errors.phone?.message}
      />
      <Input
        label="Email"
        type="email"
        disabled={disabled}
        {...register('email')}
        error={errors.email?.message}
      />
    </div>
  );
};
