import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThresholdEditor } from '../src/components/ThresholdEditor';

describe('ThresholdEditor', () => {
  it('adjusts a pin from the keyboard without crossing its neighbor', () => {
    const onChange = vi.fn();
    render(<ThresholdEditor onChange={onChange} value={[24, 48, 168]} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'New to waiting' }), {
      key: 'ArrowRight',
    });

    expect(onChange).toHaveBeenCalledWith([30, 48, 168]);
  });

  it('resets all boundaries', () => {
    const onChange = vi.fn();
    render(<ThresholdEditor onChange={onChange} value={[12, 72, 240]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onChange).toHaveBeenCalledWith([24, 48, 168]);
  });

  it('shows separate day and hour inputs for every boundary', () => {
    const onChange = vi.fn();
    render(<ThresholdEditor onChange={onChange} value={[25, 72, 168]} />);

    expect(screen.getAllByRole('spinbutton')).toHaveLength(6);
    expect(screen.getByRole('spinbutton', { name: 'New to waiting days' })).toHaveValue(1);
    expect(screen.getByRole('spinbutton', { name: 'New to waiting hours' })).toHaveValue(1);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'New to waiting hours' }), {
      target: { value: '6' },
    });
    expect(onChange).toHaveBeenCalledWith([30, 72, 168]);
  });
});
