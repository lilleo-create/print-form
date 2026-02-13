import { render, screen } from '@testing-library/react';
import { PickupPointBlock } from '../features/checkout/ui/PickupPointBlock';

describe('PickupPointBlock', () => {
  it('shows selected pickup address from store state', () => {
    render(
      <PickupPointBlock
        point={{
          provider: 'YANDEX_NDD',
          pvzId: 'pvz-1',
          addressFull: 'Москва, ул. Тверская, 1'
        }}
        onOpen={() => undefined}
      />
    );

    expect(screen.getByText('Москва, ул. Тверская, 1')).toBeInTheDocument();
    expect(screen.queryByText('Выберите пункт выдачи')).not.toBeInTheDocument();
  });
});
