import { standingRoute } from '@/content/standing-route'

const route = standingRoute('contact', 'contact')

export const generateMetadata = route.generateMetadata
export default route.Page
