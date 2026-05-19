import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../shared/ui/Button';
import styles from './ImageCropModal.module.css';

const MIN_SIZE = 60;
const OUTPUT_MAX = 1200;
const HANDLE_HIT = 16; // px hit area for edge cursor detection

interface CropBox { x: number; y: number; size: number }
type DragType = 'nw' | 'ne' | 'sw' | 'se' | 'move';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Returns image's rendered rect inside its container (object-fit: contain) */
const imageLayout = (cW: number, cH: number, natW: number, natH: number) => {
  const imgAspect = natW / natH;
  const cAspect   = cW / cH;
  const rendW = imgAspect > cAspect ? cW : cH * imgAspect;
  const rendH = imgAspect > cAspect ? cW / imgAspect : cH;
  return { x: (cW - rendW) / 2, y: (cH - rendH) / 2, w: rendW, h: rendH };
};

/** Given a pointer position, return which resize handle it's on (if any) */
const hitHandle = (px: number, py: number, box: CropBox): DragType | null => {
  const { x, y, size } = box;
  const inX = px >= x && px <= x + size;
  const inY = py >= y && py <= y + size;
  const onL = Math.abs(px - x) < HANDLE_HIT;
  const onR = Math.abs(px - x - size) < HANDLE_HIT;
  const onT = Math.abs(py - y) < HANDLE_HIT;
  const onB = Math.abs(py - y - size) < HANDLE_HIT;
  if (onT && onL) return 'nw';
  if (onT && onR) return 'ne';
  if (onB && onL) return 'sw';
  if (onB && onR) return 'se';
  if (inX && inY) return 'move';
  return null;
};

const cursorForHandle = (h: DragType | null): string => {
  if (!h) return 'default';
  if (h === 'move') return 'move';
  return `${h}-resize`;
};

const applyDrag = (type: DragType, dx: number, dy: number, start: CropBox, bounds: { x: number; y: number; w: number; h: number }): CropBox => {
  let { x, y, size } = start;
  const bR = bounds.x + bounds.w;
  const bB = bounds.y + bounds.h;

  switch (type) {
    case 'move':
      return {
        x: clamp(x + dx, bounds.x, bR - size),
        y: clamp(y + dy, bounds.y, bB - size),
        size,
      };
    case 'se': {
      const d = Math.max(dx, dy);
      const s = clamp(size + d, MIN_SIZE, Math.min(bR - x, bB - y));
      return { x, y, size: s };
    }
    case 'sw': {
      const d = Math.max(-dx, dy);
      const s = clamp(size + d, MIN_SIZE, Math.min(x + size - bounds.x, bB - y));
      return { x: x + size - s, y, size: s };
    }
    case 'ne': {
      const d = Math.max(dx, -dy);
      const s = clamp(size + d, MIN_SIZE, Math.min(bR - x, y + size - bounds.y));
      return { x, y: y + size - s, size: s };
    }
    case 'nw': {
      const d = Math.max(-dx, -dy);
      const s = clamp(size + d, MIN_SIZE, Math.min(x + size - bounds.x, y + size - bounds.y));
      return { x: x + size - s, y: y + size - s, size: s };
    }
  }
};

const cropToBlob = (img: HTMLImageElement, container: HTMLDivElement, box: CropBox): Promise<Blob> => {
  const cW = container.clientWidth;
  const cH = container.clientHeight;
  const layout = imageLayout(cW, cH, img.naturalWidth, img.naturalHeight);
  const scaleX = img.naturalWidth / layout.w;
  const scaleY = img.naturalHeight / layout.h;

  const px = Math.round((box.x - layout.x) * scaleX);
  const py = Math.round((box.y - layout.y) * scaleY);
  const ps = Math.round(box.size * Math.min(scaleX, scaleY));
  const cx = clamp(px, 0, img.naturalWidth - 1);
  const cy = clamp(py, 0, img.naturalHeight - 1);
  const cs = Math.min(ps, img.naturalWidth - cx, img.naturalHeight - cy);

  const out = Math.min(cs, OUTPUT_MAX);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no ctx'));
  ctx.drawImage(img, cx, cy, cs, cs, 0, 0, out, out);
  return new Promise((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error('empty'))), 'image/jpeg', 0.92)
  );
};

interface Props {
  src: string;
  fileName: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export const ImageCropModal = ({ src, fileName, onConfirm, onCancel }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);
  const dragRef      = useRef<{ type: DragType; startX: number; startY: number; startBox: CropBox; bounds: ReturnType<typeof imageLayout> } | null>(null);

