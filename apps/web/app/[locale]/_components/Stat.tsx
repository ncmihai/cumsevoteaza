export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-l border-slate-300 px-4 first:border-l-0">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}
