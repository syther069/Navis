import Image from "next/image";

type Capture = {
  src: string;
  title: string;
  caption: string;
};

/**
 * Navis capture deck. Same job as Skiper 48 card carousel, without Swiper,
 * Lucide, or stock illustrations. Uses live product screenshots only.
 */
export function CaptureDeck({ captures }: { captures: readonly Capture[] }) {
  return (
    <div className="navis-capture-deck">
      <ul className="navis-capture-track">
        {captures.map((capture, index) => (
          <li key={capture.src}>
            <figure className="public-capture">
              <div className="public-capture-frame">
                <Image
                  src={capture.src}
                  width={1440}
                  height={900}
                  alt={`${capture.title} screen in the NAVIS product`}
                  sizes="(max-width: 760px) 86vw, 36rem"
                />
              </div>
              <figcaption>
                <span>
                  {String(index + 1).padStart(2, "0")} / {capture.title}
                </span>
                <p>{capture.caption}</p>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