  const [cropBox,  setCropBox]  = useState<CropBox>({ x: 0, y: 0, size: 0 });
  const [cursor,   setCursor]   = useState('default');
  const [isBusy,   setIsBusy]   = useState(false);
  const [imgReady, setImgReady] = useState(false);

  /* Initialize crop to full image area on load */
  const initCrop = useCallback(() => {
    const c = containerRef.current;
    const img = imgRef.current;
    if (!c || !img || !img.naturalWidth) return;
    const lay = imageLayout(c.clientWidth, c.clientHeight, img.naturalWidth, img.naturalHeight);
    const size = Math.min(lay.w, lay.h);
    setCropBox({ x: lay.x + (lay.w - size) / 2, y: lay.y + (lay.h - size) / 2, size });
  }, []);

  useEffect(() => { if (imgReady) initCrop(); }, [imgReady, initCrop]);

  /* Pointer events — global so drag works outside container */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setCropBox(applyDrag(d.type, dx, dy, d.startBox, d.bounds));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const getRelativePos = (e: React.PointerEvent): { px: number; py: number } => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };

  const getBounds = () => {
    const c = containerRef.current!;
    const img = imgRef.current!;
    return imageLayout(c.clientWidth, c.clientHeight, img.naturalWidth, img.naturalHeight);
  };

  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const { px, py } = getRelativePos(e);
    const type = hitHandle(px, py, cropBox);
    if (!type) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { type, startX: e.clientX, startY: e.clientY, startBox: { ...cropBox }, bounds: getBounds() };
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) return; // cursor handled by global move
    const { px, py } = getRelativePos(e);
    const handle = hitHandle(px, py, cropBox);
    setCursor(cursorForHandle(handle));
  };

  const handleContainerPointerLeave = () => {
    if (!dragRef.current) setCursor('default');
  };

  const handleConfirm = async () => {
    const img = imgRef.current;
    const c = containerRef.current;
    if (!img || !c) return;
    setIsBusy(true);
    try {
      const blob = await cropToBlob(img, c, cropBox);
      onConfirm(blob);
    } catch {
      onCancel();
    } finally {
      setIsBusy(false);
    }
  };

  const { x, y, size } = cropBox;

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h4 className={styles.title}>Кадрирование фото</h4>
          <span className={styles.subtitle}>{fileName}</span>
        </div>

        {/* Crop canvas */}
        <div
          ref={containerRef}
          className={styles.cropArea}
          style={{ cursor }}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerLeave={handleContainerPointerLeave}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            className={styles.cropImg}
            draggable={false}
            onLoad={() => setImgReady(true)}
          />

          {imgReady && size > 0 && (
            <>
              {/* Dark overlay — 4 pieces around crop box */}
              <div className={styles.shade} style={{ top: 0, left: 0, right: 0, height: y }} />
              <div className={styles.shade} style={{ top: y + size, left: 0, right: 0, bottom: 0 }} />
              <div className={styles.shade} style={{ top: y, left: 0, width: x, height: size }} />
              <div className={styles.shade} style={{ top: y, left: x + size, right: 0, height: size }} />

              {/* Crop rectangle border */}
              <div
                className={styles.cropRect}
                style={{ left: x, top: y, width: size, height: size }}
              >
                {/* Rule of thirds grid lines */}
                <div className={styles.gridLine} style={{ left: '33.33%', top: 0, width: 1, height: '100%' }} />
                <div className={styles.gridLine} style={{ left: '66.66%', top: 0, width: 1, height: '100%' }} />
                <div className={styles.gridLine} style={{ top: '33.33%', left: 0, height: 1, width: '100%' }} />
                <div className={styles.gridLine} style={{ top: '66.66%', left: 0, height: 1, width: '100%' }} />

                {/* Corner handles */}
                <div className={`${styles.handle} ${styles.handleNW}`} />
                <div className={`${styles.handle} ${styles.handleNE}`} />
                <div className={`${styles.handle} ${styles.handleSW}`} />
                <div className={`${styles.handle} ${styles.handleSE}`} />
              </div>
            </>
          )}
        </div>

        <p className={styles.hint}>Перетащите углы для изменения размера · перетащите внутри для перемещения</p>

        <div className={styles.actions}>
          <Button onClick={handleConfirm} disabled={isBusy || !imgReady}>
            {isBusy ? 'Обработка…' : 'Готово'}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
            Отмена
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
