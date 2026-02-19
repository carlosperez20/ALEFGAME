
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Youtube, Loader2 } from 'lucide-react';
import { motion } from "framer-motion";
import { getVideoInfo, getEmbedUrl } from "@/lib/youtube";
import { useToast } from "@/components/ui/use-toast";
import { postVideo } from "@/lib/api";

function VideoUploader({ onUpload, isUploading, setIsUploading }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Mantener la vista previa local
    const url = URL.createObjectURL(file);
    onUpload({ url, type: 'local' });

    try {
      setIsUploading?.(true);
      const data = await postVideo(file, 'both');
      console.log('API result:', data);
    } catch (err) {
      console.error('Error al analizar el video en el backend:', err);
      alert('Error al procesar el video. Revisa la consola (frontend y backend).');
    } finally {
      setIsUploading?.(false);
      if (event?.target) event.target.value = '';
    }
  };

  const handleYoutubeUpload = async () => {
    try {
      if (!youtubeUrl.trim()) {
        toast({
          title: "Error",
          description: "Por favor, ingresa una URL de YouTube",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      console.log('Procesando URL de YouTube:', youtubeUrl);

      const videoInfo = await getVideoInfo(youtubeUrl);
      console.log('Información del video obtenida:', videoInfo);

      if (!videoInfo.id) {
        throw new Error('No se pudo obtener el ID del video');
      }

      const embedUrl = getEmbedUrl(videoInfo.id, videoInfo.isShort);
      console.log('URL de embed generada:', embedUrl);

      onUpload({
        url: embedUrl,
        type: 'youtube',
        isShort: videoInfo.isShort
      });
      setShowYoutubeInput(false);
      setYoutubeUrl("");
      toast({
        title: "Video cargado",
        description: `Se cargó el video: ${videoInfo.title}`,
      });
    } catch (error) {
      console.error('Error al cargar video de YouTube:', error);
      toast({
        title: "Error",
        description: error.message || "Error al cargar el video de YouTube",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-2 border-dashed border-primary/20 rounded-lg p-8 text-center"
    >
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-4">
          <Upload className="h-12 w-12 text-primary/60" />
          <div>
            <h3 className="text-lg font-semibold">Sube tu video</h3>
            <p className="text-sm text-muted-foreground">
              Arrastra y suelta tu video aquí o haz clic para seleccionar
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Seleccionar Archivo
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                O
              </span>
            </div>
          </div>

          {showYoutubeInput ? (
            <div className="space-y-2 bg-[#0a2240] text-white rounded-lg p-4">
              <Input
                type="text"
                placeholder="Pega el enlace de YouTube aquí"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleYoutubeUpload();
                  }
                }}
                className="bg-[#0a2240] text-white border-white placeholder-white focus:ring-white focus:border-white"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                  onClick={() => {
                    setShowYoutubeInput(false);
                    setYoutubeUrl("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-white text-[#0a2240] hover:bg-gray-100"
                  onClick={handleYoutubeUpload}
                  disabled={!youtubeUrl || isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Youtube className="mr-2 h-4 w-4" />
                  )}
                  Cargar Video
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="bg-[#0a2240] text-white hover:bg-[#143366]"
              onClick={() => setShowYoutubeInput(true)}
              disabled={isUploading}
            >
              <Youtube className="mr-2 h-4 w-4" />
              Usar Video de YouTube
            </Button>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="video/*"
          onChange={handleFileUpload}
        />
      </div>
    </motion.div>
  );
}

export default VideoUploader;
