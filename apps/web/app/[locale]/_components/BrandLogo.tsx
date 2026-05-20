export function BrandLogo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-normal text-slate-950">
      <span className="relative flex h-10 w-10 items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 64 64" className="h-10 w-10" role="img">
          <rect x="5" y="8" width="54" height="48" rx="5" fill="#fffaf0" stroke="#0f172a" strokeWidth="3" />
          <path d="M15 20h16M15 28h12M39 20h10M39 28h10" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="13" y="35" width="16" height="10" rx="2" fill="#309898" stroke="#0f172a" strokeWidth="2" />
          <rect x="35" y="35" width="16" height="10" rx="2" fill="#CB0404" stroke="#0f172a" strokeWidth="2" />
          <text x="21" y="43" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8" fontWeight="800" fill="white">
            DA
          </text>
          <text x="43" y="43" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8" fontWeight="800" fill="white">
            NU
          </text>
          <path
            d="M28 51c2-7 6-12 11-16 2-1 5 1 3 4l-4 6 8-2c3-1 5 3 2 5-7 4-14 7-20 7-3 0-4-2-3-4z"
            fill="#FF9F00"
            stroke="#0f172a"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M34 43l-7 8" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="hidden sm:inline">cumsevoteaza</span>
    </span>
  );
}
