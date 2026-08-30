/**
 * Editorial copy for the standing pages.
 *
 * Content, not markup — so a translation is a data change and the same
 * renderer serves every page. Sourced from the signed discovery
 * questionnaire; nothing here is invented about the client.
 *
 * These become CMS-managed in R2 (questionnaire § 5, "Custom Page(s)"). Until
 * then they live in the repo, which is honest: they change rarely and a
 * half-built page builder would be worse than a file.
 */
export interface Section {
  readonly heading?: string
  readonly paragraphs: readonly string[]
  readonly bullets?: readonly { term: string; detail: string }[]
}

export interface StandingPage {
  readonly title: string
  readonly lead?: string
  readonly sections: readonly Section[]
  /** Shown where copy is provisional and needs the client's own words. */
  readonly needsClientCopy?: boolean
  /**
   * Renders the title as a full-bleed display hero rather than a page heading.
   *
   * Only for the pages whose designs call for one — About and Team. Applying
   * it everywhere would give a cookie policy the same weight as the masthead,
   * which is the sort of thing that makes a design system feel arbitrary.
   */
  readonly hero?: boolean
  readonly body?: string
}

export type PageKey =
  | 'about'
  | 'team'
  | 'contact'
  | 'help'
  | 'faq'
  | 'advertise'
  | 'careers'
  | 'privacy'
  | 'terms'
  | 'cookies'

type Catalogue = Readonly<Record<string, Readonly<Record<PageKey, StandingPage>>>>

const EN: Readonly<Record<PageKey, StandingPage>> = {
  about: {
    title: 'About Kurasikapa Media TV',
    hero: true,
    lead: 'Media as a tool for empowerment, education and social impact — not entertainment alone.',
    sections: [
      {
        paragraphs: [
          'Kurasikapa Media TV is a forward-thinking media production company committed to shaping opinions, informing the public and influencing society positively. We specialise in producing quality television and digital content that educates, motivates and entertains audiences around the world.',
          'Our focus lies in TV production — developing programmes that connect with people and inspire transformation through storytelling and information sharing.',
        ],
      },
      {
        heading: 'Mission',
        paragraphs: [
          'To bring the best experience to our viewers through educational, motivational and social content, reflecting our commitment to excellence and authenticity.',
        ],
      },
      {
        heading: 'Vision',
        paragraphs: [
          'To become a leading global brand known for creativity, quality and empowerment through our diverse and impactful content.',
        ],
      },
      {
        heading: 'Our values',
        paragraphs: [],
        bullets: [
          { term: 'Respect', detail: 'We treat everyone with dignity, fairness and understanding.' },
          { term: 'Integrity', detail: 'We uphold honesty and transparency in all our productions.' },
          { term: 'Creativity', detail: 'We continuously explore innovative ways to tell stories.' },
          { term: 'Excellence', detail: 'We strive to deliver the highest quality in everything we do.' },
        ],
      },
    ],
  },

  team: {
    title: 'Our Team',
    hero: true,
    lead: 'The editorial board and journalists behind Kurasikapa Media TV.',
    needsClientCopy: true,
    sections: [
      {
        paragraphs: [
          'Our newsroom brings together editors, reporters, producers and audience specialists around one standard: make every story useful, fair and accountable. Individual bylines connect each published article to the journalist responsible for it.',
        ],
      },
    ],
  },

  contact: {
    title: 'Contact',
    sections: [
      {
        heading: 'Newsroom',
        paragraphs: ['kurasikapamediatv@yahoo.com'],
      },
      {
        heading: 'Office',
        paragraphs: ['4 Rue des Lys, 95190 Goussainville, France'],
      },
      {
        heading: 'Corrections',
        paragraphs: [
          'If you believe we have published something inaccurate, write to the newsroom address above. We correct the record openly — every article carries its revision history internally, and corrections are noted on the page.',
        ],
      },
    ],
  },

  help: {
    title: 'Help centre',
    lead: 'Practical guidance for reading, accounts, newsletters and contacting the newsroom.',
    sections: [
      {
        paragraphs: [
          'Find answers about using Kurasikapa Media TV, managing your account and getting support from our team.',
        ],
      },
    ],
  },

  faq: {
    title: 'Frequently asked questions',
    sections: [
      {
        heading: 'Do you use AI to write articles?',
        paragraphs: [
          'We use AI to assist our journalists — suggesting headlines, checking grammar, proposing tags and drafting translations. Every suggestion is reviewed and accepted by a named human editor before publication. Nothing reaches this site without a person deciding it should.',
        ],
      },
      {
        heading: 'In which languages do you publish?',
        paragraphs: [
          'English and French today. Each language is edited and published separately, so a translation is a piece of journalism in its own right rather than a machine rendering of another.',
        ],
      },
      {
        heading: 'How do I report an error?',
        paragraphs: ['Write to the newsroom — see the Contact page.'],
      },
    ],
  },

  advertise: {
    title: 'Advertise with us',
    lead: 'Reach an audience that comes to us for information they act on.',
    needsClientCopy: true,
    sections: [
      {
        paragraphs: [
          'We offer display placements, sponsored features and partnership packages across our television, digital and podcast output. Rates, formats and audience figures are available on request.',
          'To discuss a campaign, write to kurasikapamediatv@yahoo.com.',
        ],
      },
    ],
  },

  careers: {
    title: 'Careers',
    needsClientCopy: true,
    sections: [
      {
        paragraphs: [
          'We are always interested in hearing from journalists, producers, editors and technologists who share our values. Send a short note and your work to kurasikapamediatv@yahoo.com.',
        ],
      },
    ],
  },

  privacy: {
    title: 'Privacy policy',
    needsClientCopy: true,
    sections: [
      {
        paragraphs: [
          'Kurasikapa Media TV is registered in France and processes personal data under the EU General Data Protection Regulation. This page describes what we collect and why.',
        ],
      },
      {
        heading: 'What we collect',
        paragraphs: [],
        bullets: [
          { term: 'Account data', detail: 'Your email address and name, if you create an account.' },
          { term: 'Reading activity', detail: 'Which articles you open, retained for at most 400 days.' },
          { term: 'Technical data', detail: 'Standard server logs needed to operate and secure the site.' },
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'You may request access to, correction of, or erasure of your personal data at any time by writing to the newsroom address on our Contact page. We respond within one month.',
        ],
      },
      {
        heading: 'Where your data is held',
        paragraphs: ['In the European Union.'],
      },
    ],
  },

  terms: {
    title: 'Terms and conditions',
    needsClientCopy: true,
    sections: [
      {
        paragraphs: [
          'By using this site you agree to these terms. Our journalism is protected by copyright; you may link to and quote it with attribution, but not republish it in full without permission.',
          'We aim for accuracy and correct errors openly. Content is provided for information and does not constitute professional advice.',
        ],
      },
    ],
  },

  cookies: {
    title: 'Cookies policy',
    needsClientCopy: true,
    sections: [
      {
        paragraphs: [
          'We use a small number of cookies. Those required to sign in and keep you signed in are essential and cannot be turned off. Any analytics or marketing cookies are set only with your consent, which you may withdraw at any time.',
        ],
      },
    ],
  },
}

/**
 * French falls back to English until the client supplies translations.
 *
 * Deliberately not machine-translated: legal text and a company's own
 * description of itself are the two places where a plausible-sounding
 * approximation is most damaging.
 */
export const PAGES: Catalogue = { en: EN, fr: EN }

export const pageFor = (key: PageKey, locale: string): StandingPage =>
  (PAGES[locale] ?? PAGES['en'])?.[key] ?? EN[key]
