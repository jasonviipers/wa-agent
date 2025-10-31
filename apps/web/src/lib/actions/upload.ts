'use server';
import { deleteFromS3, extractKeyFromUrl, getS3Url, uploadToS3 } from "@/lib/r2";
import { createId } from "@paralleldrive/cuid2";

export async function uploadAvatar(formData: FormData) {
  try {
    const file = formData.get("avatar") as File;
    if (!file) {
      return {
        error: "No file uploaded",
        status: 400,
      };
    }

    // Validate file size (optional)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        error: "File size too large. Maximum size is 5MB",
        status: 400,
      };
    }

    // Validate file type (optional)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed",
        status: 400,
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `avatar/${createId()}-${file.name}`;
    const contentType = file.type || "image/jpeg";

    await uploadToS3(key, buffer, contentType);
    const url = await getS3Url(key);
    
    return { 
      url,
      status: 200 
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      error: `Failed to upload avatar: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 500,
    };
  }
}

export async function deleteAvatar(url: string) {
  try {
    const key = extractKeyFromUrl(url);

    if (!key) {
      return {
        error: "Invalid avatar URL",
        status: 400,
      };
    }

    await deleteFromS3(key);
    return {
      success: true,
      status: 200
    };
  } catch (error) {
    console.error("Delete error:", error);
    return {
      error: `Failed to delete avatar: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 500,
    };
  }
}