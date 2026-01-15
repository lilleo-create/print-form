import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../shared/ui/Button';
import { useAuthStore } from '../app/store/authStore';
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
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onLogin = async (values: LoginValues) => {
    setError('');
    try {
      await login(values.email, values.password);
      setMessage('Добро пожаловать!');
    } catch {
      setError('Неверный email или пароль. Попробуйте снова.');
    }
  };

  const onRegister = async (values: RegisterValues) => {
    setError('');
    try {
      await register({ name: values.name, email: values.email, password: values.password });
      setMessage('Регистрация завершена!');
    } catch {
      setError('Пользователь с таким email уже существует.');
    }
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
        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.success}>{message}</p>}
        <button
          className={styles.switch}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setMessage('');
            setError('');
          }}
        >
          {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
        <div className={styles.hint}>
          <p>Тестовые аккаунты:</p>
          <p>buyer@3dmarket.ru / password123</p>
          <p>seller@3dmarket.ru / password123</p>
        </div>
      </div>
    </section>
  );
};
