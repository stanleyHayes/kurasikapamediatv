import { setRequestLocale } from 'next-intl/server'
import { CreateStoryForm } from '@/components/create-story-form'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'

export default async function NewStoryPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  await requireActor()
  const sections = (await Promise.all(['en', 'fr'].map(async (language) => ({ language, items: await container().listSections.execute({ locale: language }) })))).flatMap(({ language, items }) => items.map((section) => ({ id: section.id, locale: language, name: section.nameIn(language) })))
  return <div className="mx-auto max-w-5xl space-y-7 pb-20"><header className="border-b-2 border-on-surface pb-6"><p className="broadcast-kicker text-primary">News desk</p><h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight md:text-5xl">Create an original news story.</h1><p className="mt-4 max-w-2xl leading-relaxed text-on-surface-variant">Report directly for Kurasikapa, then move the story through the newsroom’s draft, review, approval and publishing workflow.</p></header><CreateStoryForm categories={sections} initialLocale={locale} /></div>
}
