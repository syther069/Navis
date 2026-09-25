"use client";

import { useState } from "react";
import {
  CaretDown,
  CheckCircle,
  MagnifyingGlass,
  Question,
  ShieldWarning,
} from "@phosphor-icons/react";
import Link from "next/link";

import { type FaqItem, FAQ_ITEMS } from "./faq-data";

export function FaqSection({ defaultFilter = "all" }: { defaultFilter?: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultFilter);
  const [expandedId, setExpandedId] = useState<string | null>("what-is-navis");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredItems = FAQ_ITEMS.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="faq-section-container" id="faq" aria-label="Frequently Asked Questions">
      {/* ── FAQ Search & Filter Toolbar ── */}
      <div className="faq-toolbar">
        <div className="faq-search-box">
          <MagnifyingGlass size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search questions or operational boundaries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="faq-search-input"
            aria-label="Search FAQ"
          />
        </div>

        <div className="faq-category-pills" role="tablist" aria-label="FAQ categories">
          {[
            { id: "all", label: "All Questions" },
            { id: "core", label: "Core Architecture" },
            { id: "security", label: "Safety & Control" },
            { id: "integrations", label: "Integrations & Status" },
            { id: "evidence", label: "Proof & Verification" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.id}
              className={`faq-cat-btn ${selectedCategory === cat.id ? "faq-cat-active" : ""}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FAQ Accordion List ── */}
      <div className="faq-accordion-list" role="region" aria-label="FAQ items">
        {filteredItems.length === 0 ? (
          <div className="faq-empty-state">
            <p>No questions matched your search query.</p>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <article
                key={item.id}
                className={`faq-item ${isExpanded ? "faq-item-expanded" : ""}`}
              >
                <button
                  type="button"
                  className="faq-trigger"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`faq-answer-${item.id}`}
                >
                  <span className="faq-question-text">{item.question}</span>
                  <CaretDown
                    className={`faq-caret ${isExpanded ? "faq-caret-rotated" : ""}`}
                    size={16}
                    aria-hidden="true"
                  />
                </button>

                {isExpanded && (
                  <div
                    id={`faq-answer-${item.id}`}
                    className="faq-answer-panel"
                    role="region"
                    aria-labelledby={`faq-question-${item.id}`}
                  >
                    <p className="faq-answer-text">{item.answer}</p>

                    {item.constraintNote ? (
                      <div className="faq-constraint-box">
                        <ShieldWarning size={15} weight="bold" />
                        <div>
                          <strong>Operational Constraint:</strong> {item.constraintNote}
                        </div>
                      </div>
                    ) : null}

                    {item.link ? (
                      <div className="faq-answer-link">
                        <Link className="text-link" href={item.link.href}>
                          {item.link.label} &rarr;
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
