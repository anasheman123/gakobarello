import { useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import book from "./content";

const DESKTOP_PAGE_WIDTH = 520;
const DESKTOP_PAGE_HEIGHT = 720;
const PAGE_PADDING = 24;
const MOBILE_BREAKPOINT = 768;

function getBookDimensions() {
  if (typeof window === "undefined") {
    return { width: DESKTOP_PAGE_WIDTH, height: DESKTOP_PAGE_HEIGHT, isMobile: false };
  }

  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  if (!isMobile) {
    return { width: DESKTOP_PAGE_WIDTH, height: DESKTOP_PAGE_HEIGHT, isMobile: false };
  }

  const width = Math.max(260, Math.min(window.innerWidth - 28, 380));
  const height = Math.round(width * 1.36);
  return { width, height, isMobile: true };
}

function splitParagraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function splitLongBlockPreservingBreaks(text, target = 900) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const chunks = [];
  let current = "";

  const pushCurrent = () => {
    if (current !== "") {
      chunks.push(current);
      current = "";
    }
  };

  const splitSingleLine = (line, hardTarget = target) => {
    const words = line.split(/\s+/).filter(Boolean);
    const out = [];
    let lineCurrent = "";

    words.forEach((word) => {
      const candidate = lineCurrent ? `${lineCurrent} ${word}` : word;
      if (candidate.length > hardTarget && lineCurrent) {
        out.push(lineCurrent);
        lineCurrent = word;
      } else {
        lineCurrent = candidate;
      }
    });

    if (lineCurrent) out.push(lineCurrent);
    return out;
  };

  lines.forEach((line) => {
    const candidate = current === "" ? line : `${current}\n${line}`;
    if (candidate.length <= target) {
      current = candidate;
      return;
    }

    pushCurrent();

    if (line.length <= target) {
      current = line;
      return;
    }

    splitSingleLine(line, target).forEach((lineChunk) => {
      if (lineChunk.length <= target) {
        chunks.push(lineChunk);
      } else {
        splitSingleLine(lineChunk, Math.max(350, Math.floor(target * 0.66))).forEach((tiny) => {
          chunks.push(tiny);
        });
      }
    });
  });

  pushCurrent();
  return chunks.length > 0 ? chunks : [String(text || "")];
}

function buildFlowBlocks(chapters) {
  const blocks = [];

  chapters.forEach((chapter) => {
    blocks.push({ type: "chapter", text: chapter.title || "Sin título" });
    splitParagraphs(chapter.text).forEach((p) => blocks.push({ type: "paragraph", text: p }));
  });

  return blocks;
}

function createMeasureContainer(pageWidth, pageHeight) {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "-10000px";
  el.style.top = "0";
  el.style.width = `${pageWidth - PAGE_PADDING * 2}px`;
  el.style.height = `${pageHeight - PAGE_PADDING * 2 - 8}px`;
  el.style.overflow = "hidden";
  el.style.fontFamily = '"Merriweather", Georgia, serif';
  el.style.fontSize = "16px";
  el.style.lineHeight = "1.8";
  el.style.padding = "0";
  el.style.margin = "0";
  el.style.boxSizing = "border-box";
  document.body.appendChild(el);
  return el;
}

function renderBlocksForMeasure(container, blocks) {
  container.innerHTML = "";

  blocks.forEach((block) => {
    if (block.type === "chapter") {
      const h = document.createElement("h3");
      h.textContent = block.text;
      h.style.margin = "0 0 14px 0";
      h.style.fontFamily = 'Montserrat, "Segoe UI", sans-serif';
      h.style.fontSize = "24px";
      h.style.lineHeight = "1.2";
      container.appendChild(h);
      return;
    }

    const p = document.createElement("p");
    p.textContent = block.text;
    p.style.margin = "0 0 8px 0";
    p.style.whiteSpace = "pre-wrap";
    container.appendChild(p);
  });
}

