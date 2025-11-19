const { createCanvas, loadImage, registerFont } = require("canvas");
const fs = require("fs");

// --- 1. SETUP FONTS ---
try {
  registerFont("src/static/fonts/notoSansJP/NotoSansJP-Bold.ttf", {
    family: "Noto Sans JP",
    weight: "bold",
  });
  registerFont("src/static/fonts/notoSansJP/NotoSansJP-Regular.ttf", {
    family: "Noto Sans JP",
    weight: "normal",
  });
} catch (e) {
  console.warn("Warning: Noto Sans JP fonts not found. Using system default.");
}

async function generateTracklistImage(config) {
  // Canvas Setup (Full HD)
  const width = 1920;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // --- LAYOUT CONSTANTS ---
  const HEADER_HEIGHT = 120;

  // Layout: Positioning
  const LIST_START_Y = 170; // Moved up to maximize vertical space
  const TEXT_START_X = 900; // X Position for text column
  const TEXT_MAX_WIDTH = 950; // Width limit for text

  // Layout: Spacing (Adjust these to tune the look)
  const ITEM_SPACING = 25; // Reduced: Gap between Song A and Song B
  const TITLE_COMMENT_GAP = 12; // Added: Gap between the Song Title and its Comment
  const MIN_COMMENT_HEIGHT = 10; // Minimum vertical space for a comment, even if empty

  // Layout: Typography
  const FONT_SIZE_NUM = 42;
  const FONT_SIZE_TITLE = 40;
  const FONT_SIZE_COMMENT = 18;

  // Line Heights (How tall one line of text is)
  const LH_NUM = 48; // For the number itself
  const LH_TITLE = 50;
  const LH_COMMENT = 26;

  // 1. Draw Backdrop
  try {
    const backdrop = await loadImage(config.backdropPath);
    drawImageCover(ctx, backdrop, width, height);
  } catch (e) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Dark Gradient Overlay
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.2)");
  gradient.addColorStop(0.4, "rgba(0, 0, 0, 0.6)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.9)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 3. Header Bar
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, HEADER_HEIGHT);

  // Header Title
  ctx.fillStyle = "#FFFFFF";
  ctx.font = 'bold 80px "Noto Sans JP"';
  ctx.textBaseline = "middle";
  ctx.fillText(config.imageTitle, 50, HEADER_HEIGHT / 2);
  const titleWidth = ctx.measureText(config.imageTitle).width;

  // Header Subtitle
  ctx.fillStyle = "#DDDDDD";
  ctx.font = 'bold 24px "Noto Sans JP"';
  ctx.fillText(
    config.imageSubtitle,
    50 + titleWidth + 30,
    HEADER_HEIGHT / 2 + 5
  );

  // 4. Cover Art (Straight)
  try {
    const cover = await loadImage(config.coverArtPath);
    const coverSize = 700;
    const coverX = 50;
    const coverY = (height - coverSize) / 2 + 50;

    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 10;

    ctx.drawImage(cover, coverX, coverY, coverSize, coverSize);

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } catch (e) {
    console.log("No cover art found");
  }

  // 5. Render Song List
  let currentY = LIST_START_Y;

  for (let i = 0; i < config.songs.length; i++) {
    const song = config.songs[i];

    // Check for Overflow: If we are too close to the bottom, stop rendering
    if (currentY + LH_NUM + LH_TITLE + LH_COMMENT > height - 30) {
      // Add some buffer
      console.warn(
        "List reached bottom of image. Cutting off remaining songs."
      );
      break;
    }

    const num = (i + 1).toString().padStart(2, "0") + ".";

    // A. Draw Number
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${FONT_SIZE_NUM}px "Noto Sans JP"`;
    ctx.textBaseline = "top";
    ctx.fillText(num, TEXT_START_X, currentY);

    // Calculate Indentation
    const numberWidth = 70; // Pre-calculated approx width for 'XX.'
    const contentX = TEXT_START_X + numberWidth;
    const contentMaxWidth = TEXT_MAX_WIDTH - numberWidth;

    // B. Draw Title (Wrapped)
    ctx.font = `bold ${FONT_SIZE_TITLE}px "Noto Sans JP"`;
    const titleText = `${song.title} / ${song.artist}`;

    // wrapText returns the Y position where the text ended (last line drawn)
    let afterTitleY = wrapText(
      ctx,
      titleText,
      contentX,
      currentY,
      contentMaxWidth,
      LH_TITLE
    );
    afterTitleY += LH_TITLE; // Advance Y for next element after a single or multi-line title

    // C. Draw Comment (Wrapped) with Padding
    ctx.fillStyle = "#CCCCCC";
    ctx.font = `normal ${FONT_SIZE_COMMENT}px "Noto Sans JP"`;

    const commentStartY = afterTitleY + TITLE_COMMENT_GAP;
    let afterCommentY = commentStartY; // Initialize with start Y

    if (song.comment && song.comment.trim().length > 0) {
      afterCommentY = wrapText(
        ctx,
        song.comment,
        contentX,
        commentStartY,
        contentMaxWidth,
        LH_COMMENT
      );
      afterCommentY += LH_COMMENT; // Advance Y for next element after a single or multi-line comment
    } else {
      // Even if no comment, ensure some space is added for consistency
      afterCommentY = commentStartY + MIN_COMMENT_HEIGHT;
    }

    // D. Set Y for next item (Apply "Padding between items" here)
    currentY = afterCommentY + ITEM_SPACING;
  }

  // Save
  const buffer = canvas.toBuffer("image/jpeg", { quality: 0.95 });
  fs.writeFileSync(config.outputPath, buffer);
  console.log(`Image generated: ${config.outputPath}`);
}

// --- HELPER: Text Wrapper ---
// Returns the Y coordinate *after* the last line of text has been drawn.
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let currentY = y;
  let line = "";

  const words = text.split(""); // Splitting by char for Japanese/English mix

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
  ctx.fillText(line, x, currentY); // Draw the last line
  return currentY; // Return the Y position of the last drawn line
}

// --- HELPER: Object Fit Cover ---
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

module.exports = { generateTracklistImage };

/*
Usage Example:

const { generateTracklistImage } = require('./src/canvasGenerator');

const config = {
  // Array of song objects
  songs: [
    {
      title: "Song Title",
      artist: "Artist Name",
      comment: "Comment text here (optional)"
    },
    // ... more songs
  ],
  
  // File paths
  coverArtPath: "./path/to/cover.jpg",     // Square image recomended
  backdropPath: "./path/to/backdrop.jpg",  // Background image (1920x1080 recomended)
  outputPath: "./output.jpg",              // Where to save the generated image

  // Text content
  imageTitle: "Main Title",                // Large header text
  imageSubtitle: "Subtitle text here"      // Smaller text below title
};

generateTracklistImage(config);
*/
