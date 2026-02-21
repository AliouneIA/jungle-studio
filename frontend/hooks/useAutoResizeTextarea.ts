import { useEffect } from 'react';

export const useAutoResizeTextarea = (ref: React.RefObject<HTMLTextAreaElement | null>, value: string) => {
  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;

    // Reset la hauteur pour calculer la bonne taille
    textarea.style.height = 'auto';

    // Calculer la nouvelle hauteur (min 48px, max 200px)
    // On utilise scrollHeight pour détecter le contenu réel
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 48), 200);
    textarea.style.height = `${newHeight}px`;

    // Si la hauteur dépasse le max, on réactive le scroll
    if (textarea.scrollHeight > 200) {
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
  }, [value, ref]);
};
