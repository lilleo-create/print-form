import { useEffect, useRef, useState } from 'react';
import { paymentSecondsRemaining } from '../../shared/lib/paymentLifecycle';

type Props = { paymentExpiresAt?: string | null; onExpire?: () => void };

export const PaymentCountdown = ({ paymentExpiresAt, onExpire }: Props) => {
  const [remaining, setRemaining] = useState(() => paymentSecondsRemaining(paymentExpiresAt));
  const onExpireRef = useRef(onExpire);
  const notifiedRef = useRef(false);
  onExpireRef.current = onExpire;

  useEffect(() => {
    notifiedRef.current = false;
    const tick = () => {
      const seconds = paymentSecondsRemaining(paymentExpiresAt);
      setRemaining(seconds);
      if (seconds === 0 && !notifiedRef.current) {
        notifiedRef.current = true;
        onExpireRef.current?.();
      }
      return seconds;
    };
    if (tick() === 0) return;
    const timer = window.setInterval(() => { if (tick() === 0) window.clearInterval(timer); }, 1000);
    return () => window.clearInterval(timer);
  }, [paymentExpiresAt]);

  if (remaining === null) return null;
  if (remaining === 0) return <span role="timer">Время на оплату истекло</span>;
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  return <span role="timer">Осталось на оплату {minutes}:{seconds}</span>;
};
