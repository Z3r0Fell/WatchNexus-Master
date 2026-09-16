import React from 'react';
import { render, screen, waitFor, act, userEvent } from '../test-utils';
import { useConfirm } from '../../hooks/use-confirm';

const TestComponent = ({ onConfirm }) => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [result, setResult] = React.useState(null);

  const handleClick = async () => {
    const confirmed = await confirm({
      title: 'Test Confirm',
      description: 'Are you sure?',
      confirmText: 'Yes',
      cancelText: 'No',
    });
    setResult(confirmed);
    if (onConfirm) onConfirm(confirmed);
  };

  return (
    <div>
      <button data-testid="trigger-btn" onClick={handleClick}>Trigger</button>
      <div data-testid="result">{result === null ? 'null' : result ? 'true' : 'false'}</div>
      <ConfirmDialog />
    </div>
  );
};

describe('useConfirm Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('opens dialog when confirm called', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
    });

    await waitFor(() => expect(screen.getByText('Test Confirm')).toBeInTheDocument());
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  test('resolves true on confirm', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.click(screen.getByText('Yes'));
    });

    expect(screen.getByTestId('result')).toHaveTextContent('true');
  });

  test('resolves false on cancel', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.click(screen.getByText('No'));
    });

    expect(screen.getByTestId('result')).toHaveTextContent('false');
  });

  test('resolves false on backdrop click', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      const dialog = screen.getByRole('alertdialog');
      await userEvent.click(dialog.parentElement);
    });

    expect(screen.getByTestId('result')).toHaveTextContent('false');
  });

  test('resolves false on Escape key', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.keyboard('{Escape}');
    });

    expect(screen.getByTestId('result')).toHaveTextContent('false');
  });

  test('uses default texts when not provided', async () => {
    const TestDefault = () => {
      const { confirm, ConfirmDialog } = useConfirm();
      const [result, setResult] = React.useState(null);

      const handleClick = async () => {
        const confirmed = await confirm({});
        setResult(confirmed);
      };

      return (
        <div>
          <button data-testid="trigger-btn" onClick={handleClick}>Trigger</button>
          <div data-testid="result">{result === null ? 'null' : result ? 'true' : 'false'}</div>
          <ConfirmDialog />
        </div>
      );
    };

    render(<TestDefault />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
    });

    await waitFor(() => expect(screen.getByText('Are you sure?')).toBeInTheDocument());
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  test('confirm options are customizable', async () => {
    const CustomConfirm = () => {
      const { confirm, ConfirmDialog } = useConfirm();
      const [result, setResult] = React.useState(null);

      const handleClick = async () => {
        const confirmed = await confirm({
          title: 'Delete Item?',
          description: 'This action cannot be undone.',
          confirmText: 'Delete',
          cancelText: 'Keep',
        });
        setResult(confirmed);
      };

      return (
        <div>
          <button data-testid="trigger-btn" onClick={handleClick}>Trigger</button>
          <div data-testid="result">{result === null ? 'null' : result ? 'true' : 'false'}</div>
          <ConfirmDialog />
        </div>
      );
    };

    render(<CustomConfirm />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
    });

    await waitFor(() => expect(screen.getByText('Delete Item?')).toBeInTheDocument());
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  test('ConfirmDialog component renders correctly', () => {
    const { ConfirmDialog } = useConfirm();
    const dialogElement = ConfirmDialog();
    expect(dialogElement).toBeDefined();
    expect(dialogElement.type).toBeDefined();
  });

  test('multiple sequential confirms work correctly', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    // First confirm
    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.click(screen.getByText('Yes'));
    });
    expect(screen.getByTestId('result')).toHaveTextContent('true');

    // Second confirm
    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.click(screen.getByText('No'));
    });
    expect(screen.getByTestId('result')).toHaveTextContent('false');
  });

  test('cleanup on unmount', async () => {
    const { unmount } = render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
    });

    await waitFor(() => expect(screen.getByText('Test Confirm')).toBeInTheDocument());

    unmount();

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });

  test('concurrent confirms - only last one active', async () => {
    const ConcurrentConfirm = () => {
      const { confirm, ConfirmDialog } = useConfirm();
      const [results, setResults] = React.useState([]);

      const handleClick = async () => {
        // Fire two confirms rapidly
        const p1 = confirm({ title: 'First' });
        const p2 = confirm({ title: 'Second' });
        const [r1, r2] = await Promise.all([p1, p2]);
        setResults([r1, r2]);
      };

      return (
        <div>
          <button data-testid="trigger-btn" onClick={handleClick}>Trigger</button>
          <div data-testid="results">{JSON.stringify(results)}</div>
          <ConfirmDialog />
        </div>
      );
    };

    render(<ConcurrentConfirm />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
    });

    // Only the second dialog should be visible
    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument());
    expect(screen.queryByText('First')).not.toBeInTheDocument();
  });
});