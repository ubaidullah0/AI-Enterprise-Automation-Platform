import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadCloud, FileText, Image as ImageIcon, File, Download, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

// --- Types ---
interface Document {
  id: string;
  organizationId: string;
  uploadedBy: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export default function DocumentManager() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Queries ---
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['documents', user?.activeOrganizationId],
    queryFn: async () => {
      const res = await api.get('/documents');
      return res.data.data.documents as Document[];
    },
    enabled: !!user?.activeOrganizationId
  });

  // --- Mutations ---
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setUploadError('');
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.message || 'Failed to upload file');
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setDeleteConfirmId(null);
    }
  });

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const res = await api.get(`/documents/${id}/download`);
      const url = res.data.data.downloadUrl;
      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to download', err);
      alert('Failed to download file. Please try again.');
    }
  };

  // --- Drag & Drop Handlers ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (file: File) => {
    // Basic validation
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('File exceeds 100MB limit');
      return;
    }
    setIsUploading(true);
    setUploadError('');
    uploadMutation.mutate(file);
  };

  // --- Helpers ---
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="text-blue-400" />;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText className="text-amber-400" />;
    return <File className="text-gray-400" />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Document Storage</h1>
          <p className="text-gray-400 text-sm mt-1">Manage files and documents for your organization.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          <span className="text-sm font-medium">Refresh</span>
        </button>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${
          isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900/80'
        }`}
      >
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          ) : (
            <UploadCloud className={`w-8 h-8 ${isDragging ? 'text-blue-400' : 'text-gray-400'}`} />
          )}
        </div>
        
        <h3 className="text-lg font-medium text-white mb-1">
          {isUploading ? 'Uploading file...' : 'Upload a document'}
        </h3>
        <p className="text-gray-400 text-sm text-center max-w-md">
          Drag and drop your file here, or click to browse. Supported up to 100MB.
        </p>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Select File
        </button>

        {uploadError && (
          <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">
            <AlertCircle size={16} />
            <span className="text-sm">{uploadError}</span>
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Files</h2>
          <span className="text-sm font-medium text-gray-500 bg-gray-800 px-2.5 py-0.5 rounded-full">
            {data?.length || 0} items
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Loading documents...</p>
          </div>
        ) : isError ? (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
            <AlertCircle size={40} className="text-amber-400" />
            <p className="text-white font-semibold">Storage Unavailable</p>
            <p className="text-gray-400 text-sm max-w-md">
              Could not connect to the document storage service (MinIO). Make sure MinIO is running on port 9000 and configured in your <code className="text-amber-300 bg-gray-800 px-1 rounded">.env</code> file.
            </p>
            <button onClick={() => refetch()} className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : data && data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/50 border-b border-gray-800">
                  <th className="py-3 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">File Name</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider">Size</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Uploaded Date</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-800/50 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                          {getFileIcon(doc.mimeType)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-[300px]" title={doc.fileName}>
                            {doc.fileName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{doc.mimeType || 'Unknown format'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-300 whitespace-nowrap">
                      {formatBytes(doc.size)}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-400 hidden md:table-cell whitespace-nowrap">
                      {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(doc.createdAt))}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(doc.id, doc.fileName)}
                          className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download size={18} />
                        </button>
                        
                        {deleteConfirmId === doc.id ? (
                          <div className="flex items-center gap-2 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                            <span className="text-xs text-red-400 font-medium px-1">Delete?</span>
                            <button
                              onClick={() => deleteMutation.mutate(doc.id)}
                              disabled={deleteMutation.isPending}
                              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded hover:bg-gray-600 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(doc.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-center border-t border-gray-800">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <File className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No documents yet</h3>
            <p className="text-gray-400 text-sm max-w-sm">
              Upload your first document using the upload zone above. They will be securely stored and isolated to your organization.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
