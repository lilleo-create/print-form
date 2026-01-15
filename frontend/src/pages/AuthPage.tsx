import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../shared/api';
import { Button } from '../shared/ui/Button';
import styles from './AuthPage.module.css';

const loginSchema = z.object({
  email: z.string().email('Введите email'),
  password: z.string().min(6, 'Минимум 6 символов')
});

const registerSchema = loginSchema.extend({
  name: z.string().min(2, 'Введите имя')
});

type LoginValues = z.infer<typeof loginSchema>;

type RegisterValues = z.infer<typeof registerSchema>;

export const AuthPage = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState('');

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onLogin = async (values: LoginValues) => {
    await api.login(values);
    setMessage('Добро пожаловать!');
  };

  const onRegister = async (values: RegisterValues) => {
    await api.register(values);
    setMessage('Регистрация завершена!');
  };

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <h1>{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className={styles.form}>
            <input placeholder="Email" {...loginForm.register('email')} />
            {loginForm.formState.errors.email && (
              <span>{loginForm.formState.errors.email.message}</span>
            )}
            <input type="password" placeholder="Пароль" {...loginForm.register('password')} />
            {loginForm.formState.errors.password && (
              <span>{loginForm.formState.errors.password.message}</span>
            )}
            <Button type="submit">Войти</Button>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(onRegister)} className={styles.form}>
            <input placeholder="Имя" {...registerForm.register('name')} />
            {registerForm.formState.errors.name && (
              <span>{registerForm.formState.errors.name.message}</span>
            )}
            <input placeholder="Email" {...registerForm.register('email')} />
            {registerForm.formState.errors.email && (
              <span>{registerForm.formState.errors.email.message}</span>
            )}
            <input type="password" placeholder="Пароль" {...registerForm.register('password')} />
            {registerForm.formState.errors.password && (
              <span>{registerForm.formState.errors.password.message}</span>
            )}
            <Button type="submit">Создать аккаунт</Button>
          </form>
        )}
        {message && <p className={styles.success}>{message}</p>}
        <button
          className={styles.switch}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setMessage('');
          }}
        >
          {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </section>
  );
};
