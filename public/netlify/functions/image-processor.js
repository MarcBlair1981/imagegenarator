import { getStore } from "@netlify/blobs";
import sharp from "sharp";
import crypto from "node:crypto";

// For demonstration, we're hardcoding a style (a blue tint) 
// to be applied to the second image if a style-key is provided.
const DEMO_TINT_COLOR_HEX = '#3498DB'; 

export default async (req) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        // Use the standard Web API to parse form data
        const formData = await req.formData();
        
        // Get the file being uploaded
        const fileEntry = formData.get("image-file");
        
        // Get the optional style-key being passed from the second form
        const styleKey = formData.get("style-key"); 

        if (!fileEntry || !(fileEntry instanceof File)) {
            return new Response(
                JSON.stringify({ error: "No image file found in the request." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Convert the file Blob into a Buffer for Sharp
        const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
        
        let sharpProcessor = sharp(fileBuffer);
        const isStyleApplication = !!styleKey;
        
        // --- 🎯 CORE STYLE LOGIC BRANCH ---
        if (isStyleApplication) {
            // Case 2: Style is being applied to a new image
            console.log(`Applying style from key: ${styleKey} with tint color: ${DEMO_TINT_COLOR_HEX}`);
            
            // In a real application, you would retrieve and use metadata from the Blobs store 
            // associated with the styleKey. For now, we apply a consistent resize and tint.
            
            sharpProcessor = sharpProcessor
                .resize(300)
                .tint(DEMO_TINT_COLOR_HEX);

        } else {
            // Case 1: Initial image upload (sets the style)
            console.log('Processing initial image to define style (standard resize).');
            
            // Standard processing for the first image
            sharpProcessor = sharpProcessor.resize(300);
            
            // If you implemented complex style detection (e.g., dominant color), 
            // you would extract and save that metadata here.
        }
        // ------------------------------------

        // Final processing step (convert to WebP)
        const processedBuffer = await sharpProcessor
            .webp()
            .toBuffer();
        
        // Save the processed image to Netlify Blobs
        const imageStore = getStore("uploads");
        const uniqueKey = crypto.randomBytes(16).toString("hex") + ".webp";
        
        await imageStore.set(uniqueKey, processedBuffer, {
            metadata: {
                originalName: fileEntry.name,
                mimeType: "image/webp",
                size: processedBuffer.length,
                // Optionally save the applied style property for confirmation
                appliedStyleKey: isStyleApplication ? styleKey : 'none'
            },
        });

        // Return success response
        const responseBody = JSON.stringify({
            message: `Image processed and style ${isStyleApplication ? 'applied' : 'defined'}!`,
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
