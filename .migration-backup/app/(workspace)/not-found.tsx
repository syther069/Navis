import { ArrowLeft, Question } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="empty-state error-state">
      <div className="empty-state-icon">
        <Question aria-hidden="true" size={24} />
      </div>
      <span className="route-eyebrow">404 · Unknown record</span>
      <h1>This Navis route does not exist.</h1>
      <p>
        The requested agent, decision, or proof could not be found. No substitute demo
        record was loaded.
      </p>
      <Link className="secondary-button" href="/agents/atlas">
        <ArrowLeft aria-hidden="true" size={17} /> Return to Atlas
      </Link>
    </section>
  );
}
