import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs';
import { AppError } from './AppError.js';

// Configuration from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a local file to Cloudinary and removes it from the local disk.
 */
export const uploadToCloudinary = async (localFilePath, folderName = 'quickassist') => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      folder: folderName,
      resource_type: 'auto'
    });

    try {
      fs.unlinkSync(localFilePath);
    } catch (removeErr) {
      console.error(`Failed to remove local file: ${localFilePath}`, removeErr);
    }

    return response;
  } catch (error) {
    if (localFilePath) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (removeErr) {
        // Ignore cleanup error
      }
    }
    throw new AppError(`Cloudinary upload failed: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Deletes a file from Cloudinary given its public_id.
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Cloudinary delete failed: ${error.message}`);
  }
};
