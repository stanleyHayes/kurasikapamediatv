import { staticStandingRoute } from '@/content/standing-route'

const route = staticStandingRoute('advertise', 'advertise')

export const generateMetadata = route.generateMetadata
export default route.Page
