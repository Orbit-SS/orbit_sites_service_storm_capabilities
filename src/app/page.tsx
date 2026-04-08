"use client";

import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// WebGL Plasma Shader
// ─────────────────────────────────────────────────────────────────────────────
const VERT = `attribute vec2 a_pos; void main(){gl_Position=vec4(a_pos,0,1);}`;

const FRAG = `
precision highp float;
uniform float u_t;
uniform vec2  u_res;
uniform vec2  u_mouse;

vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv  = (gl_FragCoord.xy * 2.0 - u_res) / u_res.y;
  vec2 m   = (u_mouse  * 2.0 - u_res) / u_res.y;
  vec2 uv0 = uv;
  vec3 col = vec3(0.0);

  for (float i = 0.0; i < 4.0; i++) {
    uv = fract(uv * 1.5) - 0.5;
    float d = length(uv) * exp(-length(uv0));
    vec3 c0 = pal(length(uv0) + i * 0.4 + u_t * 0.35,
                  vec3(0.5), vec3(0.5), vec3(1.0),
                  vec3(0.0+i*0.1, 0.33+i*0.07, 0.67+i*0.05));
    d  = sin(d * 8.0 + u_t) / 8.0;
    d  = abs(d);
    d  = pow(0.01 / d, 1.2);
    col += c0 * d;
  }

  /* mouse glow */
  float md = length(uv0 - m * 0.45);
  col += pal(md - u_t * 0.5,
             vec3(0.5), vec3(0.5), vec3(1.0),
             vec3(0.1, 0.5, 0.8)) * 0.55 * exp(-md * 4.5);

  gl_FragColor = vec4(col, 1.0);
}`;

function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl");
  if (!gl) return null;
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return {
    gl,
    u_t:     gl.getUniformLocation(prog, "u_t"),
    u_res:   gl.getUniformLocation(prog, "u_res"),
    u_mouse: gl.getUniformLocation(prog, "u_mouse"),
  };
}

function ShaderCanvas({ className }: { className?: string }) {
  const ref   = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const t0    = useRef(Date.now());
  const raf   = useRef(0);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx    = initGL(canvas);
    if (!ctx) return;
    const { gl, u_t, u_res, u_mouse } = ctx;

    const resize = () => {
      const dpr = devicePixelRatio;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const mm = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: innerHeight - e.clientY };
    };
    addEventListener("mousemove", mm);

    const frame = () => {
      const t = (Date.now() - t0.current) / 1000;
      const dpr = devicePixelRatio;
      gl.uniform1f(u_t, t);
      gl.uniform2f(u_res, canvas.width, canvas.height);
      gl.uniform2f(u_mouse, mouse.current.x * dpr, mouse.current.y * dpr);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf.current = requestAnimationFrame(frame);
    };
    frame();
    return () => { cancelAnimationFrame(raf.current); ro.disconnect(); removeEventListener("mousemove", mm); };
  }, []);

  return <canvas ref={ref} className={className} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Particle Constellation
// ─────────────────────────────────────────────────────────────────────────────
type Particle = { x: number; y: number; vx: number; vy: number; r: number; hue: number };

function ParticleField({ className }: { className?: string }) {
  const ref   = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const raf   = useRef(0);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx    = canvas.getContext("2d")!;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const N = 110;
    const ps: Particle[] = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r:  Math.random() * 2.2 + 0.8,
      hue: Math.random() * 360,
    }));

    const mm = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas.addEventListener("mousemove", mm);

    const frame = () => {
      ctx.fillStyle = "rgba(3, 0, 18, 0.13)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const p of ps) {
        const dx = p.x - mouse.current.x;
        const dy = p.y - mouse.current.y;
        const d  = Math.hypot(dx, dy);
        if (d < 110) { p.vx += (dx / d) * 0.28; p.vy += (dy / d) * 0.28; }
        p.vx *= 0.978; p.vy *= 0.978;
        p.x   = (p.x + p.vx + canvas.width)  % canvas.width;
        p.y   = (p.y + p.vy + canvas.height) % canvas.height;
        p.hue = (p.hue + 0.18) % 360;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${p.hue},100%,72%)`;
        ctx.fill();
      }

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y;
          const d  = Math.hypot(dx, dy);
          if (d < 135) {
            const a = (1 - d / 135) * 0.55;
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.strokeStyle = `hsla(${(ps[i].hue + ps[j].hue) / 2},100%,70%,${a})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      raf.current = requestAnimationFrame(frame);
    };
    frame();

    return () => { cancelAnimationFrame(raf.current); ro.disconnect(); canvas.removeEventListener("mousemove", mm); };
  }, []);

  return <canvas ref={ref} className={className} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lissajous Canvas
