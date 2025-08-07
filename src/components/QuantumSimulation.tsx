import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Zap, Radio, Waves, Target, RotateCcw, Eye, EyeOff, Atom, CheckCircle } from 'lucide-react';

interface QuantumObject {
  id: string;
  x: number;
  y: number;
  frequency: number;
  phase: number;
  amplitude: number;
  isEntangled: boolean;
  entangledWith?: string;
  isTeleporting: boolean;
}

interface ResonanceNode {
  x: number;
  y: number;
  intensity: number;
  phase: number;
}

export const QuantumSimulation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isRunning, setIsRunning] = useState(true);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [objects, setObjects] = useState<QuantumObject[]>([
    {
      id: 'obj1',
      x: 150,
      y: 200,
      frequency: 2.0,
      phase: 0,
      amplitude: 50,
      isEntangled: true,
      entangledWith: 'obj2',
      isTeleporting: false
    },
    {
      id: 'obj2',
      x: 550,
      y: 300,
      frequency: 2.0,
      phase: Math.PI,
      amplitude: 50,
      isEntangled: true,
      entangledWith: 'obj1',
      isTeleporting: false
    }
  ]);
  
  const [resonanceNodes, setResonanceNodes] = useState<ResonanceNode[]>([]);
  const [fieldIntensity, setFieldIntensity] = useState([0.5]);
  const [time, setTime] = useState(0);
  const [showInterference, setShowInterference] = useState(true);
  const [particleCount, setParticleCount] = useState([20]);
  const [teleportationSuccess, setTeleportationSuccess] = useState<string | null>(null);

  // Generate resonance nodes for the quantum field
  useEffect(() => {
    const nodes: ResonanceNode[] = [];
    for (let x = 0; x < 800; x += 40) {
      for (let y = 0; y < 600; y += 40) {
        nodes.push({
          x,
          y,
          intensity: Math.random() * 0.3 + 0.2,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
    setResonanceNodes(nodes);
  }, []);

  const drawQuantumField = useCallback((ctx: CanvasRenderingContext2D) => {
    // Draw dynamic potential field
    resonanceNodes.forEach(node => {
      const intensity = node.intensity * fieldIntensity[0] * (1 + 0.3 * Math.sin(time * 0.05 + node.phase));
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 30);
      gradient.addColorStop(0, `hsla(195, 100%, 65%, ${intensity * 0.1})`);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(node.x - 30, node.y - 30, 60, 60);
    });

    // Draw quantum particles if enabled
    if (showInterference) {
      for (let i = 0; i < particleCount[0]; i++) {
        const x = (Math.sin(time * 0.03 + i) * 200 + 400) + Math.cos(time * 0.02 + i * 2) * 150;
        const y = (Math.cos(time * 0.04 + i) * 150 + 300) + Math.sin(time * 0.03 + i * 3) * 100;
        const size = 2 + Math.sin(time * 0.1 + i) * 1;
        
        const particleGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
        particleGradient.addColorStop(0, 'hsla(280, 80%, 70%, 0.8)');
        particleGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = particleGradient;
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
      }
    }
  }, [resonanceNodes, fieldIntensity, time, showInterference, particleCount]);

  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, obj: QuantumObject) => {
    const { x, y, frequency, phase, amplitude } = obj;
    
    ctx.save();
    ctx.translate(x, y);
    
    // Draw standing wave pattern
    ctx.strokeStyle = obj.isEntangled ? '#B794F6' : '#4FD1C7';
    ctx.lineWidth = 2;
    ctx.globalAlpha = obj.isTeleporting ? 0.3 : 0.8;
    
    // Vertical standing wave
    ctx.beginPath();
    for (let i = -amplitude; i <= amplitude; i += 2) {
      const waveY = i * Math.sin(frequency * time + phase) * Math.cos(i * 0.1);
      if (i === -amplitude) {
        ctx.moveTo(waveY, i);
      } else {
        ctx.lineTo(waveY, i);
      }
    }
    ctx.stroke();
    
    // Horizontal standing wave
    ctx.beginPath();
    for (let i = -amplitude; i <= amplitude; i += 2) {
      const waveX = i * Math.sin(frequency * time + phase + Math.PI/2) * Math.cos(i * 0.1);
      if (i === -amplitude) {
        ctx.moveTo(i, waveX);
      } else {
        ctx.lineTo(i, waveX);
      }
    }
    ctx.stroke();
    
    // Core resonance point
    const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    coreGlow.addColorStop(0, obj.isEntangled ? '#B794F6' : '#4FD1C7');
    coreGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGlow;
    ctx.fillRect(-20, -20, 40, 40);
    
    ctx.restore();
  }, [time]);

  const drawEntanglementLink = useCallback((ctx: CanvasRenderingContext2D, obj1: QuantumObject, obj2: QuantumObject) => {
    if (!obj1.isEntangled || !obj2.isEntangled) return;
    
    ctx.save();
    ctx.strokeStyle = '#B794F6';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([10, 5]);
    ctx.lineDashOffset = time * 0.5;
    
    // Draw quantum entanglement connection
    const dx = obj2.x - obj1.x;
    const dy = obj2.y - obj1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(distance / 20);
    
    ctx.beginPath();
    ctx.moveTo(obj1.x, obj1.y);
    
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = obj1.x + dx * t;
      const y = obj1.y + dy * t + 20 * Math.sin(t * Math.PI * 3 + time * 0.1);
      ctx.lineTo(x, y);
    }
    
    ctx.lineTo(obj2.x, obj2.y);
    ctx.stroke();
    
    ctx.restore();
  }, [time]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas with quantum field background
    ctx.fillStyle = 'hsl(220, 25%, 6%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw quantum field
    drawQuantumField(ctx);
    
    // Draw entanglement links
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        if (objects[i].entangledWith === objects[j].id) {
          drawEntanglementLink(ctx, objects[i], objects[j]);
        }
      }
    }
    
    // Draw quantum objects
    objects.forEach(obj => {
      drawWaveform(ctx, obj);
    });
    
  }, [drawQuantumField, drawWaveform, drawEntanglementLink, objects]);

  const animate = useCallback(() => {
    if (!isRunning) return;
    
    setTime(prev => prev + 0.02);
    render();
    animationRef.current = requestAnimationFrame(animate);
  }, [isRunning, render]);

  useEffect(() => {
    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, isRunning]);

  const handleTeleport = () => {
    if (objects.length < 2) return;
    
    setObjects(prev => prev.map((obj, index) => {
      if (index < 2) {
        return {
          ...obj,
          isTeleporting: true
        };
      }
      return obj;
    }));
    
    // Simulate teleportation after delay
    setTimeout(() => {
      setObjects(prev => {
        const newObjects = [...prev];
        const temp = { x: newObjects[0].x, y: newObjects[0].y };
        newObjects[0].x = newObjects[1].x;
        newObjects[0].y = newObjects[1].y;
        newObjects[1].x = temp.x;
        newObjects[1].y = temp.y;
        newObjects[0].isTeleporting = false;
        newObjects[1].isTeleporting = false;
        return newObjects;
      });
      
      // Show success notification
      setTeleportationSuccess('Quantum teleportation successful!');
      setTimeout(() => setTeleportationSuccess(null), 3000);
    }, 800);
  };

  const addQuantumObject = () => {
    const newObj: QuantumObject = {
      id: `obj${objects.length + 1}`,
      x: Math.random() * 600 + 100,
      y: Math.random() * 400 + 100,
      frequency: 1.5 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2,
      amplitude: 40 + Math.random() * 20,
      isEntangled: false,
      isTeleporting: false
    };
    setObjects(prev => [...prev, newObj]);
  };

  const toggleEntanglement = (objId: string) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === objId) {
        return { ...obj, isEntangled: !obj.isEntangled };
      }
      return obj;
    }));
  };

  const updateFrequency = (value: number[]) => {
    if (selectedObject) {
      setObjects(prev => prev.map(obj => 
        obj.id === selectedObject ? { ...obj, frequency: value[0] } : obj
      ));
    }
  };

  const selectedObj = objects.find(obj => obj.id === selectedObject);

  return (
    <div className="w-full h-screen bg-background flex">
      {/* Control Panel */}
      <Card className="w-80 m-4 p-6 quantum-border">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold quantum-text mb-2">Vers3Dynamics Teleportation</h2>
            <p className="text-sm text-muted-foreground">
              Advanced quantum simulation with interactive waveform visualization and particle interference
            </p>
            {teleportationSuccess && (
              <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400">{teleportationSuccess}</span>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Waves className="w-4 h-4" />
                Field Intensity
              </label>
              <Slider
                value={fieldIntensity}
                onValueChange={setFieldIntensity}
                max={1}
                min={0.1}
                step={0.1}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">
                {fieldIntensity[0].toFixed(1)}
              </span>
            </div>
            
            <div>
              <label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Atom className="w-4 h-4" />
                Particle Count
              </label>
              <Slider
                value={particleCount}
                onValueChange={setParticleCount}
                max={50}
                min={5}
                step={5}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">
                {particleCount[0]} particles
              </span>
            </div>

            {selectedObj && (
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Radio className="w-4 h-4" />
                  Object Frequency
                </label>
                <Slider
                  value={[selectedObj.frequency]}
                  onValueChange={updateFrequency}
                  max={5}
                  min={0.5}
                  step={0.1}
                  className="w-full"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedObj.frequency.toFixed(1)} Hz
                </span>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={handleTeleport}
              className="w-full"
              variant="default"
            >
              <Target className="w-4 h-4 mr-2" />
              Initiate Teleportation
            </Button>
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => setIsRunning(!isRunning)}
                variant="secondary"
                size="sm"
              >
                {isRunning ? <Zap className="w-4 h-4 mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                {isRunning ? 'Pause' : 'Resume'}
              </Button>
              
              <Button 
                onClick={() => setShowInterference(!showInterference)}
                variant="outline"
                size="sm"
              >
                {showInterference ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                Particles
              </Button>
            </div>

            <Button 
              onClick={addQuantumObject}
              variant="outline"
              className="w-full"
            >
              <Atom className="w-4 h-4 mr-2" />
              Add Quantum Object
            </Button>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-3">Quantum Objects</h3>
            <div className="space-y-2">
              {objects.map((obj, index) => (
                <div 
                  key={obj.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedObject === obj.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedObject(obj.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Object {index + 1}</span>
                    <div className="flex gap-1">
                      {obj.isEntangled && <Badge variant="secondary">Entangled</Badge>}
                      {obj.isTeleporting && <Badge variant="destructive">Teleporting</Badge>}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEntanglement(obj.id);
                        }}
                        className="text-xs px-2 py-1 rounded border hover:bg-primary/10 transition-colors"
                      >
                        {obj.isEntangled ? 'Unlink' : 'Entangle'}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Frequency: {obj.frequency.toFixed(1)} Hz
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
      
      {/* Simulation Canvas */}
      <div className="flex-1 p-4">
        <Card className="w-full h-full quantum-border relative overflow-hidden">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-full object-contain cursor-crosshair"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="absolute top-4 left-4 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Quantum Field Visualization - t = {time.toFixed(2)}s
          </div>
        </Card>
      </div>
    </div>
  );
};