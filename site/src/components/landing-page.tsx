"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Target, Clock, X, Download, CheckCircle2, Zap, Flame, CalendarDays, MousePointerClick } from "lucide-react";

const releaseUrl = "https://github.com/hridaya423/macondoutils/releases/";
const repoUrl = "https://github.com/hridaya423/macondoutils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.08, 
      smoothWheel: true,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    };
  }, []);

  useGSAP(() => {
    if (!containerRef.current) return;

    const tl = gsap.timeline();
    tl.fromTo(".nav-element", 
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: "power3.out" },
      0.2
    );
    tl.fromTo(".hero-text",
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2, stagger: 0.15, ease: "power3.out" },
      0.4
    );

    const track = document.querySelector(".features-track") as HTMLElement;
    if (track) {
      const getScrollAmount = () => -(track.scrollWidth - window.innerWidth);
      
      gsap.to(track, {
        x: getScrollAmount, 
        ease: "none",
        scrollTrigger: {
          trigger: ".features-horizontal-section",
          start: "top top",
          end: () => `+=${track.scrollWidth - window.innerWidth}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        }
      });
    }
    gsap.fromTo(".roast-item",
      { y: 40, opacity: 0 },
      {
        y: 0, opacity: 1,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".roast-section",
          start: "top 70%",
        }
      }
    );

  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="relative w-full bg-[#FFF9F2] text-[#2D1B11] font-sans selection:bg-[#9C6B4E] selection:text-white">
      <div className="grain-overlay" />

      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 md:px-12 pointer-events-none">
        <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
          <div className="nav-element font-heading font-bold text-xl tracking-tight flex items-center pointer-events-auto">
            Macondo Utils
          </div>
          <div className="nav-element pointer-events-auto">
            <a href={releaseUrl} className="text-sm font-medium bg-[#2D1B11] text-[#FFF9F2] px-5 py-2.5 rounded-full hover:bg-[#9C6B4E] transition-colors duration-300 flex items-center gap-2 shadow-lg">
              <Download size={14} />
              Install
            </a>
          </div>
        </div>
      </nav>

      <section className="hero-section relative h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        <div className="max-w-[1000px] mx-auto text-center relative z-10 pt-24 pb-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-heading font-black tracking-tighter leading-[0.95] text-[#2D1B11]">
            <span className="hero-text block">The browser extension that</span>
            <span className="hero-text block text-[#9C6B4E]">makes Macondo better.</span>
          </h1>

          <p className="hero-text mt-6 text-lg md:text-xl leading-relaxed max-w-[42ch] mx-auto text-[#8A6E59] font-medium">
            See better estimates, clearer progress, and the details you actually need while using Macondo.
          </p>

          <div className="hero-text flex justify-center gap-4 mt-10">
             <a href={releaseUrl} className="px-8 py-4 bg-[#2D1B11] text-white rounded-full font-semibold hover:bg-[#9C6B4E] transition-colors duration-300 flex items-center gap-2 text-lg">
                Install Macondo Utils <Zap size={18} />
              </a>
          </div>
        </div>
      </section>

      <section className="features-horizontal-section bg-[#F5EFEB] text-[#2D1B11] h-screen overflow-hidden flex items-center border-y border-[#E8D9CE]">
        <div className="features-track flex h-full flex-nowrap w-[400vw]">
           
           <div className="w-screen flex-shrink-0 flex items-center justify-center px-6 md:px-24">
             <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <div className="space-y-6">
                  <div className="w-12 h-12 bg-white border border-[#E8D9CE] rounded-xl shadow-sm flex items-center justify-center">
                     <Clock size={20} className="text-[#9C6B4E]" />
                  </div>
                  <h2 className="text-5xl md:text-6xl font-heading font-bold tracking-tight">Personalized Shop<br/>Estimates.</h2>
                  <p className="text-lg text-[#8A6E59] max-w-md leading-relaxed">
                    Shop item time estimates based on your actual projects instead of the generic nonsense everybody else gets. This was the first real feature we shipped. They copied it yesterday. Very dignified stuff from them.
                  </p>
                </div>
                <div className="flex justify-center md:justify-end">
                <div className="bg-white border border-[#E8D9CE] p-8 rounded-3xl shadow-sm h-[520px] w-[360px] max-w-full flex items-center justify-center">
                   <div className="relative h-full w-full overflow-hidden rounded-2xl border border-[#E8D9CE] bg-[#FFF9F2] flex items-center justify-center p-4">
                     <Image
                       src="/image copy 3.png"
                       alt="Personalized shop estimate screenshot"
                       width={555}
                       height={1078}
                       className="h-full w-auto object-contain"
                     />
                   </div>
                </div>
                </div>
              </div>
           </div>

           <div className="w-screen flex-shrink-0 flex items-center justify-center px-6 md:px-24">
             <div className="max-w-6xl w-full flex flex-col-reverse md:grid md:grid-cols-2 gap-16 items-center">
                 <div className="relative h-[360px] w-full flex justify-center items-center">
                    <div className="relative h-full w-full overflow-hidden rounded-3xl border border-[#E8D9CE] bg-white shadow-sm">
                      <Image
                        src="/image copy 2.png"
                        alt="Ground labels screenshot"
                        fill
                        className="object-contain"
                      />
                    </div>
                 </div>
                <div className="space-y-6">
                  <div className="w-12 h-12 bg-white border border-[#E8D9CE] rounded-xl shadow-sm flex items-center justify-center">
                     <Target size={20} className="text-[#9C6B4E]" />
                  </div>
                  <h2 className="text-5xl md:text-6xl font-heading font-bold tracking-tight">Ground<br/>Labels.</h2>
                  <p className="text-lg text-[#8A6E59] max-w-md leading-relaxed">
                    Project labels on the farm with the metadata you actually care about. This is one of those features that feels obvious the second you see it, which is probably why they did not have it until somebody else started making obvious things happen.
                  </p>
                </div>
             </div>
           </div>

           <div className="w-screen flex-shrink-0 flex items-center justify-center px-6 md:px-24">
             <div className="max-w-5xl w-full flex flex-col items-center text-center gap-12">
                <div className="space-y-6 flex flex-col items-center">
                  <div className="w-12 h-12 bg-white border border-[#E8D9CE] rounded-xl shadow-sm flex items-center justify-center">
                     <Target size={20} className="text-[#9C6B4E]" />
                  </div>
                  <h2 className="text-5xl md:text-[4.5rem] font-heading font-bold tracking-tight">Goals HUD.</h2>
                  <p className="text-lg text-[#8A6E59] max-w-2xl leading-relaxed">
                    Actual progress, projected progress, and quantity controls right in the HUD. No extra nonsense. Just the stuff you actually opened the extension for.
                  </p>
                </div>
                <div className="w-full bg-white border border-[#E8D9CE] rounded-3xl p-6 md:p-10 shadow-sm flex flex-col items-center relative overflow-hidden">
                   <div className="relative w-full overflow-hidden rounded-3xl border border-[#E8D9CE] bg-white shadow-sm p-4 flex items-center justify-center">
                     <Image
                       src="/image copy.png"
                       alt="Goals HUD screenshot"
                       width={988}
                       height={386}
                       className="w-full h-auto object-contain"
                     />
                   </div>
                 </div>
              </div>
           </div>

           <div className="w-screen flex-shrink-0 flex items-center justify-center px-6 md:px-24">
             <div className="max-w-6xl w-full flex flex-col-reverse md:grid md:grid-cols-2 gap-16 items-center">
                <div className="flex justify-center md:justify-start">
                <div className="bg-white border border-[#E8D9CE] p-8 rounded-3xl shadow-sm h-[520px] w-[360px] max-w-full flex items-center justify-center">
                   <div className="relative h-full w-full overflow-hidden rounded-3xl border border-[#E8D9CE] bg-white shadow-sm flex items-center justify-center p-4">
                     <Image
                       src="/image.png"
                       alt="Streak hover screenshot"
                       width={700}
                       height={1126}
                       className="h-full w-auto object-contain"
                     />
                   </div>
                </div>
                </div>
                <div className="space-y-6">
                  <div className="w-12 h-12 bg-white border border-[#E8D9CE] rounded-xl shadow-sm flex items-center justify-center">
                     <Flame size={20} className="text-[#9C6B4E]" />
                  </div>
                  <h2 className="text-5xl md:text-6xl font-heading font-bold tracking-tight">Streak Info,<br/>On Hover.</h2>
                  <p className="text-lg text-[#8A6E59] max-w-md leading-relaxed">
                    Hover and get the actual useful stuff immediately: average daily time, today&apos;s time, time left, and the recent timeline. No redirect. No dumb detour. Just the information you wanted in the first place.
                  </p>
                </div>
              </div>
           </div>

        </div>
      </section>

      <section className="roast-section py-24 md:py-32 px-6 bg-[#FFF9F2] relative border-b border-[#E8D9CE]">
         <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mt-6 text-[#2D1B11]">
                One tool adds real quality-of-life improvements.<br/>
                The other notices a little later.
              </h2>
            </div>

            <div className="space-y-6">
              <div className="roast-item bg-white p-6 rounded-3xl border border-[#E8D9CE] shadow-sm flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">
                 <div className="flex-1 p-6 md:border-r border-[#E8D9CE] bg-[#F5EFEB] rounded-2xl opacity-70">
                    <div className="flex items-center gap-2 mb-4">
                       <X size={20} className="text-[#9C6B4E]" />
                       <h4 className="font-bold text-lg text-[#2D1B11]">Macondo+ had a whole month and still pulled up late copying Macondo Utils.</h4>
                    </div>
                    <p className="text-[#8A6E59] leading-relaxed">
                      Macondo Utils is 4 days old. Macondo+ had 31 days. Macondo Utils shipped personalized shop estimates first. Macondo+ dropped its version yesterday. Coincidence? I think not.
                    </p>
                 </div>
                 <div className="flex-1 p-6">
                    <div className="flex items-center gap-2 mb-4">
                       <CheckCircle2 size={20} className="text-[#40A86A]" />
                       <h4 className="font-bold text-lg text-[#2D1B11]">Macondo Utils moves different.</h4>
                    </div>
                    <p className="text-[#8A6E59] leading-relaxed">
                      Macondo Utils sees the gap and ships with real taste. Macondo+ had the early headstart, waited for the actual QoL improvements, then copied. 27 days of junk features before Macondo Utils dropped, then sudden &quot;innovation.&quot;
                    </p>
                  </div>
              </div>

              <div className="roast-item bg-white p-6 rounded-3xl border border-[#E8D9CE] shadow-sm flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">
                 <div className="flex-1 p-6 md:border-r border-[#E8D9CE] bg-[#F5EFEB] rounded-2xl opacity-70">
                    <div className="flex items-center gap-2 mb-4">
                       <X size={20} className="text-[#9C6B4E]" />
                       <h4 className="font-bold text-lg text-[#2D1B11]">Macondo+ makes whatever junk keeps the streak going</h4>
                    </div>
                    <p className="text-[#8A6E59] leading-relaxed">
                      When Macondo+ has nothing real to build, out comes the junk. Joke modules. Random toggles. Side quests. Anything to keep the streak breathing and make the repo look busy with &quot;50 commits per week and trying to have some fun&quot;
                    </p>
                 </div>
                 <div className="flex-1 p-6">
                  <div className="flex items-center gap-2 mb-4">
                     <CheckCircle2 size={20} className="text-[#40A86A]" />
                      <h4 className="font-bold text-lg text-[#2D1B11]">Macondo Utils makes QoL to actually improve the user experience</h4>
                  </div>
                  <p className="text-[#8A6E59] leading-relaxed">
                      Macondo Utils ships actual QoL because we genuinely enjoy improving the user experience. Macondo+ ships junk because Macondo+ cannot find any real QoL to improve, so it is filler and bloat.
                  </p>
                 </div>
              </div>

            </div>
         </div>
      </section>

      <section id="install" className="relative py-32 md:py-40 px-6 bg-[#FFF9F2]">
         <div className="max-w-3xl mx-auto text-center z-10">
            <h2 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-6">Ready to upgrade?</h2>
            <p className="text-lg text-[#8A6E59] mb-10 max-w-xl mx-auto">
              Install the extension and instantly gain QoL that certain other tools cannot provide.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={releaseUrl} className="w-full sm:w-auto px-8 py-3.5 bg-[#2D1B11] text-white rounded-full font-semibold hover:bg-[#9C6B4E] transition-colors duration-300 flex items-center justify-center gap-2">
                <Download size={18} />
                Install for Chrome
              </a>
              <a href={repoUrl} className="w-full sm:w-auto px-8 py-3.5 bg-white text-[#2D1B11] rounded-full font-semibold hover:bg-[#F5EFEB] transition-colors duration-300 border border-[#E8D9CE]">
                View Documentation
              </a>
            </div>
         </div>
      </section>

    </div>
  );
}
