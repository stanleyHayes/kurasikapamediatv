import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const size = { width: 1200, height: 630 }

export function GET(request: Request): ImageResponse {
  const url = new URL(request.url)
  const title = clean(url.searchParams.get('title')) || 'Journalism that informs, educates and motivates.'
  const section = clean(url.searchParams.get('section')) || 'Kurasikapa Media TV'

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#f7f4eb', color: '#10251a', fontFamily: 'Arial, sans-serif', padding: 64 }}>
      <div style={{ display: 'flex', width: '100%', border: '4px solid #10251a', boxShadow: '16px 16px 0 #f3b61f' }}>
        <div style={{ width: 250, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#087f23', color: '#fff', padding: '46px 38px' }}>
          <div style={{ width: 92, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #fff', borderRadius: 46, fontSize: 58, fontWeight: 900 }}>K</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 25, fontWeight: 800 }}>Kurasikapa</span>
            <span style={{ fontSize: 17, letterSpacing: 2.4, textTransform: 'uppercase' }}>Media TV</span>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 58px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#087f23', fontSize: 20, fontWeight: 800, letterSpacing: 2.2, textTransform: 'uppercase' }}>
            <span style={{ width: 38, height: 5, display: 'flex', background: '#f3b61f' }} />{section}
          </div>
          <div style={{ display: 'flex', fontSize: title.length > 82 ? 45 : 55, lineHeight: 1.04, letterSpacing: -2.2, fontWeight: 900, maxWidth: 760 }}>{title}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '3px solid #10251a', paddingTop: 18, fontSize: 18, fontWeight: 700 }}>
            <span>kurasikapa.tv</span><span>Television · News · Community</span>
          </div>
        </div>
      </div>
    </div>,
    size,
  )
}

function clean(value: string | null): string {
  return value?.trim().slice(0, 140) ?? ''
}
