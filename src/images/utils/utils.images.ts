import { ImageManager } from '../images.entity';

/**
 * Deja exactamente una imagen principal: la primera que ya lo fuera y, si
 * ninguna lo es, la primera de la lista. La dueña no tiene cómo elegirla, así
 * que al menos no cambia sola en cada guardado.
 */
export const selectPrincipalImage = (
  images: ImageManager[],
): ImageManager[] => {
  const marcada = images.findIndex((img) => img.isPrincipal);
  const principal = marcada === -1 ? 0 : marcada;
  return images.map((img, index) => ({
    ...img,
    isPrincipal: index === principal,
  }));
};
