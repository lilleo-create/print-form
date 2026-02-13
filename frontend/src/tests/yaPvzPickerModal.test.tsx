import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { YaPvzPickerModal } from '../components/delivery/YaPvzPickerModal';

describe('YaPvzPickerModal widget lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.YaDelivery = {
      createWidget: vi.fn(),
      setParams: vi.fn()
    };
  });

  it('does not recreate widget instance after close/open', async () => {
    const { rerender } = render(
      <YaPvzPickerModal
        isOpen
        onClose={() => undefined}
        onSelect={() => undefined}
        city="Москва"
        source_platform_station="station-1"
      />
    );

    await waitFor(() => {
      expect(window.YaDelivery?.createWidget).toHaveBeenCalledTimes(1);
    });

    rerender(
      <YaPvzPickerModal
        isOpen={false}
        onClose={() => undefined}
        onSelect={() => undefined}
        city="Москва"
        source_platform_station="station-1"
      />
    );

    rerender(
      <YaPvzPickerModal
        isOpen
        onClose={() => undefined}
        onSelect={() => undefined}
        city="Москва"
        source_platform_station="station-1"
      />
    );

    expect(window.YaDelivery?.createWidget).toHaveBeenCalledTimes(1);
  });
});
