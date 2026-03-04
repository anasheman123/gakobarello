(function () {
  const data = window.BOOK_CONTENT || { title: "Mi Librito", pages: [], media: [] };
  const titleEl = document.getElementById("book-title");
  const pageEl = document.getElementById("page");
  const indicatorEl = document.getElementById("page-indicator");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const mediaGrid = document.getElementById("media-grid");

  let current = 0;

  titleEl.textContent = data.title || "Mi Librito";

  function splitParagraphs(text) {
    return String(text || "")
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
  }

  function renderPage(direction) {
    const page = data.pages[current];
    if (!page) {
      pageEl.innerHTML = "<h3>Sin contenido</h3><p>Agregá páginas en content.js</p>";
      indicatorEl.textContent = "0 / 0";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

    pageEl.classList.remove("turn-next", "turn-prev");
    pageEl.innerHTML = "";

    const heading = document.createElement("h3");
    heading.textContent = page.title || "Sin título";
    pageEl.appendChild(heading);

    const paragraphs = splitParagraphs(page.text);
    if (paragraphs.length === 0) {
      const emptyText = document.createElement("p");
      emptyText.textContent = "Página sin texto.";
      pageEl.appendChild(emptyText);
    } else {
      paragraphs.forEach((paragraph) => {
        const p = document.createElement("p");
        p.textContent = paragraph;
        pageEl.appendChild(p);
      });
    }

    if (direction === "next") pageEl.classList.add("turn-next");
    if (direction === "prev") pageEl.classList.add("turn-prev");

    indicatorEl.textContent = `${current + 1} / ${data.pages.length}`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === data.pages.length - 1;
  }

  function renderMedia() {
    if (!data.media || data.media.length === 0) {
      mediaGrid.innerHTML = '<p class="empty-media">No hay archivos de media todavía.</p>';
      return;
    }

    mediaGrid.innerHTML = data.media
      .map((item) => {
        if (item.type === "video") {
          return `
            <figure class="media-card">
              <video controls preload="metadata" src="${item.src}"></video>
              <p>${item.caption || ""}</p>
            </figure>
          `;
        }

        return `
          <figure class="media-card">
            <img src="${item.src}" alt="${item.alt || "Imagen del libro"}" loading="lazy" />
            <p>${item.caption || ""}</p>
          </figure>
        `;
      })
      .join("");
  }

  prevBtn.addEventListener("click", () => {
    if (current > 0) {
      current -= 1;
      renderPage("prev");
    }
  });

  nextBtn.addEventListener("click", () => {
    if (current < data.pages.length - 1) {
      current += 1;
      renderPage("next");
    }
  });

  renderPage();
  renderMedia();
})();
