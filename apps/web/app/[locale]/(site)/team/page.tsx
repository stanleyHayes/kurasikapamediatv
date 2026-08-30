import { staticStandingRoute } from '@/content/standing-route'

const route = staticStandingRoute('team', 'team')

export const generateMetadata = route.generateMetadata
export default route.Page
