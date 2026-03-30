import { useEffect, useMemo, useState } from 'react';
import { getShortOrderId } from '../../shared/utils/orderId';
import styles from './CopyableOrderNumber.module.css';

type CopyableOrderNumberProps = {
  orderId: string;
  publicNumber?: string | null;
  className?: string;
};

const getFallbackCopy = async (value: string) => {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
};

export const CopyableOrderNumber = ({
  orderId,
  publicNumber,
  className
}: CopyableOrderNumberProps) => {
  const [copied, setCopied] = useState(false);

  const displayNumber = useMemo(() => {
    const normalized = publicNumber?.trim();
    return normalized && normalized.length > 0
      ? normalized
      : getShortOrderId(orderId);
  }, [orderId, publicNumber]);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(displayNumber);
      } else {
        await getFallbackCopy(displayNumber);
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`${styles.orderNumberButton} ${className ?? ''}`.trim()}
      title={displayNumber}
      aria-label={`Скопировать номер заказа ${displayNumber}`}
    >
      <span className={styles.orderNumberText}>{displayNumber}</span>
      <span aria-hidden="true" className={styles.copyIcon}>
        ⧉
      </span>
      {copied && <span className={styles.copyFeedback}>Скопировано</span>}
    </button>
  );
};
