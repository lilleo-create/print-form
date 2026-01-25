import { useEffect, useState } from 'react';
import { useAuthStore } from '../app/store/authStore';
import { api } from '../shared/api';
import { Review } from '../shared/types';
import { Rating } from '../shared/ui/Rating';
import { Button } from '../shared/ui/Button';
import { useForm } from 'react-hook-form';
import styles from './BuyerAccountPage.module.css';

const formatReviewDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

export const BuyerAccountPage = () => {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const contactForm = useForm<{ name: string; phone: string; email: string }>({
    defaultValues: {
      name: user?.name ?? '',
      phone: user?.phone ?? '',
      email: user?.email ?? ''
    }
  });
  const [formValues, setFormValues] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? ''
  });

  useEffect(() => {
    if (!user) return;
    setFormValues({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? ''
    });
    contactForm.reset({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? ''
    });
  }, [contactForm, user]);

  useEffect(() => {
    api.getMyReviews().then((response) => {
      setReviews(response.data.data);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name: formValues.name,
        email: formValues.email,
        phone: formValues.phone
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleVisibilityToggle = async (reviewId: string, hideFromOthers: boolean) => {
    const nextIsPublic = !hideFromOthers;
    const response = await api.updateReviewVisibility(reviewId, nextIsPublic);
    setReviews((prev) =>
      prev.map((review) => (review.id === reviewId ? { ...review, ...response.data.data } : review))
    );
  };

  const handleSaveContact = async (values: { name: string; phone: string; email: string }) => {
    await updateProfile({
      name: values.name,
      email: values.email,
      phone: values.phone
    });
  };

  return (
    <section className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1>Личный кабинет</h1>
          <p>Управляйте личными данными и отзывами.</p>
        </div>

        <div className={styles.profileGrid}>
          <div className={styles.profileBox}>
            <h3>Профиль</h3>
            <div className={styles.profileList}>
              <div>
                <span>Имя</span>
                <strong>{user?.name ?? '—'}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{user?.email ?? '—'}</strong>
              </div>
              <div>
                <span>Телефон</span>
                <strong>{user?.phone ?? '—'}</strong>
              </div>
              <div>
                <span>Адрес</span>
                <strong>{user?.address ?? '—'}</strong>
              </div>
            </div>
          </div>
          <form className={styles.profileBox} onSubmit={contactForm.handleSubmit(handleSaveContact)}>
            <h3>Личные данные</h3>
            <label>
              Имя
              <input {...contactForm.register('name')} />
              {contactForm.formState.errors.name && (
                <span>{contactForm.formState.errors.name.message}</span>
              )}
            </label>
            <label>
              Телефон
              <input {...contactForm.register('phone')} />
              {contactForm.formState.errors.phone && (
                <span>{contactForm.formState.errors.phone.message}</span>
              )}
            </label>
            <label>
              Email
              <input {...contactForm.register('email')} />
              {contactForm.formState.errors.email && (
                <span>{contactForm.formState.errors.email.message}</span>
              )}
            </label>
            <Button type="submit">Сохранить</Button>
          </form>

          <div className={styles.profileBox}>
            <div className={styles.addressHeader}>
              <h3>Адреса доставки</h3>
            </div>
            {isEditing ? (
              <div className={styles.editGrid}>
                <label>
                  Имя
                  <input
                    value={formValues.name}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    value={formValues.email}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Телефон
                  <input
                    value={formValues.phone}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </label>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  Сохранить
                </Button>
              </div>
            ) : (
              <div className={styles.profileDetails}>
                <div>
                  <span>Имя</span>
                  <strong>{user?.name ?? '—'}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{user?.email ?? '—'}</strong>
                </div>
                <div>
                  <span>Телефон</span>
                  <strong>{user?.phone ?? '—'}</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.reviewsSection}>
          <h2>Мои отзывы</h2>
          {reviews.length === 0 ? (
            <p className={styles.empty}>Вы еще не оставляли отзывы.</p>
          ) : (
            <div className={styles.reviewList}>
              {reviews.map((review) => (
                <article key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    {review.product?.image && (
                      <img
                        src={review.product.image}
                        alt={review.product.title}
                        className={styles.reviewImage}
                      />
                    )}
                    <div>
                      <h3>{review.product?.title ?? 'Отзыв'}</h3>
                      <span className={styles.reviewDate}>{formatReviewDate(review.createdAt)}</span>
                    </div>
                    <div className={styles.reviewRating}>
                      <Rating value={review.rating} count={0} size="sm" />
                    </div>
                  </div>
                  <div className={styles.reviewBody}>
                    <p>
                      <strong>Достоинства:</strong> {review.pros}
                    </p>
                    <p>
                      <strong>Недостатки:</strong> {review.cons}
                    </p>
                    <p>
                      <strong>Комментарий:</strong> {review.comment}
                    </p>
                  </div>
                  <label className={styles.visibilityToggle}>
                    <input
                      type="checkbox"
                      checked={review.isPublic === false}
                      onChange={(event) => handleVisibilityToggle(review.id, event.target.checked)}
                    />
                    Скрыть от других
                  </label>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
