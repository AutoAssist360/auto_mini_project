import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import backgroundImg from '../pages/Background.png';

gsap.registerPlugin(ScrollTrigger);

const frameCount = 240;
const currentFrame = (index) => encodeURI(`/Exploded View of Car/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`);

export default function CarScrollAnimation({ openRolePage }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const textRefs = useRef([]);

  useEffect(() => {
    let mm = gsap.matchMedia();

    mm.add("(min-width: 768px)", () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');

      const images = [];
      const airpods = { frame: 1 };
      let loadedCount = 0;

      const render = () => {
        const frameIndex = Math.round(airpods.frame);
        if (!images[frameIndex - 1] || !images[frameIndex - 1].complete || images[frameIndex - 1].naturalWidth === 0) return;
        const img = images[frameIndex - 1];

        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;
        let renderWidth = canvas.width;
        let renderHeight = canvas.height;
        let renderX = 0;
        let renderY = 0;

        if (canvasRatio > imgRatio) {
            renderHeight = canvas.width / imgRatio;
            renderY = (canvas.height - renderHeight) / 2;
        } else {
            renderWidth = canvas.height * imgRatio;
            renderX = (canvas.width - renderWidth) / 2;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, renderX, renderY, renderWidth, renderHeight);
      };

      const handleResize = () => {
        if (!canvasRef.current) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        render();
      };

      handleResize();
      window.addEventListener('resize', handleResize);

      for (let i = 1; i <= frameCount; i++) {
          const img = new Image();
          img.src = currentFrame(i);
          images.push(img);
          img.onload = () => {
             loadedCount++;
             if (loadedCount === 1) render();
          };
      }

      const tl = gsap.timeline({
        onUpdate: () => requestAnimationFrame(render),
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=400%',
          scrub: 1,
          pin: true,
          anticipatePin: 1
        }
      });

      // 0-20% (Hero): Stay mostly assembled, very slight progression
      tl.to(airpods, { frame: 30, ease: 'none', duration: 20 }, 0);
      // 20-40% (Problem): Start exploding
      tl.to(airpods, { frame: 120, ease: 'power1.in', duration: 20 }, 20);
      // 40-60% (System Activation): More parts flying out
      tl.to(airpods, { frame: 200, ease: 'none', duration: 20 }, 40);
      // 60-80% (Solution): Fully exploded
      tl.to(airpods, { frame: 240, ease: 'power1.out', duration: 20 }, 60);
      // 80-100% (Resolution): Smoothly reassemble
      tl.to(airpods, { frame: 1, ease: 'power2.inOut', duration: 20 }, 80);

      const texts = textRefs.current;
      
      texts.forEach((text, i) => {
          if (!text) return;
          const fadeOutStart = (i + 1) * 20 - 5;
          
          if (i === 0) {
              gsap.set(text, { autoAlpha: 1, y: 0, position: 'absolute', top: '50%', left: '50%', xPercent: -50, yPercent: -50, textAlign: 'center', width: '100%' });
              tl.to(text, { autoAlpha: 0, y: -30, duration: 5, ease: 'power1.in' }, fadeOutStart);
          } else {
              const start = i * 20;
              gsap.set(text, { autoAlpha: 0, y: 30, position: 'absolute', top: '50%', left: '50%', xPercent: -50, yPercent: -50, textAlign: 'center', width: '100%' });
              tl.to(text, { autoAlpha: 1, y: 0, duration: 5, ease: 'power1.out' }, start);
              
              if (i < texts.length - 1) {
                  tl.to(text, { autoAlpha: 0, y: -30, duration: 5, ease: 'power1.in' }, fadeOutStart);
              }
          }
      });

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <>
      {/* MOBILE FALLBACK (Visible only on < 768px) */}
      <main className="mt-24 relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 block md:hidden">
        <section className="relative overflow-hidden min-h-[calc(100vh-14rem)] rounded-[48px] border border-white/20 shadow-2xl backdrop-blur-3xl dark:border-slate-800/50 flex flex-col justify-center">
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img src={backgroundImg} alt="Hero Background" className="h-[120%] w-[120%] max-w-none -ml-[10%] -mt-[10%] object-cover object-center opacity-100 dark:opacity-80 scale-125 origin-center animate-pulse duration-[8s]" />
            <div className="absolute inset-0 bg-gradient-to-br from-white via-white/80 to-transparent dark:from-[#050505] dark:via-[#050505]/90 dark:to-transparent"></div>
          </div>
          <div className="relative z-10 max-w-4xl p-6 sm:p-8 lg:p-16 text-center sm:text-left">
             <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-4 py-2 border border-blue-500/20 mb-6 sm:mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                  24/7 Live Roadside Support
                </p>
              </div>

              <h1 className="text-4xl font-black leading-[0.9] tracking-tighter text-slate-900 dark:text-white sm:text-7xl lg:text-8xl">
                Roadside help <br />
                <span className="text-blue-600 dark:text-blue-400">when you need it.</span>
              </h1>

              <p className="mt-8 max-w-2xl mx-auto sm:mx-0 text-lg font-medium text-slate-600 dark:text-slate-300 sm:text-xl leading-relaxed">
                Tell us what went wrong, share your location, and get connected with a nearby technician. You can follow the arrival time and pay safely in one place.
              </p>

              <div className="mt-12 flex flex-col sm:flex-row items-center gap-6">
                <button
                  type="button"
                  onClick={() => openRolePage('help')}
                  className="w-full sm:w-auto rounded-[24px] bg-blue-600 px-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-blue-500/40 hover:bg-blue-500 hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all"
                >
                  Get Help Now
                </button>
              </div>

              <div className="mt-12 flex items-center justify-center sm:justify-start gap-4 text-slate-400">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 w-10 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black">U{i}</div>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest">1,200+ drivers helped</p>
              </div>
          </div>
        </section>
      </main>

      {/* DESKTOP CANVAS (Visible only on >= 768px) */}
      <div ref={containerRef} className="relative w-full h-screen bg-[#050505] hidden md:block">
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
          
          <div className="absolute inset-0 bg-[#050505]/40 pointer-events-none" />

          {/* Storytelling Content Overlays */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Step 1: 0-20% Hero State */}
            <div ref={el => textRefs.current[0] = el} className="px-4 pointer-events-auto">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-4 py-2 border border-blue-500/20 mb-6 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
                    24/7 Live Roadside Support
                  </p>
                </div>
                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">
                  Roadside help <br/> <span className="text-blue-500">when you need it.</span>
                </h1>
                <p className="mt-8 text-xl font-medium text-slate-300 max-w-2xl mx-auto drop-shadow-md">
                  Tell us what went wrong, share your location, and get connected.
                </p>
                <div className="mt-12 flex justify-center">
                    <button onClick={() => openRolePage('help')} className="rounded-[24px] bg-blue-600 px-10 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl hover:scale-105 active:scale-95 transition-all">
                        Get Help Now
                    </button>
                </div>
            </div>

            {/* Step 2: 20-40% Problem */}
            <div ref={el => textRefs.current[1] = el} className="px-4">
                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">
                    Breakdowns <br />
                    <span className="text-red-500">happen anytime.</span>
                </h1>
            </div>

            {/* Step 3: 40-60% System Activation */}
            <div ref={el => textRefs.current[2] = el} className="px-4">
                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-white tracking-tighter drop-shadow-2xl max-w-5xl mx-auto">
                    We instantly connect you <br />
                    <span className="text-blue-500">to nearby mechanics.</span>
                </h1>
            </div>

            {/* Step 4: 60-80% Solution */}
            <div ref={el => textRefs.current[3] = el} className="px-4">
                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">
                    <span className="text-emerald-400">Real-time tracking.</span> <br />
                    Fast response.
                </h1>
            </div>

            {/* Step 5: 80-100% Resolution */}
            <div ref={el => textRefs.current[4] = el} className="px-4 pointer-events-auto flex flex-col items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600 text-4xl font-black text-white shadow-2xl shadow-blue-500/30 mb-8 mx-auto hover:rotate-12 transition-transform duration-500">
                  A
                </div>
                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">
                    Quick Auto Assist
                </h1>
                <div className="mt-12">
                    <button onClick={() => openRolePage('help')} className="rounded-[24px] bg-blue-600 px-10 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl hover:scale-105 active:scale-95 transition-all w-full sm:w-auto">
                        Get Help Now
                    </button>
                </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
