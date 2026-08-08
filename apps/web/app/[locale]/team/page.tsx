import { standingRoute } from '@/content/standing-route'

const route = standingRoute('team', 'team')

export const generateMetadata = route.generateMetadata
export default route.Page
