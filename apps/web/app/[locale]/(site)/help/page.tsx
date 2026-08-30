import { standingRoute } from '@/content/standing-route'

const route = standingRoute('help', 'help')

export const generateMetadata = route.generateMetadata
export default route.Page
