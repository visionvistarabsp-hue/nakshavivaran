export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-4 px-4 shrink-0 bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-black"
            style={{ background: "var(--gradient-1)", color: "#000" }}>
            NV
          </div>
          <span>© {new Date().getFullYear()} Naksha Vivaran. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Powered by Supabase</span>
          <span className="w-1 h-1 rounded-full bg-[var(--border-light)]" />
          <span>Built with Next.js</span>
        </div>
      </div>
    </footer>
  );
}
