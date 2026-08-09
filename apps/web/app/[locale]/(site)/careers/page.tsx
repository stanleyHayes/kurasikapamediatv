import { standingRoute } from '@/content/standing-route'

const route = standingRoute('careers', 'careers')

export const generateMetadata = route.generateMetadata
export default route.Page
