import { staticStandingRoute } from '@/content/standing-route'

const route = staticStandingRoute('about', 'about')

export const generateMetadata = route.generateMetadata
export default route.Page
