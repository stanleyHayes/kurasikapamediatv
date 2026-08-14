import Image from 'next/image'
import { BrandSplash } from '@kurasikapa/ui/brand-splash'

export default function Loading(): React.ReactElement {
  return <BrandSplash label="Loading the latest edition" logo={<Image src="/brand-logo-transparent.png" alt="" width={1536} height={1024} className="h-28 w-auto object-contain" priority />} />
}
