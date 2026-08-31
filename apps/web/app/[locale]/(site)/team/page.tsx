import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { StandingPageView } from '@/components/standing-page'
import { TeamDirectory } from '@/components/team-directory'
import { pageFor } from '@/content/pages'
import { loadStaffProfiles } from '@kurasikapa/web-kit/bff/staff-profiles'

interface Params { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params; const page = pageFor('team', locale)
  return { title: page.title, description: page.lead, alternates: { canonical: `/${locale}/team` } }
}

export default async function TeamPage({ params }: Params): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const profiles = await loadStaffProfiles(locale)
  return <StandingPageView page={pageFor('team', locale)} pageKey="team" locale={locale}><TeamDirectory locale={locale} profiles={profiles} /></StandingPageView>
}
