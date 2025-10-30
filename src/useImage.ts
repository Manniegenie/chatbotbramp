import { useState, useEffect } from "react";

export function useImage(src: string): [HTMLImageElement | undefined] {
  const [image, setImage] = useState<HTMLImageElement | undefined>();
  useEffect(() => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => setImage(img);
  }, [src]);
  return [image];
}