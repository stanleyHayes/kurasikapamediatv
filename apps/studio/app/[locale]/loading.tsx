import Image from 'next/image'
import { BrandSplash } from '@kurasikapa/ui/brand-splash'

export default function StudioLoading(): React.ReactElement {
  return <BrandSplash label="Opening the editorial workspace" logo={<Image src="/studio/brand-logo-transparent.png" alt="" width={1536} height={1024} className="h-28 w-auto object-contain" priority />} />
}
