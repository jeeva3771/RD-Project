import sharp from 'sharp';
import { downloadFromR2 } from "./r2helper.js";
import fetch from "node-fetch";

/**
 * Check if URL is from R2 storage
 */
const isR2Url = (url) => {
  if (!url) return false;
  return url.includes('r2.cloudflarestorage.com') ||
    url.includes('test.2ac5c6d438f60b978d4eed552f65a49a.r2.cloudflarestorage.com');
};

/**
 * Download image from URL (handles both R2 and external URLs)
 */
const downloadImage = async (url) => {
  try {
    if (isR2Url(url)) {
      const buffer = await downloadFromR2(url);
      return buffer;
    } else {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return buffer;
    }
  } catch (error) {
    console.error('Error downloading image:', error.message);
    throw error;
  }
};

/**
 * Create simple text overlay without XML parsing issues
 */
const createSimpleTextOverlay = async (text, maxWidth, maxHeight, fontSize) => {
  try {
    // Clean text - remove problematic characters but KEEP newlines
    const cleanText = text
      .replace(/&/g, ' and ')
      .replace(/[<>'"]/g, '')
      .trim();

    // Split by newlines FIRST to preserve line breaks
    const explicitLines = cleanText.split('\n');
    const lines = [];

    // Process each explicit line for word wrapping if needed
    for (const explicitLine of explicitLines) {
      const words = explicitLine.trim().split(' ').filter(w => w.length > 0);

      if (words.length === 0) continue;

      let currentLine = '';
      const maxCharsPerLine = Math.floor(maxWidth / (fontSize * 0.5));

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxCharsPerLine) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
    }

    const lineHeight = fontSize + 8;
    const padding = 15;

    // Calculate text height but limit it to maxHeight
    let textHeight = (lines.length * lineHeight) + (padding * 2);

    // If text is too tall for the image, reduce it
    if (textHeight > maxHeight * 0.3) {
      textHeight = Math.floor(maxHeight * 0.3);
    }

    const textWidth = Math.min(maxWidth, 2000);

    // Create simple SVG with minimal structure
    const textElements = lines.map((line, index) => {
      const yPos = (index + 1) * lineHeight + padding;
      return `<text x="${padding}" y="${yPos}" fill="rgb(153,153,153)" font-size="${fontSize}" font-family="Arial">${line}</text>`;
    }).join('\n    ');

    // Ultra-simple SVG without CDATA or complex attributes
    const svg = `<svg width="${textWidth}" height="${textHeight}">
  ${textElements}
</svg>`;

    return Buffer.from(svg, 'utf-8');

  } catch (error) {
    console.error('Error creating text overlay:', error);
    throw error;
  }
};

// const createSimpleTextOverlay = async (text, maxWidth, maxHeight, fontSize) => {
//   try {
//     // Clean text - remove ALL special characters
//     const cleanText = text
//       .replace(/&/g, ' and ')
//       .replace(/[<>'"]/g, '')
//       .trim();

//     // Split into lines
//     const words = cleanText.split(' ').filter(w => w.length > 0);
//     const lines = [];
//     let currentLine = '';
//     const maxCharsPerLine = Math.floor(maxWidth / (fontSize * 0.5));

//     for (const word of words) {
//       const testLine = currentLine ? `${currentLine} ${word}` : word;
//       if (testLine.length <= maxCharsPerLine) {
//         currentLine = testLine;
//       } else {
//         if (currentLine) lines.push(currentLine);
//         currentLine = word;
//       }
//     }
//     if (currentLine) lines.push(currentLine);

//     const lineHeight = fontSize + 8;
//     const padding = 15;

//     // Calculate text height but limit it to maxHeight
//     let textHeight = (lines.length * lineHeight) + (padding * 2);

//     // If text is too tall for the image, reduce it
//     if (textHeight > maxHeight * 0.3) {
//       textHeight = Math.floor(maxHeight * 0.3);
//     }

//     const textWidth = Math.min(maxWidth, 2000);

//     // Create simple SVG with minimal structure
//     const textElements = lines.map((line, index) => {
//       const yPos = (index + 1) * lineHeight + padding;
//       return `<text x="${padding}" y="${yPos}" fill="rgba(148, 147, 147, 1)" font-size="${fontSize}" font-family="Arial">${line}</text>`;
//     }).join('\n    ');

//     // Ultra-simple SVG without CDATA or complex attributes
//     const svg = `<svg width="${textWidth}" height="${textHeight}">
//   ${textElements}
// </svg>`;

//     return Buffer.from(svg, 'utf-8');

//   } catch (error) {
//     console.error('Error creating text overlay:', error);
//     throw error;
//   }
// };

/**
 * Add watermark (logo + copyright text + enquiry details) to image
 * @param {string} imageUrl - Original image URL from R2
 * @param {string} logoUrl - Logo URL (R2 or external)
 * @param {string} copyrightText - Copyright text (optional)
 * @param {Object} enquiryDetails - Enquiry details (job_no, category, subcategory, product_size, designer_code)
 * @returns {Buffer} - Watermarked image buffer
 */
export const addWatermarkToImage = async (imageUrl, logoUrl = null, copyrightText = null, enquiryDetails = null) => {
  try {
    console.log('=== Starting Watermark Process ===');

    // Download the original image
    const imageBuffer = await downloadImage(imageUrl);

    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    console.log(`Image dimensions: ${width}x${height}`);

    // Create composite operations array
    const compositeOperations = [];

    // Add logo if provided
    if (logoUrl) {
      try {
        const logoBuffer = await downloadImage(logoUrl);

        // Scale logo based on image size (10-15% of width)
        const logoWidth = Math.max(50, Math.floor(width * 0.12));

        const resizedLogo = await sharp(logoBuffer)
          .resize(logoWidth, null, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .png()
          .toBuffer();

        const logoPadding = 10

        compositeOperations.push({
          input: resizedLogo,
          top: logoPadding,
          left: logoPadding,
        });

        console.log('Logo added successfully');
      } catch (logoError) {
        console.error('Failed to add logo:', logoError.message);
      }
    }

    // Add copyright text if provided
    if (copyrightText && copyrightText.trim().length > 0) {
      try {

        console.log("image height", height);

        // FIXED font size for consistent appearance across ALL images
        const fontSize = 14;
        const padding = 5;

        // Max text width should be 90% of image width
        const maxTextWidth = Math.floor(width * 0.9);

        console.log(`Creating text overlay with fontSize: ${fontSize}, maxWidth: ${maxTextWidth}`);

        const textOverlay = await createSimpleTextOverlay(
          copyrightText,
          maxTextWidth,
          height,
          fontSize
        );

        const textMeta = await sharp(textOverlay).metadata();
        console.log(`Text overlay dimensions: ${textMeta.width}x${textMeta.height}`);

        // Position text at bottom with proper padding
        // Ensure it doesn't go off the bottom of the image
        const textTop = Math.max(0, height - textMeta.height - padding);

        compositeOperations.push({
          input: textOverlay,
          top: textTop,
          left: padding,
        });

        console.log(`Text positioned at top: ${textTop}, left: ${padding}`);
      } catch (textError) {
        console.error('Failed to add copyright text:', textError.message);
        console.error('Text error stack:', textError.stack);
      }
    }

    // Add enquiry details if provided
    if (enquiryDetails) {
      try {
        const { job_no, category, subcategory, product_size, designer_code } = enquiryDetails;

        // Build details text with line breaks for specific layout
        const detailsLines = [];

        // Line 1: Job Number
        if (job_no) {
          detailsLines.push(`${job_no}`);
        }

        // Line 2: Category and Subcategory
        const line2Parts = [];

        // if (category) detailsLines.push(`${category}`);
        // if (subcategory) detailsLines.push(`${subcategory.charAt(0).toUpperCase() + subcategory.slice(1)}`);
        if (category) line2Parts.push(`${category}`);
        if (subcategory) line2Parts.push(`${subcategory.charAt(0).toUpperCase() + subcategory.slice(1)}`);
        if (designer_code) line2Parts.push(`${designer_code.charAt(0).toUpperCase() + designer_code.slice(1)}`);
        if (line2Parts.length > 0) {
          detailsLines.push(line2Parts.join(' | '));
        }

        // Line 3: Size and Designer
        const line3Parts = [];

        // if (product_size) detailsLines.push(`Size: ${product_size}`);
        // if (designer_code) detailsLines.push(`Designer: ${designer_code}`);
        if (product_size) line3Parts.push(`${product_size}`);
        if (line3Parts.length > 0) {
          detailsLines.push(line3Parts.join(' | '));
        }

        if (detailsLines.length > 0) {
          console.log('detailsLines', detailsLines)
          const detailsText = detailsLines.join('\n');

          // Use smaller font for details
          const detailsFontSize = 14;
          const padding = 2;
          const maxTextWidth = Math.floor(width * 0.6); // 60% of image width for better fit

          console.log(`Creating enquiry details overlay with ${detailsLines.length} lines`);

          const detailsOverlay = await createSimpleTextOverlay(
            detailsText,
            maxTextWidth,
            height,
            detailsFontSize
          );

          const detailsMeta = await sharp(detailsOverlay).metadata();
          console.log(`Details overlay dimensions: ${detailsMeta.width}x${detailsMeta.height}`);

          // Position details at top-left, below the logo
          // Calculate logo height (approximately 12% of width gives us the logo size)
          const logoWidth = Math.max(50, Math.floor(width * 0.12));
          const estimatedLogoHeight = logoWidth * 0.5; // Estimate logo height
          // const logoPadding = Math.max(2, Math.floor(width * 0.02));

          // Position below logo with some gap
          const detailsTop = estimatedLogoHeight; // 5px gap below logo
          const detailsLeft = padding;

          compositeOperations.push({
            input: detailsOverlay,
            top: detailsTop,
            left: detailsLeft,
          });

          console.log(`Enquiry details positioned at top: ${detailsTop}, left: ${detailsLeft} (below logo)`);
        }
      } catch (detailsError) {
        console.error('Failed to add enquiry details:', detailsError.message);
        console.error('Details error stack:', detailsError.stack);
      }
    }

    // Apply watermarks
    if (compositeOperations.length > 0) {
      console.log(`Applying ${compositeOperations.length} watermark(s)`);

      const watermarkedImage = await image
        .composite(compositeOperations)
        .jpeg({ quality: 90 })
        .toBuffer();

      console.log('=== Watermark Process Complete ===');
      return watermarkedImage;
    } else {
      console.log('No watermarks to apply, returning original image');
      return imageBuffer;
    }

  } catch (error) {
    console.error('Error adding watermark:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

export default addWatermarkToImage;
