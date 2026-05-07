import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDangerModal } from '../../src/components/ConfirmDangerModal';

const baseProps = {
  open: true,
  title: 'Reset tournament?',
  body: 'Everything will be cleared.',
  confirmLabel: 'Reset tournament',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDangerModal', () => {
  it('renders nothing when open is false', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDangerModal {...baseProps} open={false} onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.queryByText('Reset tournament?')).not.toBeInTheDocument();
  });

  it('renders title, body, and confirm label when open', () => {
    render(<ConfirmDangerModal {...baseProps} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Reset tournament?')).toBeInTheDocument();
    expect(screen.getByText('Everything will be cleared.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset tournament' })).toBeInTheDocument();
  });

  it('clicking Cancel calls onCancel and not onConfirm', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDangerModal {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking Confirm calls onConfirm and not onCancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDangerModal {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset tournament' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Esc key calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDangerModal {...baseProps} onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Enter key does NOT call onConfirm (deliberate guard)', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDangerModal {...baseProps} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking the backdrop calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDangerModal {...baseProps} onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByTestId('confirm-modal-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Cancel is the default-focused button when opened', () => {
    render(<ConfirmDangerModal {...baseProps} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
  });
});
