import Layout from '../components/Layout'
import Wordmark from '../components/Wordmark'

/** Generic empty-state page for Library / Projects / Artifacts. */
export default function Placeholder({ title, subtitle }) {
  return (
    <Layout>
      <div className="mx-auto flex h-full w-full max-w-content flex-col items-center justify-center gap-4 px-6 text-center">
        <Wordmark className="text-4xl" />
        <h1 className="text-heading-lg font-semibold">{title}</h1>
        <p className="max-w-md text-body text-text-tertiary">{subtitle}</p>
      </div>
    </Layout>
  )
}
