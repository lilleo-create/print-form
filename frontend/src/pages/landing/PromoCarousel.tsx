import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import styles from './PromoCarousel.module.css';

type PromoSlide = {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  href: string;
  badge?: string;
};

const PROMO_SLIDES: PromoSlide[] = [
  {
    id: 'promo-1',
    title: 'Готовые 3D-модели',
    subtitle: 'Фигурки, декор, детали и прототипы с быстрым заказом',
    image: '/images/promo/car-model.webp',
    href: '/product/cmn7fc9lg000fzm7t9xdvy5p7',
    badge: 'Print-Form'
  },
  {
    id: 'promo-2',
    title: 'Печать под заказ',
    subtitle: 'Загрузите свою модель и отправьте в производство',
    image:
      'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=1600&q=80',
    href: '/catalog',
    badge: 'Реклама'
  },
  {
    id: 'promo-3',
    title: 'Прототипы и мелкие серии',
    subtitle: 'Для бизнеса, инженерии, дизайна и персональных заказов',
    image:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
    href: '/catalog?category=Прототипы',
    badge: 'Print-Form'
  }
];

const AUTOPLAY_DELAY = 5000;
const MOBILE_BREAKPOINT = 1100;
const SWIPE_THRESHOLD = 30;
const DESKTOP_GAP = 16;
const DESKTOP_CARD_WIDTH = 880;
const DESKTOP_ANIMATION_MS = 850;
const MOBILE_ANIMATION_MS = 700;
const CAROUSEL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const mod = (value: number, length: number) => ((value % length) + length) % length;

type Direction = 1 | -1;
type CardPosition = 'left' | 'center' | 'right';

type CarouselCardProps = {
  slide: PromoSlide;
  position: CardPosition;
  onClick?: () => void;
  disabled?: boolean;
};

