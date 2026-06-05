import { motion } from 'framer-motion'
import Markdown from '../lib/markdown.jsx'
import Sunburst from './Sunburst'
import { USER_INITIAL } from './nav'

/** A single chat message row. User messages are right-aligned bubbles; assistant uses the brand mark. */
export default function Message({ role, content, streaming }) {
  const isUser = role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={`flex w-full gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-border bg-surface">
          <Sunburst size={18} />
        </div>
      )}

      <div
        className={
          isUser
            ? 'max-w-[80%] rounded-lg rounded-tr-sm border border-border bg-surface2 px-4 py-2.5 text-body text-text-primary'
            : 'max-w-[80%] pt-1'
        }
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : (
          <>
            <Markdown text={content} />
            {streaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-text-tertiary align-middle" />
            )}
          </>
        )}
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-surface2 text-body-sm font-medium text-text-primary ring-1 ring-border">
          {USER_INITIAL}
        </div>
      )}
    </motion.div>
  )
}
