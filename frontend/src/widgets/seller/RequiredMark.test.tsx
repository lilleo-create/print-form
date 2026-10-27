import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RequiredMark } from './RequiredMark';

describe('RequiredMark', () => {
  it('shows a small tooltip on hover and keyboard focus', () => {
    render(<RequiredMark />);
    const mark = screen.getByLabelText('Обязательное поле');
    expect(mark).toHaveTextContent('*');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(mark);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Обязательное поле');
    fireEvent.mouseLeave(mark);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(mark);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Обязательное поле');
    fireEvent.blur(mark);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
