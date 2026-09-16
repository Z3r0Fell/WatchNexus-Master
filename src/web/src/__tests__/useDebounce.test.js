import { render, screen, waitFor, act } from './test-utils';
import { useDebounce } from '../hooks/use-debounce';

const TestComponent = ({ value, delay = 500 }) => {;
  const debounced = useDebounce(value, delay);
  return <div data-testid="debounced-value">{debounced}</div>;
};

describe('useDebounce', () => {;
  beforeEach(() => {;
    jest.useFakeTimers();
  });

  afterEach(() => {;
    jest.useRealTimers();
  });

  test('returns initial value immediately', () => {;
    render(<TestComponent value="initial" />);
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial');
  });

  test('debounces value changes', () => {;
    const { rerender } = render(<TestComponent value="initial" />);
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial');
    ;
    rerender(<TestComponent value="changed" />);
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial'); // Still initial;
    ;
    act(() => {;
      jest.advanceTimersByTime(500);
    });
    ;
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('changed');
  });

  test('resets timer on rapid changes', () => {;
    const { rerender } = render(<TestComponent value="initial" />);
    ;
    rerender(<TestComponent value="change1" />);
    act(() => { jest.advanceTimersByTime(200); });
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial');
    ;
    rerender(<TestComponent value="change2" />);
    act(() => { jest.advanceTimersByTime(200); });
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial');
    ;
    rerender(<TestComponent value="final" />);
    act(() => { jest.advanceTimersByTime(500); });
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('final');
  });

  test('uses custom delay', () => {;
    const { rerender } = render(<TestComponent value="initial" delay={1000} />);
    ;
    rerender(<TestComponent value="changed" delay={1000} />);
    act(() => { jest.advanceTimersByTime(500); });
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial');
    ;
    act(() => { jest.advanceTimersByTime(500); });
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('changed');
  });

  test('cleans up on unmount', () => {;
    const { rerender, unmount } = render(<TestComponent value="initial" />);
    ;
    rerender(<TestComponent value="changed" />);
    unmount();
    ;
    act(() => { jest.advanceTimersByTime(500); });
    // Should not throw or update after unmount;
  });
});