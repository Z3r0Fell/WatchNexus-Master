import React from 'react'
import { render, screen, waitFor, act, userEvent, fireEvent } from './test-utils'
import { usePrompt } from '../hooks/use-prompt'

const TestComponent = () => {
  const { prompt, PromptDialog } = usePrompt()
  const [result, setResult] = React.useState(null)

  const handleClick = async () => {
    const value = await prompt({
      title: 'Test Prompt',
      description: 'Enter something',
      defaultValue: 'default',
      // usePrompt has fixed Confirm/Cancel buttons (no confirmText/cancelText option)
    })
    setResult(value)
  }

  return (
    <div>
      <button data-testid="trigger-btn" onClick={handleClick}>Trigger</button>
      <div data-testid="result">{result === null ? 'null' : result}</div>
      <PromptDialog />
    </div>
  )
}

describe('usePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('opens dialog when prompt called', async () => {
    render(<TestComponent />)
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'))
    })

    await waitFor(() => expect(screen.getByText('Test Prompt')).toBeInTheDocument())
    expect(screen.getByText('Enter something')).toBeInTheDocument()
    expect(screen.getByDisplayValue('default')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  test('resolves with input value on confirm', async () => {
    render(<TestComponent />)
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'))
    })
    const input = await screen.findByDisplayValue('default')
    await act(async () => {
      await userEvent.clear(input)
      await userEvent.type(screen.getByRole('textbox'), 'user input')
    })
    // fireEvent: Radix sets pointer-events:none on <body> while modal
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm'))
    })

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('user input'))
  })

  test('resolves null on cancel', async () => {
    render(<TestComponent />)
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'))
      await userEvent.click(screen.getByText('Cancel'))
    })

    expect(screen.getByTestId('result')).toHaveTextContent('null')
  })

  test('uses default texts when not provided', async () => {
    const TestDefault = () => {
      const { prompt, PromptDialog } = usePrompt()
      const [result, setResult] = React.useState(null)

      const handleClick = async () => {
        const value = await prompt({})
        setResult(value)
      }

      return (
        <div>
          <button data-testid="trigger-btn" onClick={handleClick}>Trigger</button>
          <div data-testid="result">{result === null ? 'null' : result}</div>
          <PromptDialog />
        </div>
      )
    }

    render(<TestDefault />)
    await waitFor(() => expect(screen.getByTestId('trigger-btn')).toBeInTheDocument())

    await act(async () => {
      await userEvent.click(screen.getByTestId('trigger-btn'))
    })

    expect(await screen.findByText('Input required')).toBeInTheDocument(); // default title
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })
})