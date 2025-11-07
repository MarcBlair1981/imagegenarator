const { getStore } = require("@netlify/blobs");
const parser = require("lambda-multipart-parser");
const sharp = require("sharp");
const crypto = require("crypto");

// 1. CHANGE 1: Include 'context' in the handler signature
exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST" || !event.body) {
    return {
      statusCode: 405,
      body: "Method Not Allowed or missing body",
    };
  }

  try {
    // 1. Parse the multipart/form-data request from the frontend
    const result = await parser.parse(event);
    const file = result.files.find((f) => f.fieldname === "image-file");

    if (!file) {
      return {
        statusCode: 400,
        body: "No file found in the request. Make sure the input name is 'image-file'.",
      };
    }

    // 2. Process the image using Sharp: Resize to 300px width and convert to WebP
    const processedBuffer = await sharp(file.content)
      .resize(300)
      .webp()
      .toBuffer();

    // 3. Get the Netlify Blobs store
    // CHANGE 2: Pass { context } to authenticate Blobs access
    const imageStore = getStore("uploads", { context });

    // 4. Generate a unique key (filename) and save the processed image buffer to Blobs
    const uniqueKey = crypto.randomBytes(16).toString("hex") + ".webp";
    await imageStore.set(uniqueKey, processedBuffer, {
      metadata: {
        originalName: file.filename,
        mimeType: "image/webp",
        size: processedBuffer.length,
      },
    });

    // 5. Return success response with the URL where the image can be viewed
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Image processed and saved!",
        key: uniqueKey,
        // Netlify serves Blobs at this path
        url: `/.netlify/blobs/uploads/${uniqueKey}`, 
      }),
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to process image.", detail: error.message }),
    };
  }
};
