export async function compressPhoto(file: File): Promise<string> {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Please choose a JPEG, PNG or WebP photo. Export HEIC as JPEG first.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Choose a photo smaller than 15 MB.");
  const bitmap = await createImageBitmap(file);
  const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas"); canvas.width=Math.round(bitmap.width*scale); canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext("2d")!.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
  return canvas.toDataURL("image/webp",0.75);
}
