import { MongoCategoryRepository } from '@kurasikapa/adapter-mongo'
import { Category, categoryId } from '@kurasikapa/domain'
import { mongoDb } from './mongo'

interface SeedSection {
  readonly id: string
  readonly en: string
  readonly fr: string
  readonly enName: string
  readonly frName: string
  readonly enDescription: string
  readonly frDescription: string
}

const SECTIONS: readonly SeedSection[] = [
  { id: 'ghana', en: 'ghana', fr: 'ghana', enName: 'Ghana', frName: 'Ghana', enDescription: 'National and regional reporting from across Ghana.', frDescription: 'Actualités nationales et régionales de tout le Ghana.' },
  { id: 'africa', en: 'africa', fr: 'afrique', enName: 'Africa', frName: 'Afrique', enDescription: 'Politics, people and progress across the continent.', frDescription: 'Politique, société et progrès à travers le continent.' },
  { id: 'world', en: 'world', fr: 'monde', enName: 'World', frName: 'Monde', enDescription: 'International events explained for a Ghanaian audience.', frDescription: 'Les événements internationaux expliqués au public ghanéen.' },
  { id: 'politics', en: 'politics', fr: 'politique', enName: 'Politics', frName: 'Politique', enDescription: 'Power, policy and the people who wield both.', frDescription: 'Le pouvoir, les politiques publiques et ceux qui les exercent.' },
  { id: 'business', en: 'business', fr: 'economie', enName: 'Business', frName: 'Économie', enDescription: 'Markets, trade and the money moving through West Africa.', frDescription: "Marchés, commerce et capitaux à travers l'Afrique de l'Ouest." },
  { id: 'sports', en: 'sports', fr: 'sports', enName: 'Sports', frName: 'Sports', enDescription: 'Results, athletes and the business of the game.', frDescription: 'Résultats, athlètes et économie du sport.' },
  { id: 'education', en: 'education', fr: 'education', enName: 'Education', frName: 'Éducation', enDescription: 'Schools, training and the next generation.', frDescription: 'Écoles, formation et nouvelle génération.' },
  { id: 'health', en: 'health', fr: 'sante', enName: 'Health', frName: 'Santé', enDescription: 'Public health, care and medical research.', frDescription: 'Santé publique, soins et recherche médicale.' },
  { id: 'technology', en: 'technology', fr: 'technologie', enName: 'Technology', frName: 'Technologie', enDescription: 'Connectivity, startups and tools changing daily life.', frDescription: 'Connectivité, startups et outils qui changent le quotidien.' },
  { id: 'culture', en: 'culture', fr: 'culture', enName: 'Culture', frName: 'Culture', enDescription: 'Arts, heritage and the stories Ghana tells itself.', frDescription: 'Arts, patrimoine et récits que le Ghana se raconte.' },
  { id: 'entertainment', en: 'entertainment', fr: 'divertissement', enName: 'Entertainment', frName: 'Divertissement', enDescription: 'Film, music and the creative industries.', frDescription: 'Cinéma, musique et industries créatives.' },
  { id: 'lifestyle', en: 'lifestyle', fr: 'art-de-vivre', enName: 'Lifestyle', frName: 'Art de vivre', enDescription: 'Food, fashion, travel and daily living.', frDescription: 'Cuisine, mode, voyage et vie quotidienne.' },
  { id: 'opinion', en: 'opinion', fr: 'opinion', enName: 'Opinion', frName: 'Opinion', enDescription: 'Arguments from contributors, clearly marked.', frDescription: 'Points de vue de contributeurs, clairement identifiés.' },
  { id: 'editorial', en: 'editorial', fr: 'editorial', enName: 'Editorial', frName: 'Éditorial', enDescription: 'The considered position of the newsroom.', frDescription: 'La position réfléchie de la rédaction.' },
]

export async function seedNavigationSections(): Promise<number> {
  const repository = new MongoCategoryRepository(mongoDb())

  await Promise.all(SECTIONS.map((section, order) => repository.save(Category.reconstitute({
    id: categoryId(`cat_${section.id}`),
    parentId: null,
    slugs: { en: section.en, fr: section.fr },
    names: { en: section.enName, fr: section.frName },
    descriptions: { en: section.enDescription, fr: section.frDescription },
    order: order + 1,
  }))))

  return SECTIONS.length
}
