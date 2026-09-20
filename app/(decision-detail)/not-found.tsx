import { ArrowLeft, Question } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function DecisionNotFound() {
  return (
    <section className="empty-state error-state">
      <div className="empty-state-icon">
        <Question aria-hidden="true" size={24} />
      </div>
      <span className="route-eyebrow">404 · Unknown decision</span>
      <h1>No decision with this id is stored here.</h1>
      <p>
        Demo runs without a database are not persisted, and stored decisions are only
        readable by the wallet that owns the agent. No substitute demo record was
        loaded.
      </p>
      <Link className="secondary-button" href="/agents/atlas">
        <ArrowLeft aria-hidden="true" size={17} /> Run a decision on Atlas
      </Link>
    </section>
  );
}
