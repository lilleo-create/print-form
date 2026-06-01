import styles from './HomeProductCard.module.css';

export const ProductCardSkeleton = () => (
  <article className={styles.skeleton} aria-hidden="true">
    <div className={styles.skeletonImg} />
    <div className={styles.skeletonBody}>
      {/* title — 2 lines */}
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLineShort} />
      {/* price */}
      <div className={styles.skeletonPrice} />
      {/* meta */}
      <div className={styles.skeletonLineShort} />
    </div>
  </article>
);
