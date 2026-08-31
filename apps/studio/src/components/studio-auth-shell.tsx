interface Props {
  readonly eyebrow: string
  readonly title: string
  readonly intro: string
  readonly children: React.ReactNode
  readonly asideTitle: string
  readonly asideBody: string
}

export function StudioAuthShell(props: Props): React.ReactElement {
  return (
    <main className="bg-surface-container-low min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.72fr)]">
      <section className="bg-primary text-on-primary relative hidden min-h-screen overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/15" />
        <div className="absolute -bottom-32 left-20 h-96 w-96 rounded-full border border-secondary/30" />
        <p className="relative text-sm font-extrabold uppercase tracking-[0.24em]">Kurasikapa Media TV</p>
        <div className="relative max-w-xl">
          <p className="text-secondary text-xs font-bold uppercase tracking-[0.24em]">Independent newsroom</p>
          <h2 className="mt-5 text-5xl font-extrabold leading-[1.02] xl:text-6xl">{props.asideTitle}</h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/70">{props.asideBody}</p>
        </div>
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Protected editorial workspace</p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="bg-primary text-on-primary grid h-11 w-11 place-items-center text-sm font-black">KM</span>
            <span className="text-sm font-extrabold uppercase tracking-[0.16em]">Kurasikapa Studio</span>
          </div>
          <p className="text-primary text-xs font-bold uppercase tracking-[0.22em]">{props.eyebrow}</p>
          <h1 className="text-on-surface mt-3 text-4xl font-extrabold tracking-tight">{props.title}</h1>
          <p className="text-on-surface-variant mb-9 mt-4 leading-7">{props.intro}</p>
          {props.children}
        </div>
      </section>
    </main>
  )
}
