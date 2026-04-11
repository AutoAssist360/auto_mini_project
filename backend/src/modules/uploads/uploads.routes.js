import { Router } from "express";
import fs from "node:fs";
import { prisma } from "../../lib/prisma.js";
import { userAuth } from "../../middleware/auth.js";
import { uploadSingle, uploadMultiple, UPLOAD_DIR } from "../../middleware/upload.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";
import { AppError } from "../../utils/AppError.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";

export const uploadRouter = Router();

uploadRouter.use(userAuth);

function ensureRequestUploadIsImage(entityType, file) {
  if (entityType !== "request") {
    return;
  }

  if (!file?.mimetype?.startsWith("image/")) {
    throw new AppError(
      "Only image files can be uploaded with a service request.",
      400
    );
  }
}

// ─── POST /uploads/single ────────────────────────────────────
// Upload one file
uploadRouter.post(
  "/single",
  (req, res, next) => {
    uploadSingle(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError("File too large. Maximum 10 MB allowed.", 400));
        }
        return next(err instanceof AppError ? err : new AppError(err.message, 400));
      }
      next();
    });
  },
  asyncWrapper(async (req, res) => {
    if (!req.file) throw new AppError("No file uploaded", 400);

    const { entity_type, entity_id } = req.body;
    ensureRequestUploadIsImage(entity_type, req.file);

    const cloudinaryResponse = await uploadToCloudinary(req.file.path, 'quickassist');
    if (!cloudinaryResponse) throw new AppError("Cloudinary upload failed", 500);

    const record = await prisma.fileUpload.create({
      data: {
        uploader_id: req.userId,
        original_name: req.file.originalname,
        stored_name: cloudinaryResponse.public_id,
        mime_type: req.file.mimetype,
        size: req.file.size,
        path: cloudinaryResponse.secure_url,
        entity_type: entity_type || null,
        entity_id: entity_id || null,
      },
    });

    res.status(201).json({
      message: "File uploaded successfully",
      file: {
        file_id: record.file_id,
        original_name: record.original_name,
        mime_type: record.mime_type,
        size: record.size,
        url: record.path,
      },
    });
  })
);

// ─── POST /uploads/multiple ──────────────────────────────────
// Upload up to 10 files
uploadRouter.post(
  "/multiple",
  (req, res, next) => {
    uploadMultiple(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError("File too large. Maximum 10 MB per file.", 400));
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return next(new AppError("Maximum 10 files allowed.", 400));
        }
        return next(err instanceof AppError ? err : new AppError(err.message, 400));
      }
      next();
    });
  },
  asyncWrapper(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw new AppError("No files uploaded", 400);
    }

    const { entity_type, entity_id } = req.body;
    req.files.forEach((file) => ensureRequestUploadIsImage(entity_type, file));

    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file.path, 'quickassist').then(cloudinaryObj => ({ file, cloudinaryObj }))
    );
    const uploadedResults = await Promise.all(uploadPromises);

    const records = await prisma.$transaction(
      uploadedResults.map(({ file, cloudinaryObj }) =>
        prisma.fileUpload.create({
          data: {
            uploader_id: req.userId,
            original_name: file.originalname,
            stored_name: cloudinaryObj.public_id,
            mime_type: file.mimetype,
            size: file.size,
            path: cloudinaryObj.secure_url,
            entity_type: entity_type || null,
            entity_id: entity_id || null,
          },
        })
      )
    );

    res.status(201).json({
      message: `${records.length} file(s) uploaded successfully`,
      files: records.map((r) => ({
        file_id: r.file_id,
        original_name: r.original_name,
        mime_type: r.mime_type,
        size: r.size,
        url: r.path,
      })),
    });
  })
);

// ─── GET /uploads/entity/:entityType/:entityId ───────────────
// Get all files for a given entity — visible to any authenticated user.
// Used by technicians to view photos uploaded by users for a request/job.
uploadRouter.get(
  "/entity/:entityType/:entityId",
  asyncWrapper(async (req, res) => {
    const { entityType, entityId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [files, total] = await Promise.all([
      prisma.fileUpload.findMany({
        where: { entity_type: entityType, entity_id: entityId },
        orderBy: { created_at: "asc" },
        skip,
        take: limit,
      }),
      prisma.fileUpload.count({
        where: { entity_type: entityType, entity_id: entityId },
      }),
    ]);

    res.json({
      files: files.map((f) => ({
        file_id: f.file_id,
        original_name: f.original_name,
        mime_type: f.mime_type,
        size: f.size,
        url: f.path,
        entity_type: f.entity_type,
        entity_id: f.entity_id,
        created_at: f.created_at,
      })),
      total,
      page,
      limit,
    });
  })
);

// ─── GET /uploads ────────────────────────────────────────────
// List files uploaded by the authenticated user
uploadRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = { uploader_id: req.userId };
    const { entity_type, entity_id } = req.query;
    if (entity_type) where.entity_type = entity_type;
    if (entity_id) where.entity_id = entity_id;

    const [files, total] = await Promise.all([
      prisma.fileUpload.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.fileUpload.count({ where }),
    ]);

    res.json({
      files: files.map((f) => ({
        file_id: f.file_id,
        original_name: f.original_name,
        mime_type: f.mime_type,
        size: f.size,
        url: f.path,
        entity_type: f.entity_type,
        entity_id: f.entity_id,
        created_at: f.created_at,
      })),
      total,
      page,
      limit,
    });
  })
);

// ─── DELETE /uploads/:fileId ─────────────────────────────────
uploadRouter.delete(
  "/:fileId",
  asyncWrapper(async (req, res) => {
    const { fileId } = req.params;

    const file = await prisma.fileUpload.findUnique({
      where: { file_id: fileId },
    });

    if (!file) throw new AppError("File not found", 404);
    if (file.uploader_id !== req.userId) {
      throw new AppError("Forbidden", 403);
    }

    // Remove physical file from Cloudinary
    await deleteFromCloudinary(file.stored_name);

    await prisma.fileUpload.delete({ where: { file_id: fileId } });

    res.json({ message: "File deleted" });
  })
);
