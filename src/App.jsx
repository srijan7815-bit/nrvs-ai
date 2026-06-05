import { Routes, Route } from 'react-router-dom'
import Home from './screens/Home'
import Thread from './screens/Thread'
import Settings from './screens/Settings'
import Placeholder from './screens/Placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/thread/:id" element={<Thread />} />
      <Route
        path="/library"
        element={
          <Placeholder
            title="Library"
            subtitle="Your saved prompts, files, and references live here."
          />
        }
      />
      <Route
        path="/projects"
        element={
          <Placeholder
            title="Projects"
            subtitle="Group related threads and artifacts into projects."
          />
        }
      />
      <Route
        path="/artifacts"
        element={
          <Placeholder
            title="Artifacts"
            subtitle="Generated documents, code, and assets appear here."
          />
        }
      />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
