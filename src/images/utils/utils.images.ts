import { ImageManager } from '../images.entity';

export const selectPrincipalImage = (
  images: ImageManager[],
): ImageManager[] => {
  const total = images.length;
  const randomIndex = Math.floor(Math.random() * total);
  return images.map((img, index) => ({
    ...img,
    isPrincipal: index === randomIndex,
  }));
};