function paginateFlow(chapters, pageWidth = DESKTOP_PAGE_WIDTH, pageHeight = DESKTOP_PAGE_HEIGHT) {
  if (!chapters || chapters.length === 0) return [];

  const blocks = buildFlowBlocks(chapters);
  const measure = createMeasureContainer(pageWidth, pageHeight);
  const pages = [];
  let current = [];

  const fits = (candidate) => {
    renderBlocksForMeasure(measure, candidate);
    return measure.scrollHeight <= measure.clientHeight;
  };

  const flush = () => {
    if (current.length > 0) {
      pages.push({ blocks: current });
      current = [];
    }
  };

  const tryPushParagraph = (text) => {
    let remaining = String(text || "");
    if (!remaining) return;

    const fitsWithCurrent = (candidateText) =>
      fits([...current, { type: "paragraph", text: candidateText }]);

    while (remaining.length > 0) {
      if (fitsWithCurrent(remaining)) {
        current.push({ type: "paragraph", text: remaining });
        return;
      }

      let low = 1;
      let high = remaining.length;
      let best = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const probe = remaining.slice(0, mid);
        if (fitsWithCurrent(probe)) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (best === 0) {
        if (current.length > 0) {
          flush();
          continue;
        }
        // Safety fallback: always make progress even if measurement is odd.
        best = Math.min(remaining.length, 120);
      }

      let cut = best;
      const lastBreak = Math.max(remaining.lastIndexOf("\n", best), remaining.lastIndexOf(" ", best));
      if (lastBreak > Math.floor(best * 0.6)) {
        cut = lastBreak;
      }

      const piece = remaining.slice(0, cut).trimEnd();
      if (!piece) {
        // Avoid infinite loops when trim removes everything.
        const hardPiece = remaining.slice(0, best);
        current.push({ type: "paragraph", text: hardPiece });
        remaining = remaining.slice(best);
        continue;
      }

      current.push({ type: "paragraph", text: piece });
      remaining = remaining.slice(cut).replace(/^\s+/, "");
    }
  };

  blocks.forEach((block) => {
    if (block.type === "chapter") {
      if (current.length > 0) flush();
      current.push(block);
      return;
    }

    tryPushParagraph(block.text);
  });

  flush();
  measure.remove();

  return pages;
}

function MediaCard({ item, onOpenImage }) {
  if (item.type === "video") {
    return (
      <figure className="media-card">
        <video controls preload="metadata" src={item.src} />
        <p>{item.caption || ""}</p>
      </figure>
    );
  }

  return (
    <figure className="media-card">
      <button
        type="button"
        className="media-image-button"
        onClick={() => onOpenImage?.(item)}
        aria-label={`Abrir imagen ${item.alt || item.caption || ""}`}
      >
        <img src={item.src} alt={item.alt || "Imagen del libro"} loading="lazy" />
      </button>
      <p>{item.caption || ""}</p>
    </figure>
  );
}

