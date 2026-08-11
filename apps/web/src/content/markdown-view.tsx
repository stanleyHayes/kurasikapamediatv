import type { BlockNode, InlineNode } from './markdown'
import { parseMarkdown } from './markdown'

const BODY = 'text-on-surface mb-6 text-[length:var(--text-body-lg)] leading-relaxed'
const HEAD = 'font-display text-on-surface mb-4 font-semibold tracking-[-0.02em]'

/**
 * Turns the Markdown tree into React children. Every string is escaped by
 * React. There is no dangerouslySetInnerHTML on this path.
 */
export function MarkdownView({ source }: { source: string }): React.ReactElement {
  const blocks = parseMarkdown(source)

  return (
    <div className="max-w-[68ch]">
      {blocks.map((block, index) => (
        <Block key={index} node={block} />
      ))}
    </div>
  )
}

function Block({ node }: { node: BlockNode }): React.ReactElement {
  switch (node.kind) {
    case 'p':
      return <p className={BODY}>{inlines(node.children)}</p>
    case 'h':
      return <Heading level={node.level}>{inlines(node.children)}</Heading>
    case 'ul':
      return (
        <ul className={`${BODY} list-disc pl-6`}>
          {node.items.map((item, i) => (
            <li key={i}>{inlines(item)}</li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol className={`${BODY} list-decimal pl-6`}>
          {node.items.map((item, i) => (
            <li key={i}>{inlines(item)}</li>
          ))}
        </ol>
      )
  }
}

function Heading({
  level,
  children,
}: {
  level: 1 | 2 | 3
  children: React.ReactNode
}): React.ReactElement {
  if (level === 1) return <h2 className={`${HEAD} text-[length:var(--text-headline-md)]`}>{children}</h2>
  if (level === 2) return <h3 className={`${HEAD} text-[length:var(--text-headline-sm)]`}>{children}</h3>
  return <h4 className={`${HEAD} text-xl`}>{children}</h4>
}

function inlines(nodes: readonly InlineNode[]): React.ReactNode {
  return nodes.map((node, index) => <Inline key={index} node={node} />)
}

function Inline({ node }: { node: InlineNode }): React.ReactElement {
  switch (node.kind) {
    case 'text':
      return <>{node.value}</>
    case 'strong':
      return <strong>{inlines(node.children)}</strong>
    case 'em':
      return <em>{inlines(node.children)}</em>
    case 'code':
      return <code className="font-mono text-[0.9em]">{node.value}</code>
    case 'link':
      return (
        <a href={node.href} className="text-secondary underline underline-offset-4">
          {inlines(node.children)}
        </a>
      )
  }
}
