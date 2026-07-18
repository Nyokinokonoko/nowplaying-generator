document.addEventListener("DOMContentLoaded", () => {
  // --- Configuration ---
  const config = {
    imageTitle: "MAIN TITLE",
    imageSubtitle: "Subtitle text here",
    coverArt: null,
    backdrop: null,
    colorBackground: "#0d0e12",
    colorOverlay: "#05060a",
    colorTitle: "#FFFFFF",
    colorSubtitle: "#B9B9C6",
    colorSongText: "#F4F4F6",
    colorComment: "#9A9AA6",
    songs: [
      {
        title: "Song Title",
        artist: "Artist Name",
        comment: "Comment text here (optional)",
      },
    ],
    noCoverMode: false,
  };

  // Canvas font stack: Inter for clean Latin, Noto Sans JP for CJK glyphs.
  const CANVAS_FONT = `"Inter", "Noto Sans JP", sans-serif`;

  // --- UI Elements ---
  const canvas = document.getElementById("previewCanvas");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.width * dpr;
  canvas.height = canvas.height * dpr;
  ctx.scale(dpr, dpr);

  const titleInput = document.getElementById("imageTitle");
  const subtitleInput = document.getElementById("imageSubtitle");
  const noCoverModeCheckbox = document.getElementById("noCoverMode");
  const songListEl = document.getElementById("songList");
  const addSongBtn = document.getElementById("addSongBtn");
  const toggleCollapseBtn = document.getElementById("toggleCollapseBtn");
  const downloadBtn = document.getElementById("downloadBtn");

  const colorInputs = {
    colorBackground: document.getElementById("colorBackground"),
    colorOverlay: document.getElementById("colorOverlay"),
    colorTitle: document.getElementById("colorTitle"),
    colorSubtitle: document.getElementById("colorSubtitle"),
    colorSongText: document.getElementById("colorSongText"),
    colorComment: document.getElementById("colorComment"),
  };

  // --- Initialization ---
  function init() {
    // Setup Drag and Drop for Images
    setupDropZone("coverDropZone", "coverInput", "coverPreview", (img) => {
      config.coverArt = img;
      drawCanvas();
    });
    setupDropZone(
      "backdropDropZone",
      "backdropInput",
      "backdropPreview",
      (img) => {
        config.backdrop = img;
        drawCanvas();
      }
    );

    // Setup Sortable for Song List
    new Sortable(songListEl, {
      handle: ".song-handle",
      animation: 150,
      onEnd: updateSongsFromDOM,
    });

    // Event Listeners
    titleInput.addEventListener("input", (e) => {
      config.imageTitle = e.target.value;
      drawCanvas();
    });
    subtitleInput.addEventListener("input", (e) => {
      config.imageSubtitle = e.target.value;
      drawCanvas();
    });

    if (noCoverModeCheckbox) {
      config.noCoverMode = !!noCoverModeCheckbox.checked;
      noCoverModeCheckbox.addEventListener("change", (e) => {
        config.noCoverMode = e.target.checked;
        drawCanvas();
      });
    }

    // Color Inputs
    Object.keys(colorInputs).forEach((key) => {
      colorInputs[key].addEventListener("input", (e) => {
        config[key] = e.target.value;
        drawCanvas();
      });
    });

    addSongBtn.addEventListener("click", () => {
      addSongToDOM();
      updateSongsFromDOM();
    });

    toggleCollapseBtn.addEventListener("click", () => {
      const items = songListEl.querySelectorAll(".song-item");
      let hasExpanded = false;
      items.forEach((item) => {
        const inputs = item.querySelector(".song-inputs");
        if (!inputs.classList.contains("hidden")) {
          hasExpanded = true;
        }
      });

      items.forEach((item) => {
        const inputs = item.querySelector(".song-inputs");
        const btn = item.querySelector(".collapse-song");
        if (hasExpanded) {
          // Collapse All
          inputs.classList.add("hidden");
          btn.classList.add("is-collapsed");
        } else {
          // Expand All
          inputs.classList.remove("hidden");
          btn.classList.remove("is-collapsed");
        }
      });
    });
    downloadBtn.addEventListener("click", downloadImage);

    // Initial Render
    renderSongList();
    // Explicitly load the canvas fonts (Noto Sans JP isn't used in the DOM,
    // so it won't download on its own) and redraw once they're ready.
    const fontsToLoad = [
      `bold 80px "Inter"`,
      `normal 18px "Inter"`,
      `bold 80px "Noto Sans JP"`,
      `normal 18px "Noto Sans JP"`,
    ];
    Promise.all(
      fontsToLoad.map((f) => document.fonts.load(f).catch(() => {}))
    ).then(() => drawCanvas());
    document.fonts.ready.then(() => drawCanvas());
  }

  // --- CANVAS LOGIC (Ported from canvasGenerator.js) ---
  function drawCanvas() {
    const width = 1920;
    const height = 1080;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // Layout Constants
    const HEADER_HEIGHT = 120;
    const LIST_START_Y = 170;
    const TEXT_START_X = 900;
    const TEXT_MAX_WIDTH = 950;
    const ITEM_SPACING = 25;
    const TITLE_COMMENT_GAP = 12;
    const MIN_COMMENT_HEIGHT = 10;
    const FONT_SIZE_NUM = 42;
    const FONT_SIZE_TITLE = 40;
    const FONT_SIZE_COMMENT = 18;
    const LH_NUM = 48;
    const LH_TITLE = 50;
    const LH_COMMENT = 26;
    const ACCENT = "#8577ff";

    // 1. Draw Backdrop
    if (config.backdrop) {
      drawImageCover(ctx, config.backdrop, width, height);
    } else {
      ctx.fillStyle = config.colorBackground;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Gradient Overlay
    const rgb = hexToRgb(config.colorOverlay) || { r: 0, g: 0, b: 0 };
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
    gradient.addColorStop(0.35, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`);
    gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.72)`);
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.92)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 3. Header Bar (translucent dark with accent tick + underline)
    ctx.fillStyle = "rgba(10, 10, 14, 0.82)";
    ctx.fillRect(0, 0, width, HEADER_HEIGHT);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(0, 0, 8, HEADER_HEIGHT); // left accent tick
    ctx.fillRect(0, HEADER_HEIGHT - 3, width, 3); // accent underline

    const supportsLetterSpacing = "letterSpacing" in ctx;

    // Header Title
    ctx.fillStyle = config.colorTitle;
    ctx.font = `bold 80px ${CANVAS_FONT}`;
    ctx.textBaseline = "middle";
    if (supportsLetterSpacing) ctx.letterSpacing = "2px";
    ctx.fillText(config.imageTitle, 50, HEADER_HEIGHT / 2);
    const titleWidth = ctx.measureText(config.imageTitle).width;
    if (supportsLetterSpacing) ctx.letterSpacing = "0px";

    // Header Subtitle
    ctx.fillStyle = config.colorSubtitle;
    ctx.font = `bold 24px ${CANVAS_FONT}`;
    ctx.fillText(
      config.imageSubtitle,
      50 + titleWidth + 30,
      HEADER_HEIGHT / 2 + 5
    );

    // 4. Cover Art (rounded corners + soft shadow + faint border)
    if (!config.noCoverMode && config.coverArt) {
      const coverSize = 700;
      const coverX = 50;
      const coverY = (height - coverSize) / 2 + 50;
      const coverRadius = 24;

      // Cast the drop shadow from a filled rounded-rect
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetX = 10;
      ctx.shadowOffsetY = 10;
      roundRectPath(ctx, coverX, coverY, coverSize, coverSize, coverRadius);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();

      // Clip to the rounded rect and draw the image
      ctx.save();
      roundRectPath(ctx, coverX, coverY, coverSize, coverSize, coverRadius);
      ctx.clip();
      ctx.drawImage(config.coverArt, coverX, coverY, coverSize, coverSize);
      ctx.restore();

      // Faint border
      ctx.save();
      roundRectPath(ctx, coverX, coverY, coverSize, coverSize, coverRadius);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.stroke();
      ctx.restore();
    }

    // 5. Render Song List
    const drawSongItem = (song, index, x, y, maxWidth) => {
      const num = (index + 1).toString().padStart(2, "0") + ".";

      // A. Draw Number (accent-colored for hierarchy)
      ctx.fillStyle = ACCENT;
      ctx.font = `bold ${FONT_SIZE_NUM}px ${CANVAS_FONT}`;
      ctx.textBaseline = "top";
      ctx.fillText(num, x, y);

      const numberWidth = Math.ceil(ctx.measureText(num).width) + 10;
      const contentX = x + numberWidth;
      const contentMaxWidth = Math.max(0, maxWidth - numberWidth);

      // B. Draw Title
      ctx.font = `bold ${FONT_SIZE_TITLE}px ${CANVAS_FONT}`;
      const titleText = `${song.title} / ${song.artist}`;

      let afterTitleY = wrapText(
        ctx,
        titleText,
        contentX,
        y,
        contentMaxWidth,
        LH_TITLE
      );
      afterTitleY += LH_TITLE;

      // C. Draw Comment
      ctx.fillStyle = config.colorComment;
      ctx.font = `normal ${FONT_SIZE_COMMENT}px ${CANVAS_FONT}`;

      const commentStartY = afterTitleY + TITLE_COMMENT_GAP;
      let afterCommentY = commentStartY;

      if (song.comment && song.comment.trim().length > 0) {
        afterCommentY = wrapText(
          ctx,
          song.comment,
          contentX,
          commentStartY,
          contentMaxWidth,
          LH_COMMENT
        );
        afterCommentY += LH_COMMENT;
      } else {
        afterCommentY = commentStartY + MIN_COMMENT_HEIGHT;
      }

      return afterCommentY + ITEM_SPACING;
    };

    if (config.noCoverMode) {
      // No-Cover Mode: Two Columns
      // Layout: 50px margin, 60px gap, 50px margin
      const sideMargin = 50;
      const colGap = 60;
      const colWidth = (width - sideMargin * 2 - colGap) / 2; // (1920 - 160)/2 = 880
      const col1X = sideMargin;
      const col2X = sideMargin + colWidth + colGap;

      const splitIndex = Math.ceil(config.songs.length / 2);

      const canRenderMore = (y) =>
        y + LH_NUM + LH_TITLE + LH_COMMENT <= height - 30;

      // Left Column
      let currentY = LIST_START_Y;
      for (let i = 0; i < splitIndex; i++) {
        if (!canRenderMore(currentY)) break;
        currentY = drawSongItem(config.songs[i], i, col1X, currentY, colWidth);
      }

      // Right Column
      currentY = LIST_START_Y;
      for (let i = splitIndex; i < config.songs.length; i++) {
        if (!canRenderMore(currentY)) break;
        currentY = drawSongItem(config.songs[i], i, col2X, currentY, colWidth);
      }
    } else {
      // Default Mode: Single Column with Cover
      let currentY = LIST_START_Y;
      for (let i = 0; i < config.songs.length; i++) {
        // Check Overflow
        if (currentY + LH_NUM + LH_TITLE + LH_COMMENT > height - 30) {
          break;
        }
        currentY = drawSongItem(
          config.songs[i],
          i,
          TEXT_START_X,
          currentY,
          TEXT_MAX_WIDTH
        );
      }
    }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    let currentY = y;
    let line = "";
    const words = text.split("");

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        currentY += lineHeight;
        line = words[n];
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    return currentY;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, radius);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawImageCover(ctx, img, w, h) {
    const imgRatio = img.width / img.height;
    const winRatio = w / h;
    let newWidth, newHeight, xOffset, yOffset;

    if (imgRatio > winRatio) {
      newHeight = h;
      newWidth = img.width * (h / img.height);
      xOffset = -(newWidth - w) / 2;
      yOffset = 0;
    } else {
      newWidth = w;
      newHeight = img.height * (w / img.width);
      xOffset = 0;
      yOffset = -(newHeight - h) / 2;
    }
    ctx.drawImage(img, xOffset, yOffset, newWidth, newHeight);
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  // --- UI HELPERS ---

  function updateSongNumbers() {
    const items = songListEl.querySelectorAll(".song-item");
    items.forEach((item, index) => {
      const numEl = item.querySelector(".song-number");
      const summaryEl = item.querySelector(".song-summary");
      const titleVal = item.querySelector(".song-title").value;
      const artistVal = item.querySelector(".song-artist").value;

      numEl.textContent = (index + 1).toString() + ":";
      summaryEl.textContent = `${titleVal} / ${artistVal}`;
    });
  }

  function renderSongList() {
    songListEl.innerHTML = "";
    config.songs.forEach((song) => addSongToDOM(song));
    updateSongNumbers();
  }

  function addSongToDOM(songData = { title: "", artist: "", comment: "" }) {
    const escapeHTML = (str) =>
      (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const dragIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="16" x2="20" y2="16"/></svg>`;
    const chevronIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    const removeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

    const div = document.createElement("div");
    div.className = "song-item";
    div.innerHTML = `
            <div class="song-row">
                <div class="song-row-main">
                    <div class="song-handle" title="Drag to reorder">${dragIcon}</div>
                    <button class="collapse-song" type="button" title="Collapse/Expand">${chevronIcon}</button>
                    <span class="song-number"></span>
                    <span class="song-summary"></span>
                </div>
                <div class="remove-song" title="Remove">${removeIcon}</div>
            </div>
            <div class="song-inputs">
                <input type="text" class="input input-sm song-title" placeholder="Title" value="${escapeHTML(
                  songData.title
                )}">
                <input type="text" class="input input-sm song-artist" placeholder="Artist" value="${escapeHTML(
                  songData.artist
                )}">
                <textarea class="textarea input-sm song-comment" placeholder="Comment" rows="2">${escapeHTML(
                  songData.comment
                )}</textarea>
            </div>
        `;

    // Bind Collapse Event
    const collapseBtn = div.querySelector(".collapse-song");
    const inputsDiv = div.querySelector(".song-inputs");
    collapseBtn.addEventListener("click", () => {
      const isHidden = inputsDiv.classList.contains("hidden");
      if (isHidden) {
        inputsDiv.classList.remove("hidden");
        collapseBtn.classList.remove("is-collapsed");
      } else {
        inputsDiv.classList.add("hidden");
        collapseBtn.classList.add("is-collapsed");
      }
    });

    // Bind Events for this item
    const inputs = div.querySelectorAll("input, textarea");
    inputs.forEach((input) => {
      input.addEventListener("input", () => {
        updateSongsFromDOM();
      });
    });

    div.querySelector(".remove-song").addEventListener("click", () => {
      div.remove();
      updateSongsFromDOM();
    });

    songListEl.appendChild(div);
  }

  function updateSongsFromDOM() {
    updateSongNumbers();
    const items = songListEl.querySelectorAll(".song-item");
    const newSongs = [];
    items.forEach((item) => {
      newSongs.push({
        title: item.querySelector(".song-title").value,
        artist: item.querySelector(".song-artist").value,
        comment: item.querySelector(".song-comment").value,
      });
    });
    config.songs = newSongs;
    drawCanvas();
  }

  function setupDropZone(dropZoneId, inputId, previewId, callback) {
    const dropZone = document.getElementById(dropZoneId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    dropZone.addEventListener("click", () => input.click());

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0], preview, callback);
      }
    });

    input.addEventListener("change", (e) => {
      if (e.target.files.length) {
        handleFile(e.target.files[0], preview, callback);
      }
    });
  }

  function handleFile(file, previewEl, callback) {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        callback(img);
      };
      img.src = e.target.result;

      // Show preview
      previewEl.src = e.target.result;
      previewEl.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  function downloadImage() {
    const link = document.createElement("a");
    link.download = "nowplaying.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  init();
});
