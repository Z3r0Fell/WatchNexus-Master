import React from 'react';
import { render, screen, waitFor, act, userEvent } from '../test-utils';
import { usePrompt } from '../../hooks/use-prompt';

const TestComponent = ({ onPrompt, defaultValue = '' }) => {
  const { prompt, PromptDialog } = usePrompt();
  const [result, setResult] = React.useState(null);

  const handleClick = async () => {
    const value = await prompt({
      title: 'Test Prompt',
      description: 'Enter something',
      defaultValue,
      placeholder: 'Placeholder text',
    });
    setResult(value);
    if (onPrompt) onPrompt(value);
  };

  return (
    <div>
      <button data-testid="trigger-btn" onClick={handleClick}>Trigger</button>
      <div data-testid="result">{result === null ? 'null' : result}</div>
      <PromptDialog />
    </div>
  );
};

describe('usePrompt Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('opens dialog when prompt called', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
    });

    await waitFor(() => expect(screen.getByText('Test Prompt')).toBeInTheDocument());
    expect(screen.getByText('Enter something')).toBeInTheDocument();
    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  test('resolves with input value on confirm', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.type(screen.getByRole('textbox'), 'user input');
      await userEvent.click(screen.getByText('Confirm'));
    });

    expect(screen.getByTestId('result')).toHaveTextContent('user input');
  });

  test('resolves with default value when provided', async () => {
    render(<TestComponent defaultValue="default-value" />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.click(screen.getByText('Confirm'));
    });

    expect(screen.getByTestId('result')).toHaveTextContent('default-value');
  });

  test('resolves null on cancel', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.click(screen.getByText('Cancel'));
    });

    expect(screen.getByTestId('result')).toHaveTextContent('null');
  });

  test('resolves null on backdrop click', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      // Click on dialog overlay
      const dialog = screen.getByRole('dialog');
      await userEvent.click(dialog.parentElement);
    });

    expect(screen.getByTestId('result')).toHaveTextContent('null');
  });

  test('resolves null on Escape key', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.keyboard('{Escape}');
    });

    expect(screen.getByTestId('result')).toHaveTextContent('null');
  });

  test('handles Enter key to confirm', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.type(screen.getByRole('textbox'), 'enter test');
      await userEvent.keyboard('{Enter}');
    });

    expect(screen.getByTestId('result')).toHaveTextContent('enter test');
  });

  test('multiple sequential prompts work correctly', async () => {
    render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    // First prompt
    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.type(screen.getByRole('textbox'), 'first');
      await userEvent.click(screen.getByText('Confirm'));
    });
    expect(screen.getByTestId('result')).toHaveTextContent('first');

    // Second prompt
    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
      await userEvent.clear(screen.getByRole('textbox'));
      await userEvent.type(screen.getByRole('textbox'), 'second');
      await userEvent.click(screen.getByText('Confirm'));
    });
    expect(screen.getByTestId('result')).toHaveTextContent('second');
  });

  test('prompt options are customizable', async () => {
    const CustomPrompt = () => {
      const { prompt, PromptDialog } = usePrompt();
      const [result, setResult] = React.useState(null);

      const handleClick = async () => {
        const value = await prompt({
          title: 'Custom Title',
          description: 'Custom description',
          placeholder: 'Custom placeholder',
          defaultValue: 'custom default',
        });
        setResult(value);
      };

      return (
        <div>
          <button data-testid="trigger-btn" onClick={handleClick}>Trigger</button>
          <div data-testid="result">{result === null ? 'null' : result}</div>
          <PromptDialog />
        </div>
      );
    };

    render(<CustomPrompt />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
    });

    await waitFor(() => expect(screen.getByText('Custom Title')).toBeInTheDocument());
    expect(screen.getByText('Custom description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('custom default')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  test('cleanup on unmount', async () => {
    const { unmount } = render(<TestComponent />);
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument());

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'));
    });

    await waitFor(() => expect(screen.getByText('Test Prompt')).toBeInTheDocument());

    unmount();

    // Should not throw
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });
});