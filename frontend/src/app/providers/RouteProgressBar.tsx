import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';
import styles from './RouteProgressBar.module.css';

const START_PROGRESS = 12;
const NEAR_COMPLETE_PROGRESS = 88;
const COMPLETE_PROGRESS = 100;

export const RouteProgressBar = () => {
  const location = useLocation();
  const previousKeyRef = useRef(location.key);
  const intervalRef = useRef<number | null>(null);

  const [isVisible, setVisible] = useState(false);
  const [isCompleting, setCompleting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (location.key === previousKeyRef.current) {
      return;
    }

    previousKeyRef.current = location.key;
    setVisible(true);
    setCompleting(false);
    setProgress(START_PROGRESS);

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    intervalRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= NEAR_COMPLETE_PROGRESS) {
          return current;
        }

        const step = Math.max(1.5, (NEAR_COMPLETE_PROGRESS - current) * 0.12);
        return Math.min(NEAR_COMPLETE_PROGRESS, current + step);
      });
    }, 90);

    const completeId = window.setTimeout(() => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCompleting(true);
      setProgress(COMPLETE_PROGRESS);
    }, 420);

    const hideId = window.setTimeout(() => {
      setVisible(false);
      setCompleting(false);
      setProgress(0);
    }, 760);

    return () => {
      window.clearTimeout(completeId);
      window.clearTimeout(hideId);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [location.key]);

  return (
    <div className={clsx(styles.track, isVisible && styles.visible)} aria-hidden="true">
      <div
        className={clsx(styles.bar, isCompleting && styles.completing)}
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
};
