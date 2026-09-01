export interface AskCopy {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly trust: string
  readonly label: string
  readonly placeholder: string
  readonly action: string
  readonly pending: string
  readonly loading: string
  readonly limited: (seconds: number) => string
  readonly prompt: string
  readonly answer: (count: number) => string
  readonly empty: string
  readonly hint: string
}

const COPY: Record<'en' | 'fr', AskCopy> = {
  en: {
    eyebrow: 'Newsroom assistant',
    title: 'Ask the reporting.',
    description: 'Ask a question in plain language. The assistant searches published Kurasikapa reporting and points you to the evidence; it never invents an answer.', trust: 'Published reporting only · English and French · Sources always shown',
    label: 'Your question', placeholder: 'What has Kurasikapa reported about the economy?', action: 'Ask Kurasikapa', pending: 'Searching', loading: 'Searching the published archive', limited: (seconds) => `Too many questions. Try again in ${String(seconds)} seconds.`, prompt: 'You asked',
    answer: (count) => `I found ${String(count)} published ${count === 1 ? 'report' : 'reports'} that may answer your question. Start with these sources:`,
    empty: 'I could not find published reporting that answers that yet.', hint: 'Try a broader subject or browse the latest newsroom edition.',
  },
  fr: {
    eyebrow: 'Assistant de la rédaction', title: 'Interrogez nos reportages.',
    description: 'Posez une question simplement. L’assistant recherche uniquement les reportages publiés par Kurasikapa et vous conduit vers les sources, sans inventer de réponse.', trust: 'Reportages publiés uniquement · Anglais et français · Sources toujours indiquées',
    label: 'Votre question', placeholder: 'Que rapporte Kurasikapa sur l’économie ?', action: 'Demander à Kurasikapa', pending: 'Recherche', loading: 'Recherche dans les archives publiées', limited: (seconds) => `Trop de questions. Réessayez dans ${String(seconds)} secondes.`, prompt: 'Votre question',
    answer: (count) => `J’ai trouvé ${String(count)} ${count === 1 ? 'article publié' : 'articles publiés'} susceptible${count === 1 ? '' : 's'} de répondre. Consultez ces sources :`,
    empty: 'Je n’ai pas encore trouvé de reportage publié qui réponde à cette question.', hint: 'Essayez un sujet plus général ou consultez les dernières nouvelles.',
  },
}

export function askCopy(locale: string): AskCopy {
  return locale === 'fr' ? COPY.fr : COPY.en
}