const CarouselCard = ({
  slide,
  position,
  onClick,
  disabled = false
}: CarouselCardProps) => {
  const isCenter = position === 'center';

  return (
    <button
      type="button"
      className={
        isCenter
          ? `${styles.carouselCard} ${styles.carouselCenter}`
          : `${styles.carouselCard} ${styles.carouselSide}`
      }
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={slide.title}
    >
      <img
        src={slide.image}
        alt={slide.title}
        className={styles.carouselImage}
        loading={isCenter ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={isCenter ? 'high' : 'auto'}
      />
    </button>
  );
};

export const PromoCarousel = () => {
  const navigate = useNavigate();
  const slides = useMemo(() => PROMO_SLIDES, []);

  const [centerIndex, setCenterIndex] = useState(0);
  const [direction, setDirection] = useState<Direction>(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

  const [step, setStep] = useState(0);
  const [trackX, setTrackX] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(false);
  const [restingX, setRestingX] = useState(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const autoplayTimerRef = useRef<number | null>(null);

  const clearAutoplayTimer = () => {
    if (autoplayTimerRef.current !== null) {
      window.clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  };

  const syncDesktopStep = () => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const viewportWidth = viewportEl.offsetWidth;
    if (!viewportWidth) return;

    const nextStep = DESKTOP_CARD_WIDTH + DESKTOP_GAP;
    const centeredOffset = (viewportWidth - DESKTOP_CARD_WIDTH) / 2;

    const nextRestingX = centeredOffset - nextStep * 2;

    setStep(nextStep);
    setRestingX(nextRestingX);
    setTrackX(nextRestingX);
    setTransitionEnabled(false);
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(mobile);

      if (!mobile) {
        requestAnimationFrame(syncDesktopStep);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      requestAnimationFrame(syncDesktopStep);
    }
  }, [centerIndex, isMobile]);

  useEffect(() => {
    const preloadIndexes = isMobile
      ? [centerIndex, mod(centerIndex + 1, slides.length), mod(centerIndex - 1, slides.length)]
      : [
          mod(centerIndex - 2, slides.length),
          mod(centerIndex - 1, slides.length),
          centerIndex,
          mod(centerIndex + 1, slides.length),
          mod(centerIndex + 2, slides.length)
        ];

    preloadIndexes.forEach((index) => {
      const img = new Image();
      img.src = slides[index].image;
    });
  }, [centerIndex, isMobile, slides]);

  useEffect(() => {
    if (isAnimating) return;

    clearAutoplayTimer();
    autoplayTimerRef.current = window.setTimeout(() => {
      goNext();
    }, AUTOPLAY_DELAY);

    return clearAutoplayTimer;
  }, [centerIndex, isAnimating, isMobile]);

  useEffect(() => {
    return () => {
      clearAutoplayTimer();
    };
  }, []);

  const leftIndex = mod(centerIndex - 1, slides.length);
  const rightIndex = mod(centerIndex + 1, slides.length);

  const desktopTrackSlides = [
    slides[mod(centerIndex - 2, slides.length)],
    slides[leftIndex],
    slides[centerIndex],
    slides[rightIndex],
    slides[mod(centerIndex + 2, slides.length)]
  ];

  const targetIndex = mod(centerIndex + direction, slides.length);

  const goNext = () => {
    if (isAnimating) return;

    setDirection(1);

    if (isMobile) {
      setIsAnimating(true);
      setCenterIndex((prev) => mod(prev + 1, slides.length));
      return;
    }

    setIsAnimating(true);

    if (!step) {
      syncDesktopStep();
      setIsAnimating(false);
      return;
    }

    setTransitionEnabled(true);
    setTrackX(restingX - step);
  };

  const goPrev = () => {
    if (isAnimating) return;

    setDirection(-1);

    if (isMobile) {
      setIsAnimating(true);
      setCenterIndex((prev) => mod(prev - 1, slides.length));
      return;
    }

    setIsAnimating(true);

    if (!step) {
      syncDesktopStep();
      setIsAnimating(false);
      return;
    }

    setTransitionEnabled(true);
    setTrackX(restingX + step);
  };

  const handleDesktopAnimationComplete = () => {
    if (!isAnimating || !transitionEnabled) return;

    const nextCenterIndex = targetIndex;

    setTransitionEnabled(false);
    setCenterIndex(nextCenterIndex);
    setTrackX(restingX);

    requestAnimationFrame(() => {
      setIsAnimating(false);
    });
  };

  const handleMobileAnimationComplete = () => {
    if (!isAnimating) return;
    setIsAnimating(false);
  };

  const handleCenterClick = () => {
    if (isAnimating) return;
    navigate(slides[centerIndex].href);
  };

  const mobileVariants = {
    enter: (dir: Direction) => ({
      x: dir > 0 ? '100%' : '-100%'
    }),
    center: {
      x: '0%'
    },
    exit: (dir: Direction) => ({
      x: dir > 0 ? '-100%' : '100%'
    })
  };

  return (
    <section className={`${styles.promoSection} container`}>
      <div className={styles.marketCarouselWrap}>
        {isMobile ? (
          <div className={styles.marketCarouselMobile}>
            <AnimatePresence initial={false} custom={direction} mode="sync">
              <motion.div
                key={centerIndex}
                custom={direction}
                variants={mobileVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  duration: MOBILE_ANIMATION_MS / 1000,
                  ease: CAROUSEL_EASE
                }}
                drag="x"
                dragDirectionLock
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.08}
                onDragEnd={(_, info) => {
                  if (isAnimating) return;

                  const offsetX = info.offset.x;
                  const velocityX = info.velocity.x;

                  if (offsetX <= -SWIPE_THRESHOLD || velocityX < -300) {
                    goNext();
                    return;
                  }

                  if (offsetX >= SWIPE_THRESHOLD || velocityX > 300) {
                    goPrev();
                    return;
                  }
                }}
                onAnimationComplete={handleMobileAnimationComplete}
                className={styles.mobileCarouselSlide}
              >
                <CarouselCard
                  slide={slides[centerIndex]}
                  position="center"
                  disabled={isAnimating}
                  onClick={handleCenterClick}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className={styles.marketCarouselDesktopShell}>
            <div ref={viewportRef} className={styles.carouselViewport}>
              <motion.div
                className={styles.carouselTrack}
                animate={{ x: trackX }}
                transition={
                  transitionEnabled
                    ? {
                        duration: DESKTOP_ANIMATION_MS / 1000,
                        ease: CAROUSEL_EASE
                      }
                    : { duration: 0 }
                }
                onAnimationComplete={handleDesktopAnimationComplete}
              >
                {desktopTrackSlides.map((slide, index) => {
                  const position: CardPosition =
                    index === 1 ? 'left' : index === 2 ? 'center' : 'right';

                  const onClick =
                    index === 1
                      ? goPrev
                      : index === 2
                        ? handleCenterClick
                        : goNext;

                  return (
                    <div
                      key={`${slide.id}-${index}`}
                      className={styles.carouselTrackItem}
                      aria-hidden={index === 0 || index === 4}
                    >
                      <CarouselCard
                        slide={slide}
                        position={position}
                        disabled={isAnimating}
                        onClick={onClick}
                      />
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};