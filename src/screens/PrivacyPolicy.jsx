import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => navigate(-1)}
            className="btn-icon h-9 w-9 border-transparent bg-transparent"
            aria-label="Go back"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <h1 className="text-heading-md font-semibold">Privacy Policy</h1>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="mb-6 text-caption text-text-tertiary">
          Last updated: June 2025
        </p>

        <div className="space-y-8 text-body text-text-secondary leading-relaxed">
          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              1. Information We Collect
            </h2>
            <p>
              NRVS collects information you provide directly, including your display name,
              email address (via Google OAuth or magic link), and any API keys or secrets
              you choose to store. We also collect conversation metadata (thread titles,
              timestamps) to power your experience.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              2. How We Use Your Information
            </h2>
            <ul className="list-inside list-disc space-y-2">
              <li>To provide and maintain your NRVS account and conversations</li>
              <li>To personalize responses using your saved memories and preferences</li>
              <li>To power AI features using API keys you have connected</li>
              <li>To communicate with you about your account (when required)</li>
              <li>To improve our services and detect abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              3. Data Storage & Security
            </h2>
            <p>
              Your data is stored in Supabase (PostgreSQL) with Row-Level Security (RLS)
              enforcement — only you can access your own data. API keys and secrets are
              stored encrypted and are never exposed to other users or third parties.
              Memory data is stored under your account and is deletable at any time.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              4. Third-Party Services
            </h2>
            <p>
              NRVS uses third-party services to power AI features. The AI provider (e.g.,
              NVIDIA NIM) receives your messages and conversation context to generate
              responses. Web search (via Tavily) and code execution (via E2B) are used
              only when you explicitly request them. These services have their own
              privacy policies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              5. Data Retention & Deletion
            </h2>
            <p>
              You can delete your account and all associated data at any time from
              Settings. Deleting your account removes your profile, threads, messages,
              memories, and stored secrets. API keys can be individually revoked at
              any time. Data is retained for a reasonable period after deletion for
              backup and compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              6. Cookies
            </h2>
            <p>
              NRVS uses minimal cookies for authentication (Supabase session management)
              and essential functionality. We do not use advertising or tracking cookies.
              See our{' '}
              <a href="/cookies" className="text-accent-blue hover:underline">
                Cookie Policy
              </a>{' '}
              for full details.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              7. Your Rights
            </h2>
            <p>
              You have the right to access, update, or delete your personal data at any
              time through the app. If you have questions about how we handle your data,
              contact us at privacy@nrvs.ai.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be
              posted on this page with an updated revision date. Continued use of NRVS
              after changes constitutes acceptance of the new policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              9. Contact
            </h2>
            <p>
              For privacy concerns, contact us at{' '}
              <a href="mailto:privacy@nrvs.ai" className="text-accent-blue hover:underline">
                privacy@nrvs.ai
              </a>
              .
            </p>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-body-sm text-text-tertiary">
          <a href="/terms" className="hover:text-text-secondary hover:underline">
            Terms of Service
          </a>
          <span>·</span>
          <a href="/cookies" className="hover:text-text-secondary hover:underline">
            Cookie Policy
          </a>
        </div>
      </div>
    </div>
  )
}