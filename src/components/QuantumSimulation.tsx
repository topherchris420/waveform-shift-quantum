import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Radio, Waves, Target, RotateCcw, Eye, EyeOff, Atom, CheckCircle, Beaker, Volume2, VolumeX, Settings, Play, Pause, BarChart } from 'lucide-react';

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

type ExperimentMode = 'teleportation' | 'interference' | 'tunneling' | 'superposition';

interface Measurement {
  timestamp: number;
  value: number;
  type: string;
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
  const [experimentMode, setExperimentMode] = useState<ExperimentMode>('teleportation');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [barrierHeight, setBarrierHeight] = useState([50]);
  const [waveSpeed, setWaveSpeed] = useState([1]);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [interactionProbability, setInteractionProbability] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);

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

  const drawInterferencePattern = useCallback((ctx: CanvasRenderingContext2D) => {
    if (experimentMode !== 'interference') return;
    
    // Double-slit interference pattern
    const slitY1 = 200;
    const slitY2 = 400;
    const slitWidth = 20;
    const barrierX = 300;
    
    // Draw barrier
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(barrierX - 5, 0, 10, slitY1 - slitWidth);
    ctx.fillRect(barrierX - 5, slitY1 + slitWidth, 10, slitY2 - slitY1 - 2 * slitWidth);
    ctx.fillRect(barrierX - 5, slitY2 + slitWidth, 10, 600 - slitY2 - slitWidth);
    
    // Draw interference pattern on screen
    const screenX = 600;
    for (let y = 0; y < 600; y += 2) {
      const d1 = Math.sqrt((screenX - barrierX) ** 2 + (y - slitY1) ** 2);
      const d2 = Math.sqrt((screenX - barrierX) ** 2 + (y - slitY2) ** 2);
      const phase = (d1 - d2) * 0.02 * fieldIntensity[0];
      const intensity = Math.cos(phase + time * 0.1) ** 2;
      
      ctx.fillStyle = `hsla(195, 100%, 65%, ${intensity * 0.3})`;
      ctx.fillRect(screenX, y, 20, 2);
    }
  }, [experimentMode, fieldIntensity, time]);

  const drawTunnelingBarrier = useCallback((ctx: CanvasRenderingContext2D) => {
    if (experimentMode !== 'tunneling') return;
    
    const barrierX = 350;
    const barrierWidth = 100;
    const height = barrierHeight[0] * 4;
    
    // Draw potential barrier
    const gradient = ctx.createLinearGradient(barrierX, 300 - height/2, barrierX + barrierWidth, 300 + height/2);
    gradient.addColorStop(0, 'hsla(0, 75%, 60%, 0.3)');
    gradient.addColorStop(0.5, 'hsla(0, 75%, 60%, 0.6)');
    gradient.addColorStop(1, 'hsla(0, 75%, 60%, 0.3)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(barrierX, 300 - height/2, barrierWidth, height);
    
    // Draw tunneling probability
    const tunnelingProb = Math.exp(-barrierHeight[0] * 0.1);
    ctx.fillStyle = `hsla(120, 70%, 50%, ${tunnelingProb})`;
    ctx.fillRect(barrierX + barrierWidth + 10, 280, 20, 40);
  }, [experimentMode, barrierHeight]);

  const drawSuperpositionStates = useCallback((ctx: CanvasRenderingContext2D) => {
    if (experimentMode !== 'superposition') return;
    
    const centerX = 400;
    const centerY = 300;
    
    // Draw multiple superposition states
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI / 3) + time * 0.05;
      const x = centerX + Math.cos(angle) * 100;
      const y = centerY + Math.sin(angle) * 100;
      const alpha = 0.3 + 0.2 * Math.sin(time * 0.1 + i);
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 50);
      gradient.addColorStop(0, `hsla(${120 + i * 120}, 80%, 70%, ${alpha})`);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 50, y - 50, 100, 100);
    }
    
    // Central coherent state
    const coherenceGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30);
    coherenceGradient.addColorStop(0, 'hsla(60, 100%, 80%, 0.8)');
    coherenceGradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = coherenceGradient;
    ctx.fillRect(centerX - 30, centerY - 30, 60, 60);
  }, [experimentMode, time]);

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
    
    // Draw experiment-specific elements
    drawInterferencePattern(ctx);
    drawTunnelingBarrier(ctx);
    drawSuperpositionStates(ctx);
    
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
    
    // Update measurements
    if (measurementMode && time % 10 < 0.02) {
      const newMeasurement: Measurement = {
        timestamp: time,
        value: Math.random() * fieldIntensity[0],
        type: experimentMode
      };
      setMeasurements(prev => [...prev.slice(-19), newMeasurement]);
    }
    
    // Calculate interaction probability
    const prob = Math.sin(time * 0.1) * 0.5 + 0.5;
    setInteractionProbability(prob);
  }, [drawQuantumField, drawWaveform, drawEntanglementLink, drawInterferencePattern, drawTunnelingBarrier, drawSuperpositionStates, objects, experimentMode, measurementMode, time, fieldIntensity]);

  const animate = useCallback(() => {
    if (!isRunning) return;
    
    setTime(prev => prev + 0.02 * waveSpeed[0]);
    render();
    animationRef.current = requestAnimationFrame(animate);
  }, [isRunning, render, waveSpeed]);

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
      
      // Show success notification with sound and haptic
      setTeleportationSuccess('Quantum teleportation successful!');
      playSound('success');
      triggerHaptic();
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

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    if (experimentMode === 'teleportation') {
      // Add quantum object at click position
      const newObj: QuantumObject = {
        id: `obj${Date.now()}`,
        x, y,
        frequency: 1.5 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
        amplitude: 40 + Math.random() * 20,
        isEntangled: false,
        isTeleporting: false
      };
      setObjects(prev => [...prev, newObj]);
    }
  };

  const runExperiment = () => {
    switch (experimentMode) {
      case 'teleportation':
        handleTeleport();
        break;
      case 'interference':
        setShowInterference(true);
        setTeleportationSuccess('Double-slit interference activated!');
        playSound('success');
        setTimeout(() => setTeleportationSuccess(null), 3000);
        break;
      case 'tunneling':
        setTeleportationSuccess(`Tunneling probability: ${(Math.exp(-barrierHeight[0] * 0.1) * 100).toFixed(1)}%`);
        playSound('success');
        setTimeout(() => setTeleportationSuccess(null), 3000);
        break;
      case 'superposition':
        setTeleportationSuccess('Quantum superposition states visualized!');
        playSound('success');
        setTimeout(() => setTeleportationSuccess(null), 3000);
        break;
    }
  };

  const resetExperiment = () => {
    setObjects([
      {
        id: 'obj1',
        x: 150, y: 200,
        frequency: 2.0, phase: 0, amplitude: 50,
        isEntangled: true, entangledWith: 'obj2', isTeleporting: false
      },
      {
        id: 'obj2',
        x: 550, y: 300,
        frequency: 2.0, phase: Math.PI, amplitude: 50,
        isEntangled: true, entangledWith: 'obj1', isTeleporting: false
      }
    ]);
    setMeasurements([]);
    setTime(0);
  };

  const selectedObj = objects.find(obj => obj.id === selectedObject);

  // Auto-hide tutorial after 5 seconds
  useEffect(() => {
    if (showTutorial) {
      const timer = setTimeout(() => setShowTutorial(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showTutorial]);

  // Add haptic feedback simulation
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  // Add sound effect simulation
  const playSound = (type: 'teleport' | 'success' | 'click') => {
    if (!audioEnabled) return;
    
    // Simulate sound with Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch (type) {
      case 'teleport':
        oscillator.frequency.value = 220;
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        break;
      case 'success':
        oscillator.frequency.value = 440;
        gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
        break;
      case 'click':
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.02, audioContext.currentTime);
        break;
    }
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  return (
    <div className="w-full h-screen bg-background flex flex-col lg:flex-row relative overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-card border-b">
        <h1 className="text-lg font-bold quantum-text">Vers3Dynamics</h1>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            setControlsOpen(!controlsOpen);
            triggerHaptic();
            playSound('click');
          }}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Tutorial Overlay */}
      {showTutorial && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="p-6 max-w-sm mx-auto quantum-border">
            <div className="text-center space-y-4">
              <Atom className="w-12 h-12 mx-auto text-primary" />
              <h2 className="text-xl font-bold">Welcome to Quantum Lab</h2>
              <p className="text-sm text-muted-foreground">
                Tap the canvas to create quantum objects. Use controls to experiment with different physics modes.
              </p>
              <Button onClick={() => setShowTutorial(false)} className="w-full">
                Start Exploring
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Control Panel - Mobile Responsive */}
      <Card className={`
        ${controlsOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:relative top-0 left-0 h-full w-80 lg:w-96 
        transition-transform duration-300 ease-in-out z-40
        lg:m-4 p-4 lg:p-6 quantum-border overflow-y-auto
        ${controlsOpen ? 'shadow-2xl' : ''}
      `}>
        {/* Mobile Close Button */}
        <Button 
          className="lg:hidden absolute top-4 right-4" 
          variant="ghost" 
          size="sm"
          onClick={() => setControlsOpen(false)}
        >
          ×
        </Button>

        <Tabs value={experimentMode} onValueChange={(value) => {
          setExperimentMode(value as ExperimentMode);
          playSound('click');
        }}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="teleportation" className="text-xs lg:text-sm">Teleport</TabsTrigger>
            <TabsTrigger value="interference" className="text-xs lg:text-sm">Interference</TabsTrigger>
          </TabsList>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="tunneling" className="text-xs lg:text-sm">Tunneling</TabsTrigger>
            <TabsTrigger value="superposition" className="text-xs lg:text-sm">Superposition</TabsTrigger>
          </TabsList>

          <TabsContent value="teleportation" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold quantum-text mb-2">Quantum Teleportation</h2>
              <p className="text-sm text-muted-foreground">
                Teleport quantum states between entangled objects. Click canvas to add objects.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="interference" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold quantum-text mb-2">Wave Interference</h2>
              <p className="text-sm text-muted-foreground">
                Observe double-slit interference patterns and wave superposition.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="tunneling" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold quantum-text mb-2">Quantum Tunneling</h2>
              <p className="text-sm text-muted-foreground">
                Demonstrate particles tunneling through energy barriers.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="superposition" className="space-y-6">
            <div>
              <h2 className="text-xl font-bold quantum-text mb-2">Superposition States</h2>
              <p className="text-sm text-muted-foreground">
                Visualize quantum objects existing in multiple states simultaneously.
              </p>
            </div>
          </TabsContent>

          {teleportationSuccess && (
            <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400">{teleportationSuccess}</span>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Waves className="w-4 h-4" />
                Field Intensity
              </label>
              <Slider
                value={fieldIntensity}
                onValueChange={setFieldIntensity}
                max={1} min={0.1} step={0.1}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4" />
                Wave Speed
              </label>
              <Slider
                value={waveSpeed}
                onValueChange={setWaveSpeed}
                max={3} min={0.1} step={0.1}
                className="w-full"
              />
            </div>

            {experimentMode === 'tunneling' && (
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4" />
                  Barrier Height
                </label>
                <Slider
                  value={barrierHeight}
                  onValueChange={setBarrierHeight}
                  max={100} min={10} step={5}
                  className="w-full"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Atom className="w-4 h-4" />
                Particle Count
              </label>
              <Slider
                value={particleCount}
                onValueChange={setParticleCount}
                max={50} min={5} step={5}
                className="w-full"
              />
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
                  max={5} min={0.5} step={0.1}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => {
                runExperiment();
                triggerHaptic();
                playSound('teleport');
              }}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200"
              variant="default"
            >
              <Beaker className="w-4 h-4 mr-2" />
              Run Experiment
            </Button>
            
            <div className="grid grid-cols-3 gap-2">
              <Button 
                onClick={() => {
                  setIsRunning(!isRunning);
                  playSound('click');
                }}
                variant="secondary"
                size="sm"
                className="hover:scale-105 transition-transform"
              >
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              
              <Button 
                onClick={() => {
                  setShowInterference(!showInterference);
                  playSound('click');
                }}
                variant="outline"
                size="sm"
                className="hover:scale-105 transition-transform"
              >
                {showInterference ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>

              <Button 
                onClick={() => {
                  setAudioEnabled(!audioEnabled);
                  playSound('click');
                }}
                variant={audioEnabled ? "default" : "outline"}
                size="sm"
                className="hover:scale-105 transition-transform"
              >
                {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => setMeasurementMode(!measurementMode)}
                variant={measurementMode ? "default" : "outline"}
                size="sm"
              >
                <BarChart className="w-4 h-4 mr-1" />
                Measure
              </Button>

              <Button 
                onClick={resetExperiment}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>

            <Button 
              onClick={() => {
                addQuantumObject();
                triggerHaptic();
                playSound('success');
              }}
              variant="outline"
              className="w-full hover:bg-primary/10 border-primary/30 hover:border-primary transition-all duration-200"
            >
              <Atom className="w-4 h-4 mr-2" />
              Add Quantum Object
            </Button>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Quantum Objects</h3>
              <span className="text-xs text-muted-foreground">Click canvas to add</span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {objects.map((obj, index) => (
                <div 
                  key={obj.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover-scale ${
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
                    Freq: {obj.frequency.toFixed(1)} Hz | Pos: ({Math.round(obj.x)}, {Math.round(obj.y)})
                  </div>
                </div>
              ))}
            </div>
          </div>

          {measurementMode && (
            <div>
              <h3 className="text-sm font-medium mb-3">Live Measurements</h3>
              <div className="space-y-2">
                <div className="text-xs">
                  <span className="text-muted-foreground">Interaction Probability:</span>
                  <span className="text-primary ml-2">{(interactionProbability * 100).toFixed(1)}%</span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Objects Tracked:</span>
                  <span className="text-primary ml-2">{objects.length}</span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Simulation Time:</span>
                  <span className="text-primary ml-2">{time.toFixed(2)}s</span>
                </div>
              </div>
            </div>
          )}
        </Tabs>
      </Card>
      
      {/* Simulation Canvas */}
      <div className="flex-1 lg:p-4 relative">
        <Card className="w-full h-full quantum-border relative overflow-hidden rounded-none lg:rounded-lg">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-full object-contain cursor-crosshair touch-none"
            style={{ imageRendering: 'pixelated' }}
            onClick={handleCanvasClick}
            onTouchStart={(e) => {
              e.preventDefault();
              const touch = e.touches[0];
              const canvas = canvasRef.current;
              if (!canvas) return;
              
              const rect = canvas.getBoundingClientRect();
              const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
              const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
              
              if (experimentMode === 'teleportation') {
                const newObj: QuantumObject = {
                  id: `obj${Date.now()}`,
                  x, y,
                  frequency: 1.5 + Math.random() * 3,
                  phase: Math.random() * Math.PI * 2,
                  amplitude: 40 + Math.random() * 20,
                  isEntangled: false,
                  isTeleporting: false
                };
                setObjects(prev => [...prev, newObj]);
                triggerHaptic();
                playSound('success');
              }
            }}
          />
          
          {/* Floating UI Elements */}
          <div className="absolute top-2 left-2 lg:top-4 lg:left-4">
            <div className="text-xs text-muted-foreground bg-background/90 backdrop-blur-sm px-2 py-1 rounded-lg border shadow-sm">
              {experimentMode.charAt(0).toUpperCase() + experimentMode.slice(1)} Mode
            </div>
            <div className="text-xs text-muted-foreground bg-background/90 backdrop-blur-sm px-2 py-1 rounded-lg border shadow-sm mt-1">
              t = {time.toFixed(2)}s
            </div>
          </div>
          
          <div className="absolute top-2 right-2 lg:top-4 lg:right-4 space-y-1">
            <div className="text-xs text-muted-foreground bg-background/90 backdrop-blur-sm px-2 py-1 rounded-lg border shadow-sm">
              Objects: {objects.length}
            </div>
            <div className="text-xs text-muted-foreground bg-background/90 backdrop-blur-sm px-2 py-1 rounded-lg border shadow-sm">
              Field: {fieldIntensity[0].toFixed(1)}
            </div>
          </div>

          {measurementMode && (
            <div className="absolute bottom-2 left-2 lg:bottom-4 lg:left-4">
              <div className="text-xs text-green-400 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-lg border border-green-500/30 shadow-sm flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                Live Measurement Active
              </div>
            </div>
          )}

          {/* Quick Action Button */}
          <div className="absolute bottom-4 right-4 lg:hidden">
            <Button
              onClick={() => {
                runExperiment();
                triggerHaptic();
                playSound('teleport');
              }}
              className="rounded-full w-14 h-14 bg-gradient-to-r from-primary to-primary/80 shadow-xl hover:scale-110 transition-all duration-200"
            >
              <Beaker className="w-6 h-6" />
            </Button>
          </div>

          {/* Tap Indicator */}
          {experimentMode === 'teleportation' && objects.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-2 bg-background/80 backdrop-blur-sm p-4 rounded-lg border animate-pulse">
                <Target className="w-8 h-8 mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Tap to create quantum objects</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Mobile Control Overlay */}
      {controlsOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/20 z-30"
          onClick={() => setControlsOpen(false)}
        />
      )}
    </div>
  );
};