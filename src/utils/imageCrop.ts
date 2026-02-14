import { Area } from 'react-easy-crop';

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getFilteredCanvas = async (imageSrc: string, pixelCrop: Area, filter: string) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.filter = filter && filter !== 'none' ? filter : 'none';
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

  return canvas;
};

export const getCroppedImageBlob = async (
  imageSrc: string,
  pixelCrop: Area,
  filter: string,
  mimeType = 'image/jpeg',
  quality = 0.92
): Promise<Blob> => {
  const canvas = await getFilteredCanvas(imageSrc, pixelCrop, filter);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
};

export const getCroppedPreviewUrl = async (
  imageSrc: string,
  pixelCrop: Area,
  filter: string
): Promise<string> => {
  const canvas = await getFilteredCanvas(imageSrc, pixelCrop, filter);
  return canvas.toDataURL('image/jpeg', 0.92);
};
