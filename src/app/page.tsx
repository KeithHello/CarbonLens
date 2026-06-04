import Link from "next/link";

const FEATURES = [
  {
    icon: "🗣️",
    title: "Natural Activity Recording",
    desc: "Describe daily activity in plain English with text or voice. CarbonLens turns it into structured carbon records.",
  },
  {
    icon: "🌐",
    title: "Global Benchmarking",
    desc: "Compare each entry with global, national, and personal baselines using clear visual feedback.",
  },
  {
    icon: "💡",
    title: "Actionable Reduction Tips",
    desc: "Get concrete, personalized suggestions and track which actions you decided to adopt.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Record by text or voice",
    desc: "Write or say what you did today.",
  },
  {
    step: "2",
    title: "Review your footprint",
    desc: "The Agent calculates emissions and explains the sources.",
  },
  {
    step: "3",
    title: "Act on suggestions",
    desc: "Adopt small changes and watch your footprint trend improve.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 via-white to-white">
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            AI carbon tracking for everyday decisions
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-950 sm:text-6xl">
            See the carbon impact of what you did today
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            CarbonLens uses a multi-agent ADK workflow, MongoDB emission factors,
            and Gemini Flash to turn natural language activity records into clear
            carbon reports and practical reduction guidance.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/record" className="btn-primary text-center">
              Start recording
            </Link>
            <Link href="/insights" className="btn-outline text-center">
              View demo history
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-4">
          {[
            { value: "70+", label: "Emission factors" },
            { value: "5", label: "Benchmark regions" },
            { value: "200+", label: "Demo records" },
            { value: "ADK", label: "Agent workflow" },
          ].map((stat) => (
            <div key={stat.label} className="card p-5 text-center">
              <p className="text-3xl font-extrabold text-primary">{stat.value}</p>
              <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-gray-950 sm:text-3xl">
          Why CarbonLens?
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="card-hover p-6">
              <div className="text-3xl">{feature.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-gray-950">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{feature.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-gray-950 sm:text-3xl">
          Three-step flow
        </h2>
        <div className="mt-8 space-y-4">
          {STEPS.map((step) => (
            <div key={step.step} className="card flex items-start gap-4 p-5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 font-bold text-primary">
                {step.step}
              </span>
              <div>
                <h3 className="font-semibold text-gray-950">{step.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/record" className="btn-primary inline-block">
            Try CarbonLens
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 px-4 py-8 text-center text-sm text-gray-500">
        Built with Gemini Flash, MongoDB MCP, and Google ADK Agent Platform.
      </footer>
    </main>
  );
}
