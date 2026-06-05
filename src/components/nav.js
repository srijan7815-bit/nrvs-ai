import {
  MessageCircle,
  Library,
  FolderOpen,
  LayoutGrid,
} from 'lucide-react'

/**
 * Primary sidebar nav.
 * Per spec: rename "Chat" -> "Thread", and add "Library" between Thread and Projects.
 * Order: Thread, Library, Projects, Artifacts.
 */
export const navItems = [
  { id: 'thread', label: 'Thread', icon: MessageCircle, to: '/' },
  { id: 'library', label: 'Library', icon: Library, to: '/library' },
  { id: 'projects', label: 'Projects', icon: FolderOpen, to: '/projects' },
  { id: 'artifacts', label: 'Artifacts', icon: LayoutGrid, to: '/artifacts' },
]

export const MODEL_NAME = 'Sonnet 4.6'
export const USER_NAME = 'Bachira'
export const USER_INITIAL = 'B'
