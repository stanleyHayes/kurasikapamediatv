import { standingRoute } from '@/content/standing-route'

const route = standingRoute('about', 'about')

export const generateMetadata = route.generateMetadata
export default route.Page
