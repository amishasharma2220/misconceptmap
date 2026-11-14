import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Markdown } from './Markdown'

test('renders inline LaTeX with KaTeX', () => {
  const { container } = render(<Markdown>{'Solve $T(n) = 2T(n/2) + n$.'}</Markdown>)
  expect(container.querySelector('.katex')).not.toBeNull()
})

test('bad LaTeX does not crash the page', () => {
  const { container } = render(<Markdown>{'Broken $\\frac{1$ maths'}</Markdown>)
  expect(container.textContent).toContain('maths')
})

test('renders Markdown code blocks', () => {
  const { container } = render(<Markdown>{'```c\nint x = 1;\n```'}</Markdown>)
  expect(container.querySelector('pre code')?.textContent).toContain('int x = 1;')
})

test('renders Markdown tables, as used in scheduling questions', () => {
  const { container } = render(<Markdown>{'| Process | Burst |\n|---|---|\n| P1 | 8 |'}</Markdown>)
  expect(container.querySelectorAll('table th')).toHaveLength(2)
  expect(container.querySelector('table td')?.textContent).toBe('P1')
})
