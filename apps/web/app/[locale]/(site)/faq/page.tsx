import { standingRoute } from '@/content/standing-route'

const route = standingRoute('faq', 'faq')

export const generateMetadata = route.generateMetadata
export default route.Page
