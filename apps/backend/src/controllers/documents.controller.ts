import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireOrgHeader } from '../utils/requestHelpers';
import { uploadBuffer, deleteObject, getPresignedDownloadUrl } from '../services/storage.service';

export const uploadDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const { buffer, mimetype, originalname, size } = req.file;

    // Optional: Mime type and size validations can be expanded here based on strict requirements
    if (size > 100 * 1024 * 1024) { // 100MB limit
      return res.status(400).json({ success: false, message: 'File exceeds 100MB limit' });
    }

    // Upload to MinIO
    const uploadResult = await uploadBuffer(buffer, mimetype, originalname, organizationId);

    // Save metadata to Database
    const document = await prisma.document.create({
      data: {
        organizationId,
        uploadedBy: userId,
        fileName: uploadResult.fileName,
        fileUrl: uploadResult.fileUrl,
        mimeType: mimetype,
        size: uploadResult.size
      }
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        resource: 'Document',
        action: 'UPLOAD',
        newData: document as any
      }
    });

    res.status(201).json({ success: true, data: document });
  } catch (error: any) {
    console.error('[Document UPLOAD Error]', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getDocuments = async (req: Request, res: Response) => {
  try {
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const { page: pageQuery, limit: limitQuery } = req.query;
    
    const page = parseInt(pageQuery as string || '1');
    const limit = parseInt(limitQuery as string || '50');
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.document.count({ where: { organizationId } })
    ]);

    res.status(200).json({
      success: true,
      data: {
        documents,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const downloadDocument = async (req: Request, res: Response) => {
  try {
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const id = req.params.id as string;

    const document = await prisma.document.findUnique({
      where: { id }
    });

    if (!document || document.organizationId !== organizationId) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Generate secure pre-signed URL (Valid for 15 minutes)
    const downloadUrl = await getPresignedDownloadUrl(document.fileUrl, 900);

    res.status(200).json({
      success: true,
      data: { downloadUrl }
    });
  } catch (error: any) {
    console.error('[Document DOWNLOAD Error]', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const id = req.params.id as string;

    const document = await prisma.document.findUnique({
      where: { id }
    });

    if (!document || document.organizationId !== organizationId) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Verify RBAC (Only Owner/Admin or the uploader can delete)
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { role: true }
    });

    const isAdminOrOwner = membership && ['OWNER', 'ADMIN'].includes(membership.role.name);
    if (!isAdminOrOwner && document.uploadedBy !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied to delete this document' });
    }

    // Delete from MinIO
    await deleteObject(document.fileUrl);

    // Delete from DB
    await prisma.document.delete({
      where: { id }
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        resource: 'Document',
        action: 'DELETE',
        oldData: document as any
      }
    });

    res.status(200).json({ success: true, message: 'Document deleted successfully' });
  } catch (error: any) {
    console.error('[Document DELETE Error]', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
