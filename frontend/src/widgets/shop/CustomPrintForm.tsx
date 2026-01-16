import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../shared/api';
import { Button } from '../../shared/ui/Button';
import styles from './CustomPrintForm.module.css';

const customSchema = z.object({
  name: z.string().min(2, 'Введите имя'),
  contact: z.string().min(3, 'Введите контакт'),
  comment: z.string().min(5, 'Опишите задачу')
});

type CustomFormValues = z.infer<typeof customSchema>;

export const CustomPrintForm = () => {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CustomFormValues>({ resolver: zodResolver(customSchema) });

  const onSubmit = async (values: CustomFormValues) => {
    setSubmitted(false);
    setSubmitError('');
    try {
      await api.sendCustomRequest(values);
      setSubmitted(true);
      reset();
    } catch {
      setSubmitError('Не удалось отправить заявку. Попробуйте еще раз позже.');
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <h3>Запрос на кастомную печать</h3>
      <input placeholder="Имя" disabled={isSubmitting} {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      <input placeholder="Телефон или email" disabled={isSubmitting} {...register('contact')} />
      {errors.contact && <span>{errors.contact.message}</span>}
      <textarea placeholder="Комментарий" rows={4} disabled={isSubmitting} {...register('comment')} />
      {errors.comment && <span>{errors.comment.message}</span>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Отправляем...' : 'Отправить заявку'}
      </Button>
      {submitError && (
        <p className={styles.error} role="alert">
          {submitError}
        </p>
      )}
      {submitted && (
        <p className={styles.success} role="status">
          Заявка отправлена, мы свяжемся с вами.
        </p>
      )}
    </form>
  );
};