export default function App() {
  const chapterPages = book?.pages || [];
  const media = book?.media || [];
  const visualMedia = media.filter((item) => item.type === "image" || item.type === "video");
  const audioTracks = media.filter((item) => item.type === "audio");
  const downloads = media.filter((item) => item.type === "file");
  const [current, setCurrent] = useState(0);
  const [pages, setPages] = useState([]);
  const [bookSize, setBookSize] = useState(getBookDimensions);
  const [lightboxImage, setLightboxImage] = useState(null);
  const flipBookRef = useRef(null);
  const bookShellRef = useRef(null);

  useEffect(() => {
    const updateSize = () => setBookSize(getBookDimensions());
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    setPages(paginateFlow(chapterPages, bookSize.width, bookSize.height));
  }, [chapterPages, bookSize.width, bookSize.height]);

  useEffect(() => {
    if (!lightboxImage) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setLightboxImage(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxImage]);

  const goPrev = () => {
    flipBookRef.current?.pageFlip()?.flipPrev();
  };

  const goNext = () => {
    flipBookRef.current?.pageFlip()?.flipNext();
  };

  const onFlip = (event) => {
    setCurrent(event.data);
    bookShellRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hasBook = chapterPages.length > 0 && pages.length > 0;

  return (
    <main className="app">
      <header className="hero">
        <h1>{book?.title || "Gakó Barello y Madame Véga"}</h1>
        
      </header>

      <section className="book-shell" aria-label="Libro interactivo" ref={bookShellRef}>
        {!hasBook ? (
          <div className="empty-book">
            <h3>{chapterPages.length === 0 ? "Sin contenido" : "Preparando libro..."}</h3>
            <p>{chapterPages.length === 0 ? "Agregá páginas en content.js" : "Un momento"}</p>
          </div>
        ) : (
          <div className="book-stage">
            <HTMLFlipBook
              ref={flipBookRef}
              width={bookSize.width}
              height={bookSize.height}
              size="fixed"
              maxShadowOpacity={0.35}
              showCover={!bookSize.isMobile}
              mobileScrollSupport={false}
              onFlip={onFlip}
              className="flipbook"
            >
              {pages.map((page, idx) => (
                <div className={`flip-page ${idx === 0 ? "cover-page" : ""}`} key={`flow-${idx}`}>
                  {page.blocks.map((block, bidx) =>
                    block.type === "chapter" ? (
                      <h3 className="chapter-title" key={`c-${idx}-${bidx}`}>
                        {block.text}
                      </h3>
                    ) : (
                      <p key={`p-${idx}-${bidx}`}>{block.text}</p>
                    )
                  )}
                </div>
              ))}
            </HTMLFlipBook>
          </div>
        )}

        <nav className="controls">
          <button type="button" onClick={goPrev} disabled={!hasBook || current === 0}>
            Anterior
          </button>
          <span aria-live="polite">{hasBook ? `${current + 1} / ${pages.length}` : "0 / 0"}</span>
          <button type="button" onClick={goNext} disabled={!hasBook || current === pages.length - 1}>
            Siguiente
          </button>
        </nav>
      </section>

      <section className="media-zone" aria-label="Galería media">
        <div className="media-head">
          <h2>Media</h2>
        </div>

        <div className="media-grid">
          {visualMedia.length === 0 ? (
            <p className="empty-media">No hay archivos de media todavía.</p>
          ) : (
            visualMedia.map((item, idx) => (
              <MediaCard key={idx} item={item} onOpenImage={setLightboxImage} />
            ))
          )}
        </div>
      </section>

      <section className="media-zone" aria-label="Música del libro">
        <div className="media-head">
          <h2>Música</h2>
          
        </div>

        <div className="tracks-grid">
          {audioTracks.length === 0 ? (
            <p className="empty-media">No hay canciones cargadas.</p>
          ) : (
            audioTracks.map((track, idx) => (
              <article className="track-card" key={`${track.src}-${idx}`}>
                <h3>{track.title || track.caption || `Track ${idx + 1}`}</h3>
                <audio controls preload="none" src={track.src} />
              </article>
            ))
          )}
        </div>
      </section>

      <section className="media-zone" aria-label="Descargas">
        <div className="media-head">
          <h2>Descargas</h2>
          <p>Descargá archivos del proyecto.</p>
        </div>

        <div className="downloads-grid">
          {downloads.length === 0 ? (
            <p className="empty-media">No hay archivos para descargar.</p>
          ) : (
            downloads.map((file, idx) => (
              <a className="download-btn" key={`${file.src}-${idx}`} href={file.src} download>
                {file.title || `Descarga ${idx + 1}`}
              </a>
            ))
          )}
        </div>
      </section>

      {lightboxImage ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de imagen"
          onClick={() => setLightboxImage(null)}
        >
          <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setLightboxImage(null)}
              aria-label="Cerrar imagen"
            >
              Cerrar
            </button>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt || lightboxImage.caption || "Imagen ampliada"}
            />
            {lightboxImage.caption ? <p>{lightboxImage.caption}</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