// ─────────────────────────────────────────────────────────────────────────────
function LissajousCanvas({ a, b, hue }: { a: number; b: number; hue: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx    = canvas.getContext("2d")!;
    const sz     = canvas.offsetWidth;
    canvas.width = canvas.height = sz * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    let t = Math.random() * 100;
    const frame = () => {
      ctx.fillStyle = "rgba(0,0,0,0.025)";
      ctx.fillRect(0, 0, sz, sz);
      const cx = sz / 2, cy = sz / 2, r = sz * 0.43;
      for (let i = 0; i < 22; i++) {
        t += 0.004;
        const x = cx + r * Math.sin(a * t);
        const y = cy + r * Math.sin(b * t + 1.1);
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${(hue + t * 28) % 360},100%,68%)`;
        ctx.fill();
      }
      raf.current = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf.current);
  }, [a, b, hue]);

  return (
    <canvas
      ref={ref}
      className="w-full aspect-square rounded-2xl border border-white/10"
      style={{ background: "#000409" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3-D Tilt Card
// ─────────────────────────────────────────────────────────────────────────────
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current!;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width  - 0.5;
    const y = (e.clientY - top)  / height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${x * 22}deg) rotateX(${-y * 22}deg) scale3d(1.05,1.05,1.05)`;
  };
  const onLeave = () => { ref.current!.style.transform = "perspective(700px) rotateY(0) rotateX(0) scale3d(1,1,1)"; };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className={className}
      style={{ transition: "transform 0.12s ease", transformStyle: "preserve-3d" }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scroll Reveal
// ─────────────────────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className, dir = "up" }:
  { children: React.ReactNode; delay?: number; className?: string; dir?: "up" | "left" | "right" }) {
  const ref     = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);
  const initial = dir === "left" ? "translateX(-40px)" : dir === "right" ? "translateX(40px)" : "translateY(40px)";
  return (
    <div ref={ref} className={className} style={{
      opacity:    vis ? 1 : 0,
      transform:  vis ? "none" : initial,
      transition: `opacity 0.9s ease ${delay}ms, transform 0.9s ease ${delay}ms`,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Magnetic Button
// ─────────────────────────────────────────────────────────────────────────────
function MagBtn({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLButtonElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const { left, top, width, height } = ref.current!.getBoundingClientRect();
    const x = e.clientX - left - width / 2;
    const y = e.clientY - top  - height / 2;
    ref.current!.style.transform = `translate(${x * 0.32}px,${y * 0.32}px)`;
  };
  const onLeave = () => { ref.current!.style.transform = "translate(0,0)"; };
  return (
    <button ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className={className} style={{ transition: "transform 0.25s ease", ...style }}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated Counter
// ─────────────────────────────────────────────────────────────────────────────
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref     = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const t0 = Date.now(), dur = 2200;
        const tick = () => {
          const p    = Math.min((Date.now() - t0) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 4);
          setVal(Math.round(ease * to));
          if (p < 1) requestAnimationFrame(tick);
        };
        tick();
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{val}{suffix}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill Bar
// ─────────────────────────────────────────────────────────────────────────────
function SkillBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const ref     = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const t0 = Date.now(), dur = 1600;
        const tick = () => {
          const p    = Math.min((Date.now() - t0) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setW(Math.round(ease * pct));
          if (p < 1) requestAnimationFrame(tick);
        };
        tick();
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, [pct]);
  return (
    <div ref={ref} className="mb-5">
      <div className="flex justify-between text-sm mb-2">
        <span className="font-semibold">{label}</span>
        <span className="font-mono text-xs" style={{ color }}>{w}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, transition: "none" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Wave
// ─────────────────────────────────────────────────────────────────────────────
function Wave({ flip = false, from = "#7c3aed", to = "#06b6d4", id = "wg" }: { flip?: boolean; from?: string; to?: string; id?: string }) {
  const path = flip
    ? "M0,60 C360,0 1080,120 1440,60 L1440,0 L0,0 Z"
    : "M0,60 C360,120 1080,0 1440,60 L1440,120 L0,120 Z";
  return (
    <div className="relative overflow-hidden -my-px" style={{ height: 100 }}>
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={from} stopOpacity="0.7"/>
            <stop offset="100%" stopColor={to}   stopOpacity="0.7"/>
          </linearGradient>
        </defs>
        <path d={path} fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
const CARDS = [
  { icon: "⬡", title: "WebGL Shaders",     desc: "Real-time GLSL plasma with palette cycling, fractal loops, and mouse-driven glow.",    grad: "from-violet-500 to-purple-700" },
  { icon: "✦", title: "Particle Systems",  desc: "Canvas 2D constellation with mouse repulsion, velocity damping, and live connections.", grad: "from-cyan-400 to-blue-600" },
  { icon: "◈", title: "3-D CSS Transforms",desc: "Perspective tilt on hover, magnetic buttons, depth layers — zero extra libraries.",      grad: "from-pink-500 to-rose-600" },
  { icon: "⊕", title: "Scroll Animation",  desc: "IntersectionObserver reveals, eased counters, staggered grid entries.",                grad: "from-amber-400 to-orange-500" },
  { icon: "◉", title: "Generative Art",    desc: "Lissajous figures, morphing blobs, plasma fields, procedural SVG waves.",              grad: "from-emerald-400 to-teal-600" },
  { icon: "⧫", title: "Color Science",     desc: "oklch space, palette interpolation, chromatic-aberration glitch, spectrum bars.",       grad: "from-fuchsia-500 to-pink-600" },
];

export default function Home() {
  return (
    <main className="bg-black text-white overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <ShaderCanvas className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 bg-black/25 noise-overlay" />

        {/* Dashed orbital rings */}
        {[220, 380, 540, 700].map((sz, i) => (
          <div key={i} className="absolute rounded-full border border-white/[0.07] pointer-events-none"
            style={{
              width: sz, height: sz,
              borderStyle: i % 2 ? "dashed" : "dotted",
              animation: `spin-slow ${18 + i * 7}s linear infinite${i % 2 ? " reverse" : ""}`,
            }}
          />
        ))}

        <div className="relative z-10 text-center px-6 select-none">
          <div className="mb-8 inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl text-sm text-white/65 tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: "pulse-ring 1.8s ease-out infinite" }} />
            <span className="w-2 h-2 rounded-full bg-emerald-400 -ml-4 absolute" />
            Move your cursor — WebGL responds
          </div>

          <h1 className="text-[clamp(4rem,12vw,9rem)] font-black leading-[0.9] mb-8 tracking-tight">
            <span className="gradient-text block">Beyond</span>
            <span className="text-white block" style={{ textShadow: "0 0 80px rgba(168,85,247,0.4)" }}>Limits</span>
          </h1>

          <p className="text-xl text-white/55 max-w-md mx-auto mb-12 leading-relaxed">
            WebGL shaders · Particle systems · 3-D CSS · Scroll magic · Generative art
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <MagBtn className="shimmer-btn relative px-9 py-4 rounded-full bg-white text-black font-bold text-base overflow-hidden hover:bg-white/90">
              <span className="relative z-10">Explore</span>
            </MagBtn>
            <MagBtn className="px-9 py-4 rounded-full border border-white/20 text-white font-bold text-base backdrop-blur-md hover:bg-white/5">
              Source
            </MagBtn>
          </div>
        </div>

        {/* Scroll caret */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/35 text-xs font-mono"
          style={{ animation: "float 2.4s ease-in-out infinite" }}>
          scroll
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
        </div>
      </section>

      {/* ── CAPABILITIES ─────────────────────────────────────────────────── */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <Reveal className="mb-16">
          <p className="text-xs font-mono text-purple-400 mb-3 tracking-[0.25em] uppercase">Capabilities</p>
          <h2 className="text-5xl md:text-6xl font-black mb-4 leading-tight">What's possible</h2>
          <p className="text-white/45 text-lg max-w-xl leading-relaxed">
            Every section on this page demonstrates a distinct frontend technique — all native, zero 3rd-party animation libs.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CARDS.map((c, i) => (
            <Reveal key={i} delay={i * 70}>
              <TiltCard className="h-full rounded-2xl p-6 bg-white/[0.04] border border-white/10 backdrop-blur-md group cursor-default">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.grad} flex items-center justify-center text-xl mb-5 shadow-lg`}>
                  {c.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{c.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{c.desc}</p>
                <div className={`mt-5 h-px rounded-full bg-gradient-to-r ${c.grad} opacity-0 group-hover:opacity-100 transition-opacity duration-400`} />
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      <Wave id="w1" from="#7c3aed" to="#06b6d4" />

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <section className="py-28 grid-bg" style={{ background: "linear-gradient(135deg,#0d0520 0%,#050d25 50%,#020a18 100%)" }}>
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          {[
            { n: 60,  s: " fps", label: "Shader Rate"   },
            { n: 110, s: "+",    label: "Particles"      },
            { n: 4,   s: "×",    label: "GLSL Loops"     },
            { n: 360, s: "°",    label: "Hue Range"      },
          ].map(({ n, s, label }, i) => (
            <Reveal key={i} delay={i * 100}>
              <div className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="absolute inset-0 rounded-2xl opacity-15"
                  style={{ background: `radial-gradient(circle, hsl(${i*80+220},80%,55%), transparent 70%)` }} />
                <div className="text-5xl font-black gradient-text relative">
                  <Counter to={n} suffix={s} />
                </div>
                <div className="text-white/35 text-xs font-mono uppercase tracking-[0.2em] mt-2">{label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Wave id="w2" flip from="#7c3aed" to="#06b6d4" />

      {/* ── PARTICLE CONSTELLATION ───────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: "#030012" }}>
        <div className="relative h-[580px]">
          <ParticleField className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Reveal className="text-center px-6">
              <p className="text-xs font-mono text-cyan-400 mb-3 tracking-[0.25em] uppercase">Canvas 2D</p>
              <h2 className="text-5xl font-black mb-3">Particle field</h2>
              <p className="text-white/45">Move your cursor to repel 110 physics-driven particles</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── GLITCH + TYPOGRAPHY ──────────────────────────────────────────── */}
      <section className="py-36 px-6 bg-black relative overflow-hidden">
        {/* Background symbols */}
        <div className="absolute inset-0 pointer-events-none select-none opacity-[0.03]">
          {["◈","⬡","✦","◉","⧫","◆","✧","⊗","⊕","◎"].map((s, i) => (
            <span key={i} className="absolute text-[120px] font-black text-white"
              style={{
                left: `${(i % 5) * 22}%`,
                top:  `${Math.floor(i / 5) * 55}%`,
                transform: `rotate(${(i % 3 - 1) * 20}deg)`,
              }}>{s}</span>
          ))}
        </div>

        <div className="max-w-5xl mx-auto relative">
          <Reveal>
            <p className="text-xs font-mono text-pink-400 mb-8 tracking-[0.25em] uppercase">Typography FX</p>
          </Reveal>

          {/* Giant glitch word */}
          <Reveal delay={80}>
            <div className="text-[clamp(5rem,18vw,14rem)] font-black leading-none mb-10 tracking-tight overflow-hidden">
              <span
                className="glitch-wrap gradient-text glitch-main"
                data-text="GLITCH"
                style={{ display: "inline-block" }}
              >
                GLITCH
              </span>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <p className="text-2xl md:text-4xl font-bold text-white/80 mb-14 max-w-2xl leading-snug">
              Typography that{" "}
              <em className="not-italic gradient-text">breathes</em>,{" "}
              <span className="underline decoration-purple-500 decoration-wavy underline-offset-4">glitches</span>,{" "}
              and{" "}
              <span style={{ display: "inline-block", animation: "float 3s ease-in-out infinite" }}>floats</span>.
            </p>
          </Reveal>

          {/* Full-spectrum bar */}
          <Reveal delay={220}>
            <div className="flex h-3 rounded-full overflow-hidden mb-14">
              {Array.from({ length: 36 }, (_, i) => (
                <div key={i} className="flex-1" style={{ background: `hsl(${i * 10},100%,60%)` }} />
              ))}
            </div>
          </Reveal>

          {/* Skill bars */}
          {[
            { label: "WebGL / GLSL",    pct: 92, color: "#a855f7" },
            { label: "Canvas 2D",       pct: 96, color: "#06b6d4" },
            { label: "CSS Animations",  pct: 98, color: "#f43f5e" },
            { label: "React / Next.js", pct: 95, color: "#10b981" },
            { label: "Performance",     pct: 89, color: "#f59e0b" },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 60}>
              <SkillBar {...s} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── MORPHING BLOBS ───────────────────────────────────────────────── */}
      <section className="relative py-36 overflow-hidden" style={{ background: "#060012" }}>
        {/* Ambient blobs */}
        {[
          { c: "#7c3aed", x: "8%",  y: "15%", sz: 520, dur: 9  },
          { c: "#2563eb", x: "62%", y: "45%", sz: 580, dur: 12 },
          { c: "#06b6d4", x: "28%", y: "65%", sz: 420, dur: 10 },
          { c: "#f43f5e", x: "78%", y: "5%",  sz: 360, dur: 8  },
        ].map((b, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none"
            style={{
              width: b.sz, height: b.sz, left: b.x, top: b.y,
              background: `radial-gradient(circle, ${b.c}55, transparent 70%)`,
              filter: "blur(70px)",
              animation: `aurora-float ${b.dur}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.8}s`,
            }}
          />
        ))}

        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <Reveal className="mb-16">
            <p className="text-xs font-mono text-emerald-400 mb-3 tracking-[0.25em] uppercase">Morphing Gradients</p>
            <h2 className="text-5xl font-black">Color in motion</h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Aurora",  colors: ["#7c3aed","#2563eb","#06b6d4"], text: "Layered luminous gradients that pulse and drift." },
              { title: "Plasma",  colors: ["#f43f5e","#ec4899","#a855f7"], text: "Hot plasma hues bleeding through the dark."       },
              { title: "Neon",    colors: ["#10b981","#06b6d4","#3b82f6"], text: "Electric neon glows on a pure black canvas."      },
            ].map((card, i) => (
              <Reveal key={i} delay={i * 130}>
                <div className="relative rounded-3xl p-8 overflow-hidden border border-white/10 group"
                  style={{ minHeight: 240 }}>
                  <div className="absolute inset-0 opacity-50 group-hover:opacity-75 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(ellipse at 30% 30%, ${card.colors[0]}55, transparent 60%),
                                   radial-gradient(ellipse at 70% 70%, ${card.colors[1]}44, transparent 60%),
                                   radial-gradient(ellipse at 50% 50%, ${card.colors[2]}33, transparent 70%)`,
                      backgroundSize: "300% 300%",
                      animation: `gradient-shift ${6 + i * 2}s ease infinite`,
                    }}
                  />
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-2xl mb-5"
                      style={{
                        background: `linear-gradient(135deg, ${card.colors[0]}, ${card.colors[2]})`,
                        animation: `morph ${5 + i}s ease-in-out infinite, spin-slow ${12 + i * 3}s linear infinite`,
                      }}
                    />
                    <h3 className="text-2xl font-black mb-2">{card.title}</h3>
                    <p className="text-white/55 text-sm">{card.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── LISSAJOUS ────────────────────────────────────────────────────── */}
      <section className="py-28 bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal className="mb-14 text-center">
            <p className="text-xs font-mono text-yellow-400 mb-3 tracking-[0.25em] uppercase">Generative Art</p>
            <h2 className="text-5xl font-black">Lissajous curves</h2>
            <p className="text-white/40 mt-3">Purely canvas — mathematical beauty, looping forever</p>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([[3,2,0],[5,4,90],[7,5,180],[9,8,270]] as [number,number,number][]).map(([a,b,hue],i) => (
              <Reveal key={i} delay={i * 80}>
                <LissajousCanvas a={a} b={b} hue={hue} />
                <p className="text-center text-white/30 text-xs font-mono mt-2">{a}:{b}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Wave id="w3" from="#a855f7" to="#f43f5e" />

      {/* ── CTA / FOOTER ─────────────────────────────────────────────────── */}
      <section className="relative py-40 overflow-hidden" style={{ background: "#07021a" }}>
        {/* Aurora blobs */}
        {[
          { c: "#7c3aed", x: "5%",  y: "10%", sz: 600, dur: 9  },
          { c: "#2563eb", x: "50%", y: "50%", sz: 700, dur: 13 },
          { c: "#06b6d4", x: "75%", y: "20%", sz: 500, dur: 11 },
          { c: "#f43f5e", x: "20%", y: "70%", sz: 400, dur: 8  },
        ].map((b, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none opacity-25"
            style={{
              width: b.sz, height: b.sz, left: b.x, top: b.y,
              background: `radial-gradient(circle, ${b.c}, transparent 70%)`,
              filter: "blur(80px)",
              animation: `aurora-float ${b.dur}s ease-in-out infinite alternate`,
              animationDelay: `${i}s`,
            }}
          />
        ))}

        {/* Pulse rings */}
        {[0,1,2].map(i => (
          <div key={i} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-500/20 pointer-events-none"
            style={{
              width: `${320 + i * 220}px`,
              height: `${320 + i * 220}px`,
              animation: `pulse-ring 3.5s ease-out infinite`,
              animationDelay: `${i * 1.2}s`,
            }}
          />
        ))}

        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <Reveal>
            <p className="text-xs font-mono text-purple-400 mb-5 tracking-[0.25em] uppercase">That's a wrap</p>
            <h2 className="text-[clamp(3rem,10vw,7rem)] font-black leading-tight mb-6">
              <span className="gradient-text">Built with</span>
              <br />
              <span className="text-white">Claude</span>
            </h2>
            <p className="text-white/45 text-xl mb-14 leading-relaxed">
              WebGL · Canvas 2D · CSS Animations · Intersection Observer · React hooks<br />
              — all in a single Next.js page, zero animation libraries.
            </p>
            <MagBtn
              className="shimmer-btn relative px-12 py-5 rounded-full font-bold text-lg text-white overflow-hidden"
              style={{
                background: "linear-gradient(135deg,#7c3aed,#2563eb,#06b6d4,#f43f5e)",
                backgroundSize: "300% 300%",
                animation: "gradient-shift 4s ease infinite",
              }}
            >
              <span className="relative z-10">Get Started</span>
            </MagBtn>
          </Reveal>
        </div>
      </section>

    </main>
  );
}
