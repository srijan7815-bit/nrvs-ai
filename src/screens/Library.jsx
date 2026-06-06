import { useNavigate } from 'react-router-dom'
import { AppWindow, Trash2, MessageSquare, Eye } from 'lucide-react'
import Layout from '../components/Layout'
import { useLibrary, deleteLibraryItem } from '../lib/library'
import { useArtifacts } from '../lib/artifacts'
import { useConfirm } from '../lib/useConfirm'

export default function Library() {
  const items = useLibrary()
  const navigate = useNavigate()
  const { openArtifact } = useArtifacts()
  const [confirm, confirmUI] = useConfirm()

  const askDelete = async (it) => {
    const ok = await confirm({
      title: 'Delete artifact?',
      message: `“${it.title}” will be removed from your Library.`,
    })
    if (ok) deleteLibraryItem(it.id)
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4 sm:px-6 lg:pt-8">
        <h1 className="mb-1 text-heading-lg font-semibold">Library</h1>
        <p className="mb-6 text-body-sm text-text-tertiary">
          Artifacts you’ve saved from chats. Open the preview or jump back to the
          conversation that created it.
        </p>

        {items.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 rounded-md py-12 text-center">
            <AppWindow size={28} className="text-text-tertiary" />
            <p className="text-body text-text-secondary">No saved artifacts yet</p>
            <p className="text-body-sm text-text-tertiary">
              Generate something with code/preview, then tap “Save to Library”.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <div key={it.id} className="card flex flex-col rounded-md p-4">
                <div className="mb-3 flex items-start gap-2">
                  <AppWindow size={18} className="mt-0.5 text-accent-orange" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-medium text-text-primary">
                      {it.title}
                    </div>
                    <div className="text-caption text-text-tertiary">
                      {new Date(it.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => askDelete(it)}
                    className="shrink-0 rounded-sm p-1 text-text-tertiary hover:text-danger"
                    aria-label="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <button
                    onClick={() =>
                      openArtifact({
                        type: it.kind,
                        title: it.title,
                        content: it.content,
                      })
                    }
                    className="btn-primary h-9 flex-1 text-body-sm"
                  >
                    <Eye size={15} /> Open
                  </button>
                  {it.threadId && (
                    <button
                      onClick={() => navigate(`/thread/${it.threadId}`)}
                      className="btn-icon flex h-9 items-center gap-1.5 px-3 text-body-sm"
                      title="Go to source chat"
                    >
                      <MessageSquare size={15} /> Chat
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {confirmUI}
    </Layout>
  )
}
