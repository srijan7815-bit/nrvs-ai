import Layout from '../components/Layout'
import Sunburst from '../components/Sunburst'

/** Generic empty-state page for Library / Projects / Artifacts. */
export default function Placeholder({ title, subtitle }) {
  return (
    <Layout>
      <div className="mx-auto flex h-full w-full max-w-content flex-col items-center justify-center gap-4 px-6 text-center">
        <Sunburst size={44} />
        <h1 className="text-heading-lg font-semibold">{title}</h1>
        <p className="max-w-md text-body text-text-tertiary">{subtitle}</p>
      </div>
    </Layout>
  )
}
