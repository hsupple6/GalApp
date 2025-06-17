import './DropZone.scss';

import React, { useCallback,useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface DropZoneProps {
    parentId: string | null;
    onIngest: (file: File) => void;
    callback: any;
}

const DropZone: React.FC<DropZoneProps> = ({ onIngest }) => {
    const [isDragging, setIsDragging] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles && acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            onIngest(file); // Begin ingestion process in parent component
        }
    }, [onIngest]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
        onDragEnter: () => setIsDragging(true),
        onDragLeave: () => setIsDragging(false),
    });

    return (
        <div {...getRootProps()} className={`dropzone ${isDragging ? 'dragging' : ''}`}>
            <input {...getInputProps()} />
            <div className="dropzoneContent">
                {isDragActive ? (
                    <p>Drop the files here...</p>
                ) : (
                    <p>Drag & drop files here, or click to browse</p>
                )}
            </div>
        </div>
    );
};

export default DropZone;
