import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { loadStaffProfileBySlug } from '@kurasikapa/web-kit/bff/staff-profiles'

interface Params { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params; const profile = await loadStaffProfileBySlug(locale, slug)
  if (profile === null) return { title: 'Profile not found', robots: { index: false } }
  return { title: `${profile.displayName} — ${profile.jobTitle}`, description: profile.biography, alternates: { canonical: `/${locale}/team/${profile.slug}` }, openGraph: { type: 'profile', title: profile.displayName, description: profile.biography, images: [{ url: profile.portrait.url, width: profile.portrait.width, height: profile.portrait.height, alt: profile.portrait.altText }] } }
}

export default async function StaffProfilePage({ params }: Params): Promise<React.ReactElement> {
  const { locale, slug } = await params; setRequestLocale(locale)
  const profile = await loadStaffProfileBySlug(locale, slug)
  if (profile === null) notFound()
  const person = { '@context': 'https://schema.org', '@type': 'Person', name: profile.displayName, jobTitle: profile.jobTitle, description: profile.biography, image: profile.portrait.url, sameAs: profile.socialLinks.map((link) => link.url) }
  return <article className="paper-noise min-h-screen border-b-2 border-on-surface bg-surface"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(person).replace(/</gu, '\\u003c') }} /><div className="mx-auto grid max-w-[var(--container-page)] gap-0 border-x border-on-surface lg:grid-cols-[minmax(20rem,.8fr)_minmax(0,1.2fr)]"><div className="relative min-h-[32rem] border-b border-on-surface bg-surface-container lg:min-h-[48rem] lg:border-b-0 lg:border-r"><Image src={profile.portrait.url} alt={profile.portrait.altText || profile.displayName} fill priority sizes="(min-width:1024px) 42vw, 100vw" className="object-cover" /></div><div className="flex flex-col justify-between p-7 md:p-12 lg:p-16"><div><Link href={`/${locale}/team`} className="text-xs font-bold uppercase tracking-[.2em] text-primary">← Newsroom directory</Link><p className="mt-16 text-xs font-bold uppercase tracking-[.2em] text-secondary-ink">{profile.jobTitle}</p><h1 className="mt-4 max-w-[10ch] font-display text-[clamp(3.8rem,8vw,7.5rem)] font-semibold leading-[.84] tracking-[-.07em]">{profile.displayName}</h1><p className="mt-10 max-w-[55ch] text-xl leading-[1.7] text-on-surface-variant">{profile.biography}</p></div><footer className="mt-14 border-t-2 border-on-surface pt-6"><p className="text-[.65rem] font-bold uppercase tracking-[.18em] text-on-surface-variant">Verified public links</p><div className="mt-4 flex flex-wrap gap-3">{profile.socialLinks.map((link) => <a key={link.url} href={link.url} rel="me noopener noreferrer" target="_blank" className="border border-on-surface px-4 py-2 text-sm font-bold transition-colors hover:bg-on-surface hover:text-surface">{link.label} ↗</a>)}</div></footer></div></div></article>
}
