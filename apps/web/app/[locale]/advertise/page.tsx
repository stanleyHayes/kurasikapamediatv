import { standingRoute } from '@/content/standing-route'

const route = standingRoute('advertise', 'advertise')

export const generateMetadata = route.generateMetadata
export default route.Page
