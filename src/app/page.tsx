import Link from "next/link";
import { UmakBrand } from "@/components/layout/UmakBrand";

const features = [
  {
    number: "01",
    title: "Bring your sources together",
    description: "Upload documents and links into one focused notebook built for the way you study.",
  },
  {
    number: "02",
    title: "Ask with confidence",
    description: "Have a conversation with your materials and get answers grounded in your own sources.",
  },
  {
    number: "03",
    title: "Turn reading into recall",
    description: "Generate study guides, briefs, flashcards, and quizzes whenever you need them.",
  },
];

export default function Home() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link href="/" aria-label="Herons.AI home">
          <UmakBrand />
        </Link>
        <div className="landing-nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#built-for-you">Why Herons.AI</a>
          <Link className="landing-sign-in" href="/login">
            Sign in
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> A UMak learning companion</p>
          <h1>Your ideas deserve <span>a place to take flight.</span></h1>
          <p className="landing-lead">
            Herons.AI is your private research workspace for reading deeper, asking better questions,
            and turning knowledge into something you can remember.
          </p>
          <div className="landing-actions">
            <Link className="button landing-primary-button" href="/signup">Start exploring <span aria-hidden="true">→</span></Link>
            <Link className="landing-text-link" href="/login">Already have an account? <strong>Sign in</strong></Link>
          </div>
          <p className="landing-note">Exclusively for the UMak community <span aria-hidden="true">·</span> Use your @umak.edu.ph account</p>
        </div>
        <div className="landing-hero-art" aria-hidden="true">
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="hero-sun" />
          <div className="hero-bird">H</div>
          <div className="hero-streak hero-streak-one" />
          <div className="hero-streak hero-streak-two" />
          <div className="hero-art-label">LEARN<br /><strong>WITH PURPOSE</strong></div>
        </div>
      </section>

      <section className="landing-trust" id="built-for-you">
        <p className="eyebrow">Made for the curious</p>
        <h2>A better way to move from <em>source</em> to insight.</h2>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="landing-feature" key={feature.number}>
              <span className="feature-number">{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-workflow" id="how-it-works">
        <div>
          <p className="eyebrow">Your workspace, your pace</p>
          <h2>Less tab-hopping.<br /><span>More meaningful work.</span></h2>
        </div>
        <div className="workflow-steps">
          <div><span>01</span><p>Collect what matters</p></div>
          <div><span>02</span><p>Explore with AI</p></div>
          <div><span>03</span><p>Make it yours</p></div>
        </div>
      </section>

      <footer className="landing-footer">
        <UmakBrand />
        <p>Built for the University of Makati community.</p>
        <Link href="/signup">Create your workspace <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}
