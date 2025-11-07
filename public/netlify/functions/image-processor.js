import { getStore } from "@netlify/blobs";
import sharp from "sharp";
import crypto from "node:crypto";

export default async (req) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        // 💥 FINAL FIX: Use the standard Request.formData() API (V2 environment supports this)
        const formData = await req.formData();
        
        // Retrieve the file from the FormData object
        const fileEntry = formData.get("image-file");

        if (!fileEntry || !(fileEntry instanceof File)) {
            return new Response(
                JSON.stringify({ error: "No image file found in the request." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Convert the file Blob into an ArrayBuffer, then a Node.js Buffer
        const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
        
        // Process the image using Sharp
        const processedBuffer = await sharp(fileBuffer)
            .resize(300)
            .webp()
            .toBuffer();

        // Get the Netlify Blobs store
        const imageStore = getStore("uploads");

        // Generate a unique key and save the processed image
        const uniqueKey = crypto.randomBytes(16).toString("hex") + ".webp";
        await imageStore.set(uniqueKey, processedBuffer, {
            metadata: {
                originalName: fileEntry.name,
                mimeType: "image/webp",
                size: processedBuffer.length,
            },
        });

        // Return success response
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
