
import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, X, Ruler } from 'lucide-react';
import AnalysisTools from "@/components/AnalysisTools";
import { getEmbedUrl } from "@/lib/youtube";

function VideoPlayer({ src, onRemove }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isYouTube, setIsYouTube] = React.useState(false);
  const [isShort, setIsShort] = React.useState(false);
  const [aspectRatio, setAspectRatio] = React.useState("16/9");
  const [showTools, setShowTools] = React.useState(false);

  useEffect(() => {
    const video = videoRef.current;
    
    if (typeof src === 'object') {
      setIsYouTube(src.type === 'youtube');
      setIsShort(src.isShort);
    } else {
      setIsYouTube(src.includes('youtube.com/embed/'));
      setIsShort(src.includes('/shorts/'));
    }

    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      const ratio = video.videoWidth / video.videoHeight;
      if (ratio < 1) {
        setAspectRatio("9/16");
      } else {
        setAspectRatio("16/9");
      }
    };
    const handleError = (e) => {
      console.error('Error en el reproductor de video:', e);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
    };
  }, [src]);

  const togglePlay = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSliderChange = (value) => {
    const newTime = (value[0] / 100) * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Frame stepping
  const skipForward = () => {
    const video = videoRef.current;
    if (!video) return;
    const fps = video.frameRate || 30; // fallback a 30 si no se puede leer
    video.currentTime = Math.min(video.duration, video.currentTime + 1 / fps);
  };

  const skipBackward = () => {
    const video = videoRef.current;
    if (!video) return;
    const fps = video.frameRate || 30;
    video.currentTime = Math.max(0, video.currentTime - 1 / fps);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const videoUrl = typeof src === 'object' ? src.url : src;
  const isVertical = aspectRatio === "9/16" || isShort;

  // Control de velocidad
  const setPlaybackRate = (rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute top-2 right-2 z-20 flex gap-2">
          {!isYouTube && (
            <Button
              variant="outline"
              size="icon"
              className="bg-background/80 backdrop-blur-sm"
              onClick={() => setShowTools(!showTools)}
            >
              {showTools ? (
                <X className="h-4 w-4" />
              ) : (
                <Ruler className="h-4 w-4" />
              )}
            </Button>
          )}
          {onRemove && (
            <Button
              variant="outline"
              size="icon"
              className="bg-background/80 backdrop-blur-sm"
              onClick={onRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className={`relative bg-black rounded-lg overflow-hidden ${isVertical ? 'aspect-[9/16] max-w-[360px] mx-auto' : 'aspect-video'}`}>
          {isYouTube ? (
            <iframe
              src={videoUrl}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              frameBorder="0"
              title="YouTube video player"
            />
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full cursor-pointer"
                onEnded={() => setIsPlaying(false)}
                onClick={togglePlay}
              />
              {showTools && <AnalysisTools videoRef={videoRef} />}
            </div>
          )}
        </div>
      </div>

      {!isYouTube && (
        <div className="space-y-2">
          {/* Controles de velocidad y reproducción en una sola línea */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
            <Button
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md rounded-full transition-all duration-200"
              onClick={() => setPlaybackRate(0.5)}
            >
              -2x
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md rounded-full transition-all duration-200"
              onClick={() => setPlaybackRate(0.33)}
            >
              -3x
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md rounded-full transition-all duration-200"
              onClick={() => setPlaybackRate(0.25)}
            >
              -4x
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md rounded-full transition-all duration-200"
              onClick={() => setPlaybackRate(1)}
            >
              1
            </Button>
            <Button
              variant="default"
              size="icon"
              className="bg-gray-100 hover:bg-gray-200 text-blue-700 shadow-md rounded-full transition-all duration-200"
              onClick={skipBackward}
              title="Atrasar 5s"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="bg-blue-500 hover:bg-blue-600 text-white shadow-md rounded-full transition-all duration-200"
              onClick={togglePlay}
              title={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="default"
              size="icon"
              className="bg-gray-100 hover:bg-gray-200 text-blue-700 shadow-md rounded-full transition-all duration-200"
              onClick={skipForward}
              title="Adelantar 5s"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {formatTime(currentTime)}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatTime(duration)}
            </span>
          </div>
          <Slider
            value={[currentTime ? (currentTime / duration) * 100 : 0]}
            onValueChange={handleSliderChange}
            max={100}
            step={0.1}
          />
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
