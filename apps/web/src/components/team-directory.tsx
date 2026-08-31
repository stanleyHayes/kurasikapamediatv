import Image from 'next/image'
import Link from 'next/link'
import { EmptyState } from '@kurasikapa/ui/empty-state'
import type { StaffProfileView } from '@kurasikapa/web-kit/bff/staff-profiles'

export function TeamDirectory({ locale, profiles }: { locale: string; profiles: readonly StaffProfileView[] }): React.ReactElement {
  if (profiles.length === 0) {
    return <section className="mx-auto max-w-[var(--container-page)] px-4 pb-20 md:px-8"><EmptyState eyebrow="Newsroom directory" title="Meet the newsroom as profiles are verified." description="Named journalists, roles and biographies will appear here only after the newsroom has approved their public profile and portrait." visual={<Image src="/brand-logo-transparent.png" alt="" width={1536} height={1024} className="h-9 w-auto object-contain" />} compact /></section>
  }
  return <section aria-labelledby="newsroom-directory" className="mx-auto max-w-[var(--container-page)] px-4 pb-20 md:px-8 md:pb-28">
    <header className="mb-9 flex flex-wrap items-end justify-between gap-5 border-b-2 border-on-surface pb-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">On the record</p><h2 id="newsroom-directory" className="mt-2 font-display text-4xl font-semibold tracking-[-.04em] md:text-5xl">The people behind the reporting.</h2></div><p className="max-w-sm text-sm leading-relaxed text-on-surface-variant">Every profile is linked to an accountable newsroom identity and published deliberately.</p></header>
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{profiles.map((profile, index) => <ProfileCard key={profile.id} locale={locale} profile={profile} index={index} />)}</div>
  </section>
}

function ProfileCard({ locale, profile, index }: { locale: string; profile: StaffProfileView; index: number }): React.ReactElement {
  return <Link href={`/${locale}/team/${profile.slug}`} className="group [perspective:1200px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary/40">
    <article className="h-full border border-on-surface bg-surface-container-lowest transition-[transform,box-shadow] duration-300 [transform-style:preserve-3d] group-hover:-translate-y-1 group-hover:[transform:rotateX(1.5deg)_rotateY(-1.5deg)] group-hover:shadow-[12px_14px_0_var(--color-primary)]">
      <div className="relative aspect-[4/5] overflow-hidden border-b border-on-surface bg-surface-container"><Image src={profile.portrait.url} alt={profile.portrait.altText || profile.displayName} fill sizes="(min-width:1280px) 28vw, (min-width:768px) 44vw, 92vw" className="object-cover grayscale-[12%] transition duration-500 group-hover:scale-[1.025] group-hover:grayscale-0" /><span className="absolute left-4 top-4 bg-secondary px-3 py-1 font-mono text-xs font-bold text-on-secondary">{String(index + 1).padStart(2, '0')}</span></div>
      <div className="p-6"><p className="text-[.65rem] font-bold uppercase tracking-[.18em] text-primary">{profile.jobTitle}</p><h3 className="mt-3 font-display text-3xl font-semibold tracking-[-.035em]">{profile.displayName}</h3><p className="mt-4 line-clamp-3 leading-relaxed text-on-surface-variant">{profile.biography}</p><span className="mt-6 inline-block border-b-2 border-secondary pb-1 text-sm font-bold">Read profile ↗</span></div>
    </article>
  </Link>
}
