const MAX_BYTES = 1_048_576;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function dataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Das Foto konnte nicht gelesen werden. Wähle es erneut.'));
    reader.readAsDataURL(blob);
  });
}

function encode(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Das Foto konnte nicht verkleinert werden. Wähle ein anderes Bild.')), 'image/webp', quality);
  });
}

export async function readPhoto(file) {
  if (!file?.size) return undefined;
  if (!TYPES.includes(file.type)) throw new Error('Wähle ein JPEG-, PNG- oder WebP-Bild.');
  if (file.size <= MAX_BYTES) return dataUrl(file);

  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Das Foto konnte nicht gelesen werden. Wähle es erneut.'));
      image.src = url;
    });
    const context = canvas.getContext('2d');
    if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error('Bildverarbeitung nicht verfügbar.');
    let scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
    while (true) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.88, 0.75, 0.6, 0.45]) {
        const blob = await encode(canvas, quality);
        if (blob.size <= MAX_BYTES) return await dataUrl(blob);
        // Unsupported WebP encoding falls back to lossless PNG.
        if (blob.type === 'image/png') break;
      }
      if (canvas.width === 1 && canvas.height === 1) throw new Error('Bild bleibt zu gross.');
      scale *= 0.75;
    }
  } catch {
    throw new Error('Das Foto konnte nicht verkleinert werden. Wähle ein anderes Bild.');
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
}
