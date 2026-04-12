import { useRef, useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

function fileMatchesAccept(file, accept) {
  if (!accept || !file?.type) return true

  const acceptedTypes = String(accept)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (acceptedTypes.length === 0) return true

  return acceptedTypes.some((acceptedType) => {
    if (acceptedType.endsWith('/*')) {
      const prefix = acceptedType.slice(0, -1)
      return file.type.startsWith(prefix)
    }

    return file.type === acceptedType
  })
}

/**
 * Drag-and-drop file uploader component.
 * Props: onUploadComplete(files), entityType, entityId, multiple, accept, dark, helperText
 */
export default function FileUploader({ onUploadComplete, entityType, entityId, multiple = false, accept, dark, helperText }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return

    const selectedFiles = Array.from(fileList)
    const invalidFile = selectedFiles.find((file) => !fileMatchesAccept(file, accept))
    if (invalidFile) {
      setError('Only image files can be uploaded here.')
      return
    }

    setUploading(true)
    setError('')
    setProgress(0)

    const formData = new FormData()
    const endpoint = multiple && selectedFiles.length > 1 ? '/uploads/multiple' : '/uploads/single'

    if (multiple && selectedFiles.length > 1) {
      for (const file of selectedFiles) formData.append('files', file)
    } else {
      formData.append('file', selectedFiles[0])
    }

    if (entityType) formData.append('entity_type', entityType)
    if (entityId) formData.append('entity_id', entityId)

    try {
      const xhr = new XMLHttpRequest()
      xhr.withCredentials = true

      const result = await new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100))
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            try {
              reject(new Error(JSON.parse(xhr.responseText).message))
            } catch {
              reject(new Error('Upload failed'))
            }
          }
        }

        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('POST', `${API_BASE}${endpoint}`)
        xhr.send(formData)
      })

      setProgress(100)
      onUploadComplete?.(result.files || [result.file])
    } catch (uploadError) {
      setError(uploadError.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition sm:p-8
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
          onChange={(event) => handleFiles(event.target.files)}
        />

        {uploading ? (
          <div className="space-y-3">
            <div className={`h-2 w-full overflow-hidden rounded-full ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm font-medium text-blue-500">Uploading... {progress}%</p>
          </div>
        ) : (
          <>
            <p className="mb-2 text-3xl">📎</p>
            <p className={`text-sm font-medium sm:text-base ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              {multiple ? 'Drag files here or tap to browse' : 'Drag a file here or tap to browse'}
            </p>
            <p className={`mt-1 text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
              {helperText || 'Max 10 MB per file'}
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {files.map((file) => {
        const isImage = file.mime_type?.startsWith('image/')
        const url = file.url?.startsWith('http') ? file.url : `${API_BASE}${file.url}`

        return (
          <div
            key={file.file_id}
            className={`group relative overflow-hidden rounded-xl border ${dark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}
          >
            {isImage ? (
              <img src={url} alt={file.original_name} className="h-28 w-full object-cover" />
            ) : (
              <div className="flex h-28 w-full items-center justify-center text-3xl">
                {file.mime_type?.includes('pdf') ? '📄' : file.mime_type?.includes('video') ? '🎬' : '📎'}
              </div>
            )}
            <div className="p-2">
              <p className="truncate text-xs font-medium sm:text-sm">{file.original_name}</p>
              <p className={`text-[10px] ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(file.file_id)}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/80 text-xs text-white opacity-100 transition sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
