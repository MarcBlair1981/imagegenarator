import { getStore } from "@netlify/blobs";
import parser from "lambda-multipart-parser";
import sharp from "sharp";
import crypto from "node:crypto"; // Use node:crypto for ESM imports

// This is the new Netlify Functions V2 format
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // V2 functions use a standard Request object
    const result = await parser.parse(req);
    const file = result.files.find((f) => f.fieldname === "image-file");

    if (!file) {
      return new Response(
        "No file found in the request. Make sure the input name is 'image-file'.",
        { status: 400 }
      );
    }

    // The file content is a Buffer
    const fileContentBuffer = Buffer.from(file.content);

    // 2. Process the image using Sharp: Resize to 300px width and convert to WebP
    const processedBuffer = await sharp(fileContentBuffer)
      .resize(300)
      .webp()
      .toBuffer();

    // 3. Get the Netlify Blobs store (V2 handles auth automatically!)
    const imageStore = getStore("uploads");

    // 4. Generate a unique key and save the processed image
    const uniqueKey = crypto.randomBytes(16).toString("hex") + ".webp";
    await imageStore.set(uniqueKey, processedBuffer, {
      metadata: {
        originalName: file.filename,
        mimeType: "image/webp",
        size: processedBuffer.length,
      },
    });

    // 5. Return success response (using standard Response object)
    const responseBody = JSON.stringify({
      message: "Image processed and saved!",
      key: uniqueKey,
      url: `/.netlify/blobs/uploads/${uniqueKey}`,
    });

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    console.error("Function error:", error);
    const errorBody = JSON.stringify({
      error: "Failed to process image.",
      detail: error.message,
    });

    return new Response(errorBody, {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
