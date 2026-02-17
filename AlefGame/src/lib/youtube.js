
const YOUTUBE_API_KEY = 'AIzaSyDzyeJufZzc9-MeL08yED0O33honmAnzjg';



export async function getVideoInfo(videoUrl) {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('URL de YouTube inválida. Asegúrate de usar un enlace de video de YouTube válido.');
    }

    console.log('Obteniendo información del video:', videoId);

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error de la API de YouTube:', errorData);
      throw new Error(`Error al obtener información del video: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('Respuesta de YouTube:', data);
    
    if (data.items.length === 0) {
      throw new Error('Video no encontrado. Verifica que el video exista y sea público.');
    }

    return {
      id: videoId,
      title: data.items[0].snippet.title,
      duration: data.items[0].contentDetails.duration,
      thumbnail: data.items[0].snippet.thumbnails.high.url,
      isShort: videoUrl.includes('/shorts/')
    };
  } catch (error) {
    console.error('Error completo:', error);
    throw new Error(`Error al procesar el video: ${error.message}`);
  }
}

export function extractVideoId(url) {
  // Soporta más formatos de URL de YouTube, incluyendo Shorts
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^/?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^/?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^/?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^/?]+)/,  // Patrón para Shorts
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export function getEmbedUrl(videoId, isShort = false) {
  // Configuración especial para mejorar la reproducción
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&controls=1`;
}
