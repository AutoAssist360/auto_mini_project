import { useState, useRef } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

/**
 * Drag-and-drop file uploader component.
 * Props: onUploadComplete(files), entityType, entityId, multiple, accept, dark
 */
export default function FileUploader({ onUploadComplete, entityType, entityId, multiple = false, accept, dark }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return

    setUploading(true)
    setError('')
    setProgress(0)

    const formData = new FormData()
    const endpoint = multiple && fileList.length > 1 ? '/uploads/multiple' : '/uploads/single'

    if (multiple && fileList.length > 1) {
      for (const f of fileList) formData.append('files', f)
    } else {
      formData.append('file', fileList[0])
    }

    if (entityType) formData.append('entity_type', entityType)
    if (entityId) formData.append('entity_id', entityId)

    try {
      const xhr = new XMLHttpRequest()
      xhr.withCredentials = true

      const result = await new Promise((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).message)) }
            catch { reject(new Error('Upload failed')) }
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('POST', `${API_BASE}${endpoint}`)
        xhr.send(formData)
      })

      setProgress(100)
      onUploadComplete?.(result.files || [result.file])
    } catch (e) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition
          ${dragging
            ? 'border-blue-500 bg-blue-500/10'
            : dark ? 'border-gray-700 hover:border-gray-600 bg-gray-800/50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple={multiple}
          accept={accept}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {uploading ? (
          <div className="space-y-3">
            <div className={`w-full h-2 rounded-full overflow-hidden ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-blue-500 font-medium">Uploading… {progress}%</p>
          </div>
        ) : (
          <>
            <p className="text-3xl mb-2">📎</p>
            <p className={`font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              {multiple ? 'Drop files here or click to browse' : 'Drop a file here or click to browse'}
            </p>
            <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
              Max 10 MB per file • Images, PDFs, videos
            </p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

/**
 * Display uploaded files as a gallery / list.
 * Props: files[], onDelete(fileId), dark
 */
export function FileGallery({ files = [], onDelete, dark }) {
  if (files.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {files.map((f) => {
        const isImage = f.mime_type?.startsWith('image/')
        const url = f.url?.startsWith('http') ? f.url : `${API_BASE}${f.url}`

        return (
          <div
            key={f.file_id}
            className={`group relative rounded-xl overflow-hidden border ${dark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}
          >
            {isImage ? (
              <img src={url} alt={f.original_name} className="w-full h-28 object-cover" />
            ) : (
              <div className="w-full h-28 flex items-center justify-center text-3xl">
                {f.mime_type?.includes('pdf') ? '📄' : f.mime_type?.includes('video') ? '🎬' : '📎'}
              </div>
            )}
            <div className="p-2">
              <p className="text-xs truncate font-medium">{f.original_name}</p>
              <p className={`text-[10px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {(f.size / 1024).toFixed(0)} KB
              </p>
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(f.file_id)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition"
              >✕</button>
            )}
          </div>
        )
      })}
    </div>
  )
}
