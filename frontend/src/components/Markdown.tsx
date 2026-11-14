import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

/** Renders question text: Markdown (with tables), plus $inline$ and $$display$$ LaTeX. */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose-q ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
