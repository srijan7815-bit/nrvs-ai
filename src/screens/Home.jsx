import Layout from '../components/Layout'
import Composer from '../components/Composer'
import Sunburst from '../components/Sunburst'
import UpgradeBanner from '../components/UpgradeBanner'
import { USER_NAME } from '../components/nav'
import { useChat } from '../lib/useChat'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const SUGGESTIONS = [
  'Write a launch announcement for a new app',
  'Explain closures in JavaScript simply',
  'Plan a 3-day trip to Kyoto',
  'Give me a healthy weeknight dinner idea',
]

export default function Home() {
  const { send, busy } = useChat()

  return (
    <Layout>
      <div className="mx-auto flex h-full w-full max-w-content flex-col px-4 sm:px-6">
        <div className="pt-3 lg:pt-6">
          <UpgradeBanner />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10">
          <Sunburst size={56} />
          <h1 className="text-center font-serif text-3xl text-text-primary sm:text-4xl lg:text-5xl">
            {greeting()}, {USER_NAME}
          </h1>

          <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={busy}
                className="card card-hover rounded-md px-4 py-3 text-left text-body-sm text-text-secondary disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl pb-6">
          <Composer onSend={(t) => send(t)} disabled={busy} />
        </div>
      </div>
    </Layout>
  )
}
