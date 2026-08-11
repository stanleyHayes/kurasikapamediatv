'use client'

import Script from 'next/script'

/**
 * gtag loader. The parent must only mount this after consent is granted.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }): React.ReactElement {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}',{anonymize_ip:true});`}
      </Script>
    </>
  )
}
