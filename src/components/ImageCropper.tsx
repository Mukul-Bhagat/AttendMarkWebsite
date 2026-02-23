import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

// Helper function to create the cropped image file
const getCroppedImg = async (imageSrc: string, pixelCrop: any, fileName: string): Promise<File> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.addEventListener('load', () => resolve(img));
        img.addEventListener('error', (err) => reject(err));
        img.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('No 2d context');
    }

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Canvas is empty'));
                return;
            }
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            resolve(file);
        }, 'image/jpeg');
    });
};

interface ImageCropperProps {
    imageFile: File;
    onCropComplete: (file: File) => void;
    onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageFile, onCropComplete, onCancel }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [aspectRatio, setAspectRatio] = useState(1); // Default to 1:1
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const imageSrc = React.useMemo(() => URL.createObjectURL(imageFile), [imageFile]);

    const onCropCompleteHandler = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        try {
            const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, imageFile.name);
            onCropComplete(croppedFile);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-background-light dark:bg-background-dark">
                    <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">Adjust Organization Logo</h3>
                    <button onClick={onCancel} className="text-text-secondary-light hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="relative h-[400px] w-full bg-black/10 dark:bg-black/50 overflow-hidden shrink-0">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={aspectRatio}
                        onCropChange={setCrop}
                        onCropComplete={onCropCompleteHandler}
                        onZoomChange={setZoom}
                        onRotationChange={setRotation}
                        showGrid={true}
                    />
                </div>

                <div className="p-4 space-y-4">
                    {/* Controls */}
                    <div className="flex flex-col gap-3">
                        {/* Action buttons */}
                        <div className="flex justify-between items-center gap-2">
                            <div className="flex gap-2">
                                <button onClick={() => setAspectRatio(1)} className={`px-3 py-1 text-xs rounded-lg font-bold border ${aspectRatio === 1 ? 'bg-[#f04129] text-white border-[#f04129]' : 'border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800'}`}>1:1</button>
                                <button onClick={() => setAspectRatio(3 / 4)} className={`px-3 py-1 text-xs rounded-lg font-bold border ${aspectRatio === 3 / 4 ? 'bg-[#f04129] text-white border-[#f04129]' : 'border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800'}`}>3:4</button>
                                <button onClick={() => setAspectRatio(16 / 9)} className={`px-3 py-1 text-xs rounded-lg font-bold border ${aspectRatio === 16 / 9 ? 'bg-[#f04129] text-white border-[#f04129]' : 'border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800'}`}>16:9</button>
                            </div>

                            <div className="flex items-center gap-2 text-text-secondary-light dark:text-text-secondary-dark font-medium text-sm">
                                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-24 accent-[#f04129]"
                                />
                            </div>
                        </div>

                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={onCancel} className="px-5 py-2 rounded-xl text-sm font-bold text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="px-5 py-2 rounded-xl text-sm font-bold bg-[#f04129] text-white hover:bg-[#d63a25] transition-colors shadow-md flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px]">crop</span> Crop & Apply
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageCropper;
