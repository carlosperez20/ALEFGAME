
import React, { useState, useRef } from "react";
import VideoUploader from "@/components/VideoUploader";
import VideoPlayer from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";

function VideoAnalysis() {
  const { toast } = useToast();
  const [baseVideo, setBaseVideo] = useState(null);
  const [userVideo, setUserVideo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [tutorialAnalysis, setTutorialAnalysis] = useState(null);
  const comparativoRef = useRef(null);

  const handleBaseVideoUpload = (video) => {
    setBaseVideo(video);
    setAnalysisResults(null);
    analyzeTutorial();
  };

  const handleUserVideoUpload = (video) => {
    setUserVideo(video);
    setAnalysisResults(null);
  };

  const analyzeTutorial = () => {
    setTimeout(() => {
      const tutorial = {
        keyMoments: [
          {
            timestamp: "0:02",
            title: "1. POSICIÓN INICIAL",
            description: "Posicionamiento correcto del jugador con respecto al balón.",
            importance: "Alta",
            image: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//1.%20Posicion%20inicial%20(base).jpeg",
            annotations: [
              {
                type: "line",
                points: [[100, 200], [300, 200]],
                label: "Distancia al balón: 3 pasos"
              },
              {
                type: "angle",
                points: [[150, 300], [200, 350], [250, 300]],
                label: "Ángulo de aproximación: 45°"
              }
            ],
            tips: [
              "Mantén una distancia de 2-3 pasos del balón",
              "Colócate en ángulo de 35° a 40° para asegurar un pase aglobado",
              "Observa el objetivo y visualízalo en tu mente",
              "Fija la mirada en el balón y respira profundo"
            ]
          },
          {
            timestamp: "0:04",
            title: "2. ACERCAMIENTO",
            description: "Análisis del número y tipo de pasos antes de patear el balón",
            importance: "Alta",
            image: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//2.%20Secuencia%20de%20pasos%20(base).jpeg",
            annotations: [
              {
                type: "line",
                points: [[100, 200], [300, 200]],
                label: "3 pasos cortos y rápidos"
              }
            ],
            tips: [
              "Da uno o dos pasos iniciales y el último largo para tomar buen impulso",
              "Mantén la mirada fija en el balón",
              "Extiende los brazos para un posicionamiento firme"
            ]
          },
          {
            timestamp: "0:08",
            title: "3. PREPARACIÓN DEL GOLPEO",
            description: "Postura corporal completa antes del impacto",
            importance: "Alta",
            image: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//4.%20Preparacion%20del%20goleo%20(base).jpeg",
            annotations: [
              {
                type: "angle",
                points: [[150, 300], [200, 350], [250, 300]],
                label: "Brazo a 45°"
              }
            ],
            tips: [
              "Cuerpo recto y piernas inclinadas hacia el balón (ver esqueleto)",
              "Pie de apoyo alineado con la pierna",
              "Talón del pie de golpeo casi tocando el glúteo",
              "Brazos equilibrados para balance"
            ]
          },
          {
            timestamp: "0:09",
            title: "4. PUNTO DE IMPACTO",
            description: "Zona exacta donde golpear el balón",
            importance: "Alta",
            image: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//5.%20Punto%20de%20impacto%20(base).jpeg",
            annotations: [
              {
                type: "circle",
                center: [200, 300],
                radius: 20,
                label: "Punto óptimo de impacto"
              }
            ],
            tips: [
              "Golpea el centro del balón en la parte inferior",
              "Usa la parte media del empeine para mayor elevación del balón",
              "Mantén el tobillo recto y firme al momento del impacto"
            ]
          },
          {
            timestamp: "0:10",
            title: "5. MOMENTO DEL IMPACTO",
            description: "Postura durante el contacto con el balón",
            importance: "Alta",
            image: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//6.%20Momento%20del%20impacto%20(base).jpeg",
            annotations: [
              {
                type: "line",
                points: [[150, 300], [250, 300]],
                label: "Trayectoria del pie"
              }
            ],
            tips: [
              "Cuerpo firme en dirección al objetivo",
              "Manetener mirada fija en el punto de golpeo del balón",
              "Dar un latigazo firme desde el glúteo hasta el golpeo, sin dejar ir el pie hacia adelante después de golpear el balón",
              "Brazos siguen trayectoria para balance"
            ]
          },
          {
            timestamp: "0:11",
            title: "6. SEGUIMIENTO",
            description: "Postura después del golpeo",
            importance: "Alta",
            image: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//7.%20Seguimiento%20(base).jpeg",
            annotations: [
              {
                type: "angle",
                points: [[150, 300], [200, 350], [250, 300]],
                label: "Ángulo de seguimiento"
              }
            ],
            tips: [
              "Enseguida del impacto firme, cruza el pie de golpeo por el frente del pie de apoyo y pósalo en el piso",
              "Enseguida cruza el pie de apoyo por detrás del pie de golpeo",
              "Con esto asegurarás que el balón lleve la elevación y velocidad óptimas"
            ]
          },
          {
            timestamp: "0:12",
            title: "7. RESULTADO",
            description: "Análisis del recorrido y resultado del tiro",
            importance: "Alta",
            image: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//8.%20Trayectoria%20del%20balon%20(base).jpeg",
            annotations: [
              {
                type: "line",
                points: [[100, 200], [300, 150]],
                label: "Trayectoria ideal"
              }
            ],
            tips: [
              "Observa la elevación del balón",
              "Velocidad y potencia adecuadas",
              "Ligeramente desviado, que se compensa con la elevación y velocidad"
            ]
          }
        ]
      };
      setTutorialAnalysis(tutorial);
    }, 1500);
  };

  const analyzeVideo = () => {
    if (!userVideo) {
      toast({
        title: "Error",
        description: "Por favor, sube un video para analizar",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    setTimeout(() => {
      const results = {
        score: 70,
        keyMoments: [
          {
            timestamp: "0:02",
            title: "1. COMPARATIVO POSICIÓN INICIAL",
            feedback: "Buena posición inicial, pero ajusta ligeramente el ángulo de aproximación",
            comparison: {
              tutorial: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//1.%20Posicion%20inicial%20(base).jpeg",
              user: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//9.%20Posicion%20incial%20(usuario).jpeg",
              differences: [
                "Ángulo de aproximación ligeramente cerrado",
                "Distancia al balón óptima",
                "Postura corporal correcta"
              ]
            }
          },
          {
            timestamp: "0:04",
            title: "2. COMPARATIVO SECUENCIA DE PASOS",
            feedback: "Buen ritmo en los pasos. Ultimo paso largo para impulso, ok",
            comparison: {
              tutorial: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//2.%20Secuencia%20de%20pasos%20(base).jpeg",
              user: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//10.%20Secuencia%20de%20pasos%20(usuario).jpeg",
              differences: [
                "Brazos abajo, que impiden óptimo balance del cuerpo",
                "Cuerpo en dirección a la esquina, mientras que el del tutorial ya está en dirección al objetivo (Ver IA-lines)"
              ]
            }
          },
          {
            timestamp: "0:08",
            title: "3. COMPARATIVO PREPARACIÓN DEL GOLPEO",
            feedback: "Postura general desalineada, buena flexión de rodilla y correcta distancia entre el balón al pie de apoyo",
            comparison: {
              tutorial: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//4.%20Preparacion%20del%20goleo%20(base).jpeg",
              user: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//12.%20Preparacion%20del%20golpeo%20(usuario).jpeg",
              differences: [
                "Cuerpo en dirección a la esquina y no hacia el objetivo (ver IA-lines)",
                "Tobillo del pie de apoyo totalmente doblado",
                "Cuerpo muy inclinado hacia atrás" 
              ]
            }
          },
          {
            timestamp: "0:09",
            title: "4. COMPARATIVO PUNTO DE IMPACTO",
            feedback: "Golpeo ligeramente arriba, lo que impide que el balón tenga la elevación adecuada ",
            comparison: {
              tutorial: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//5.%20Punto%20de%20impacto%20(base).jpeg",
              user: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//13.%20Punto%20de%20impacto%20(usuario).jpeg",
              differences: [
                "Punto de impacto en el balón mas arriba que el del tutorial",
                "Golpeo con la parte interna del empeine, lo que hace que vaya mas recto",
              ]
            }
          },
          {
            timestamp: "0:10",
            title: "5. COMPARATIVO GOLPEO DEL BALÓN",
            feedback: "Buen contacto con el balón, pierna de apoyo con correcta flexión",
            comparison: {
              tutorial: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//6.%20Momento%20del%20impacto%20(base).jpeg",
              user: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//14.%20Momento%20del%20impacto%20(usuario).jpeg",
              differences: [
                "Cuerpo en dirección a la esquina (ver IA-Lines)",
                "Pie de golpeo sigue su impulso hacia el frente después del impacto, mientras que el del tutorial golpea firme y no sigue su impulso",
                "Pie de golpeo perpendicular respecto al objetivo, debido al cuerpo en dirección hacia la esquina y al golpeo con la parte interna del empeine"
              ]
            }
          },
          {
            timestamp: "0:11",
            title: "6. COMPARATIVO SEGUIMIENTO",
            feedback: "Buena altura del balón, pero con mucha fuerza y fuera de objetivo",
            comparison: {
              tutorial: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//7.%20Seguimiento%20(base).jpeg",
              user: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//15.%20Seguimiento%20(base).jpeg",
              differences: [
                "Pie de golpeo muy alejado del de apoyo después del golpeo debido al impulso excesivo",
                "Balón con altura, pero no lo suficiente para cumplir el objetivo de un pase aglobado"
              ]
            }
          },
          {
            timestamp: "0:12",
            title: "7. COMPARATIVO RESULTADO",
            feedback: "Practicar corrección de postura y puntos de impacto (pie y balón), para lograr la elevación y dirección óptimas ",
            comparison: {
              tutorial: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//8.%20Trayectoria%20del%20balon%20(base).jpeg",
              user: "https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//16.%20Trayectoria%20del%20balon%20(usuario).jpeg",
              differences: [
                "Balón con menor altura",
                "Potencia excesiva",
                "Fuera del objetivo"
              ]
            }
          }
        ],
      };

      setAnalysisResults(results);
      setIsAnalyzing(false);

      toast({
        title: "Análisis IA completado",
        description: "Se ha completado el análisis del video",
      });

      // Scroll automático a la sección de análisis comparativo después de 1 segundo del toast
      setTimeout(() => {
        if (comparativoRef.current) {
          comparativoRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 1000); // 1 segundo después del toast
    }, 2000);
  };

  return (
    <div className="space-y-8 bg-white"> 
      <div className="grid gap-8 md:grid-cols-2">
        {/* Caja Video Tutorial */}
        <div className="relative rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img
              src="https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//Messi%20portada.jpg"
              alt="Fondo Video Tutorial"
              className="max-w-[80%] max-h-[80%] object-contain opacity-40 rounded-lg translate-y-[-24%]"
            />
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-semibold mb-4 text-center">Video Tutorial</h2>
            {baseVideo ? (
              <VideoPlayer src={baseVideo} onRemove={() => setBaseVideo(null)} />
            ) : (
              <VideoUploader
                onUpload={handleBaseVideoUpload}
                isUploading={isUploading}
                setIsUploading={setIsUploading}
              />
            )}
          </div>
        </div>
        {/* Caja Tu Video */}
        <div className="relative rounded-lg overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img
              src="https://uozulkowtmivqtuyuxkq.supabase.co/storage/v1/object/public/imagenesmomentos//tiago%20portada.jpg"
              alt="Fondo Tu Video"
              className="max-w-[80%] max-h-[80%] object-contain opacity-20 rounded-lg translate-y-[-28%]"
            />
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-semibold mb-4 text-center">Tu Video</h2>
            {userVideo ? (
              <>
                <VideoPlayer src={userVideo} onRemove={() => setUserVideo(null)} />
                {baseVideo && (
                  <div className="flex justify-center mt-4">
                    <Button
                      size="lg"
                      onClick={analyzeVideo}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? "Analizando..." : "Analizar Video"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <VideoUploader
                  onUpload={handleUserVideoUpload}
                  isUploading={isUploading}
                  setIsUploading={setIsUploading}
                />
                {/* Si ya hay baseVideo, pero no userVideo, no mostramos el botón aquí */}
              </>
            )}
          </div>
        </div>
      </div>

      {/* El botón Analizar Video ahora está dentro de la caja Tu Video */}

      {tutorialAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <h2 className="text-4xl font-extrabold font-serif text-center uppercase tracking-wide">ANÁLISIS IA DEL VIDEO TUTORIAL</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tutorialAnalysis.keyMoments.map((moment, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="aspect-[9/16] relative rounded-lg overflow-hidden">
                  <img 
                    src={moment.image}
                    className="w-full h-full object-cover"
                    alt={`Momento clave: ${moment.title}`}
                  />
                </div>
                <div>
                  <h3 className="font-semibold">{moment.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {moment.description}
                  </p>
                  <div className="mt-2">
                    <h4 className="text-sm font-medium">Tips:</h4>
                    <ul className="text-sm text-muted-foreground list-disc pl-4">
                      {moment.tips.map((tip, tipIndex) => (
                        <li key={tipIndex}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {analysisResults && (
        <motion.div
          ref={comparativoRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-extrabold font-serif text-center w-full">ANÁLISIS COMPARATIVO IA</h2>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Puntuación General</p>
              <p className="text-4xl font-bold">{analysisResults.score}%</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {analysisResults.keyMoments.map((moment, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border rounded-lg p-4 space-y-4"
              >
                <h3 className="font-semibold">{moment.title}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Tutorial</p>
                    <div className="aspect-[9/16] relative rounded-lg overflow-hidden">
                      <img 
                        src={moment.comparison.tutorial}
                        className="w-full h-full object-cover"
                        alt={`Tutorial: ${moment.title}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Tu Video</p>
                    <div className="aspect-[9/16] relative rounded-lg overflow-hidden">
                      <img 
                        src={moment.comparison.user}
                        className="w-full h-full object-cover"
                        alt={`Usuario: ${moment.title}`}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-sm">Feedback:</p>
                  <p className="text-sm text-muted-foreground">{moment.feedback}</p>
                  <div className="mt-2">
                    <p className="text-sm font-medium">Diferencias clave:</p>
                    <ul className="text-sm text-muted-foreground list-disc pl-4">
                      {moment.comparison.differences.map((diff, diffIndex) => (
                        <li key={diffIndex}>{diff}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

        </motion.div>
      )}
    </div>
  );
}

export default VideoAnalysis;
