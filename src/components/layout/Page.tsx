import type { ReactNode } from 'react';

/** Standard workspace padding + max width for a page. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 sm:px-6 py-5 mx-auto w-full max-w-[1440px] ${className}`}>{children}</div>;
}

/** Sentence-case page title with an optional muted meta line. */
export function PageHeading({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-n-100">{title}</h1>
      {meta && <p className="text-13 text-n-80 mt-0.5">{meta}</p>}
    </div>
  );
}

/** A section heading on the continuous workspace — sentence case, quiet. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-13 font-semibold text-n-90">{children}</h2>
      {action}
    </div>
  );
}
