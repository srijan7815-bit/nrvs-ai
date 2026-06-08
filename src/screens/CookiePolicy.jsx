import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function CookiePolicy() {
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
          <h1 className="text-heading-md font-semibold">Cookie Policy</h1>
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
              1. What Are Cookies?
            </h2>
            <p>
              Cookies are small text files stored on your device when you visit a
              website. They help websites remember your preferences and improve your
              experience. This policy explains how NRVS uses cookies and similar
              technologies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              2. Cookies We Use
            </h2>
            <p>
              NRVS uses a minimal set of cookies, all of which are essential for the
              service to function:
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium text-text-primary">Cookie</th>
                    <th className="pb-2 font-medium text-text-primary">Purpose</th>
                    <th className="pb-2 font-medium text-text-primary">Duration</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-text-tertiary">Session cookie</td>
                    <td className="py-2 pr-4">Authentication (Supabase auth)</td>
                    <td className="py-2 pr-4">Session</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 text-text-tertiary">Remember preferences</td>
                    <td className="py-2 pr-4">Theme, font, and display preferences</td>
                    <td className="py-2 pr-4">1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              3. What We Don't Use
            </h2>
            <p>
              NRVS does <strong className="font-medium text-text-primary">not</strong> use:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Advertising or tracking cookies</li>
              <li>Third-party analytics cookies</li>
              <li>Cookies from advertising networks</li>
              <li>Social media tracking pixels (unless you use social login)</li>
              <li>Cross-site tracking cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              4. Local Storage
            </h2>
            <p>
              In addition to cookies, NRVS uses browser localStorage to store:
              conversation threads, display preferences, MCP server configurations,
              and memory data (when not signed in). This data stays on your device
              and is not transmitted to our servers unless you are signed in.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              5. Google OAuth
            </h2>
            <p>
              If you sign in with Google, Google's authentication system may set
              cookies as part of the OAuth flow. These are governed by Google's
              privacy policy and terms, not this Cookie Policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              6. Managing Cookies
            </h2>
            <p>
              You can manage or delete cookies through your browser settings. Most
              browsers allow you to block cookies, delete existing cookies, or only
              allow cookies from certain websites. Note that blocking essential cookies
              may prevent NRVS from functioning correctly.
            </p>
            <p className="mt-2">
              To manage your NRVS-specific preferences (theme, font, etc.), use the
              Settings page within the app rather than browser cookie controls.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              7. Updates to This Policy
            </h2>
            <p>
              We may update this Cookie Policy from time to time. Any changes will be
              posted on this page with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-heading-md font-semibold text-text-primary">
              8. Contact
            </h2>
            <p>
              For questions about our use of cookies, contact us at{' '}
              <a href="mailto:privacy@nrvs.ai" className="text-accent-blue hover:underline">
                privacy@nrvs.ai
              </a>
              .
            </p>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-body-sm text-text-tertiary">
          <a href="/privacy" className="hover:text-text-secondary hover:underline">
            Privacy Policy
          </a>
          <span>·</span>
          <a href="/terms" className="hover:text-text-secondary hover:underline">
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  )
}