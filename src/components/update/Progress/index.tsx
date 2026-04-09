function clampPct(n: number | undefined): number {
  if (n === undefined || Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, n))
}

export default function Progress({ percent }: { percent?: number }) {
  const p = clampPct(percent)
  const label = `${Math.round(p)}%`

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200/90 dark:bg-zinc-800/90">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-[width] duration-200 ease-out"
          style={{ width: `${p}%` }}
        />
      </div>
      <span className="w-10 shrink-0 tabular-nums text-right text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
    </div>
  )
}
