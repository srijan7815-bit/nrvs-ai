/** "Get more with NRVS Pro" banner with an Upgrade link (Accent Blue). */
export default function UpgradeBanner({ className = '' }) {
  return (
    <div
      className={`flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3 ${className}`}
    >
      <span className="text-body text-text-secondary">
        Get more with NRVS Pro
      </span>
      <button className="text-body font-medium text-accent-blue transition-opacity hover:opacity-80">
        Upgrade
      </button>
    </div>
  )
}
