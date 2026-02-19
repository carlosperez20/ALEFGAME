
// Función para convertir un archivo Blob/File a Base64
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Función para subir el video a un servicio temporal y obtener una URL pública
export async function uploadVideoToTemp(file) {
  try {
    // Primero convertimos el archivo a Base64
    const base64Data = await fileToBase64(file);
    
    // Usamos el servicio temporal file.io (gratis, sin registro)
    const response = await fetch('https://file.io', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: base64Data,
        expires: '1h', // La URL expira en 1 hora
      }),
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Error al subir el video');
    }

    return data.link; // URL pública temporal
  } catch (error) {
    console.error('Error al subir el video:', error);
    throw new Error(`Error al generar URL pública: ${error.message}`);
  }
}
