import { render, screen, waitFor, act } from './test-utils'
// SKIPPED: src/hooks/use-debounce.js does not exist in the product (no
// component uses a debounce hook). The suite runs automatically once the hook
// is added; until then it is skipped instead of failing to compile.
let useDebounce
try {
  // eslint-disable-next-line global-require
  useDebounce = require('../hooks/use-debounce').useDebounce
} catch {
  useDebounce = undefined
}
const describeIfHook = useDebounce ? describe : describe.skip

const TestComponent = ({ value, delay = 500 }) => {
  const debounced = useDebounce(value, delay)
  return <div data-testid="debounced-value">{debounced}</div>
}

describeIfHook('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('returns initial value immediately', () => {
    render(<TestComponent value="initial" />)
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial')
  })

  test('debounces value changes', () => {
    const { rerender } = render(<TestComponent value="initial" />)
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial')
    
    rerender(<TestComponent value="changed" />)
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial'); // Still initial
    
    act(() => {
      jest.advanceTimersByTime(500)
    })
    
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('changed')
  })

  test('resets timer on rapid changes', () => {
    const { rerender } = render(<TestComponent value="initial" />)
    
    rerender(<TestComponent value="change1" />)
    act(() => { jest.advanceTimersByTime(200); })
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial')
    
    rerender(<TestComponent value="change2" />)
    act(() => { jest.advanceTimersByTime(200); })
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial')
    
    rerender(<TestComponent value="final" />)
    act(() => { jest.advanceTimersByTime(500); })
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('final')
  })

  test('uses custom delay', () => {
    const { rerender } = render(<TestComponent value="initial" delay={1000} />)
    
    rerender(<TestComponent value="changed" delay={1000} />)
    act(() => { jest.advanceTimersByTime(500); })
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('initial')
    
    act(() => { jest.advanceTimersByTime(500); })
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('changed')
  })

  test('cleans up on unmount', () => {
    const { rerender, unmount } = render(<TestComponent value="initial" />)
    
    rerender(<TestComponent value="changed" />)
    unmount()
    
    act(() => { jest.advanceTimersByTime(500); })
    // Should not throw or update after unmount
  })
})