import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import anime from 'animejs';

export default function NotFoundPage() {
    const [isHovering, setIsHovering] = useState(false);
    const containerRef = useRef(null);
    
    // Animation refs
    const truckRef = useRef(null);
    const headlightRef = useRef(null);
    const starsRef = useRef([]);
    const titleRef = useRef(null);

    // Mouse tracking state
    const targetPos = useRef({ x: 0, y: 0 });
    const currentPos = useRef({ x: 0, y: 0 });
    const [maskPos, setMaskPos] = useState({ x: 0, y: 0 });
    const [windowCenter, setWindowCenter] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Initial setup for positions
        if (typeof window !== 'undefined') {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            targetPos.current = { x: centerX, y: centerY };
            currentPos.current = { x: centerX, y: centerY };
            setMaskPos({ x: centerX, y: centerY });
            setWindowCenter({ x: centerX, y: centerY });
        }

        const handleMouseMove = (e) => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                targetPos.current = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                };
            }
        };
        
        const handleResize = () => {
            setWindowCenter({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
            });
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Lerp loop
    useEffect(() => {
        let animationFrameId;
        const lerp = (start, end, factor) => start + (end - start) * factor;

        const updatePos = () => {
            currentPos.current.x = lerp(currentPos.current.x, targetPos.current.x, 0.08);
            currentPos.current.y = lerp(currentPos.current.y, targetPos.current.y, 0.08);
            setMaskPos({ x: currentPos.current.x, y: currentPos.current.y });
            animationFrameId = requestAnimationFrame(updatePos);
        };
        updatePos();

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    // Anime.js animations
    useEffect(() => {
        // Truck idle bounce
        anime({
            targets: truckRef.current,
            translateY: [0, 1.5],
            direction: 'alternate',
            loop: true,
            easing: 'easeInOutSine',
            duration: 900
        });

        // Headlight flicker
        anime({
            targets: headlightRef.current,
            opacity: [0.6, 0.9, 0.4, 0.8, 0.5],
            direction: 'alternate',
            loop: true,
            easing: 'steps(4)',
            duration: 1500
        });

        // Stars twinkle
        starsRef.current.forEach((star) => {
            if (star) {
                anime({
                    targets: star,
                    opacity: [0.3, 1],
                    scale: [0.8, 1.3],
                    direction: 'alternate',
                    loop: true,
                    easing: 'easeInOutSine',
                    duration: anime.random(1500, 3000),
                    delay: anime.random(0, 2000)
                });
            }
        });
        
        // Title entrance
        anime({
            targets: titleRef.current,
            translateY: [20, 0],
            opacity: [0, 1],
            easing: 'easeOutExpo',
            duration: 1500,
            delay: 300
        });
    }, []);

    // Parallax calculations
    const px = (maskPos.x - windowCenter.x) * 0.03;
    const py = (maskPos.y - windowCenter.y) * 0.03;

    return (
        <div 
            ref={containerRef}
            className="relative min-h-screen w-full bg-background-dark overflow-hidden flex flex-col items-center justify-center cursor-crosshair"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* The Hidden Layer (Revealed by mask) */}
            <div 
                className="absolute inset-0 z-10 transition-opacity duration-300"
                style={{
                    WebkitMaskImage: `radial-gradient(circle 280px at ${maskPos.x}px ${maskPos.y}px, black 30%, transparent 80%)`,
                    maskImage: `radial-gradient(circle 280px at ${maskPos.x}px ${maskPos.y}px, black 30%, transparent 80%)`,
                }}
            >
                {/* Background landscape */}
                <div className="absolute inset-0 bg-[#0a0f14]">
                    {/* Parallax Container for Scene Elements */}
                    <div 
                        className="absolute inset-0 transition-transform duration-75 ease-out"
                        style={{ transform: `translate(${-px}px, ${-py}px)` }}
                    >
                        {/* Stars */}
                        <div ref={el => starsRef.current[0] = el} className="absolute top-20 left-40 w-1 h-1 bg-secondary rounded-full shadow-[0_0_8px_#f2b824]"></div>
                        <div ref={el => starsRef.current[1] = el} className="absolute top-32 right-[20%] w-1.5 h-1.5 bg-secondary rounded-full shadow-[0_0_10px_#f2b824]"></div>
                        <div ref={el => starsRef.current[2] = el} className="absolute top-1/4 left-1/3 w-1 h-1 bg-white rounded-full shadow-[0_0_6px_#fff]"></div>
                        <div ref={el => starsRef.current[3] = el} className="absolute top-[15%] right-[40%] w-0.5 h-0.5 bg-white rounded-full"></div>
                        <div ref={el => starsRef.current[4] = el} className="absolute top-[35%] left-[60%] w-1 h-1 bg-white rounded-full shadow-[0_0_4px_#fff]"></div>
                        
                        {/* SVG Desert Scene */}
                        <svg className="absolute bottom-0 w-full h-[60vh] min-h-[300px]" preserveAspectRatio="none" viewBox="0 0 1440 400" xmlns="http://www.w3.org/2000/svg">
                            {/* Background Dune */}
                            <path d="M0 200 Q 300 100 720 250 T 1440 150 L 1440 400 L 0 400 Z" fill="#152332" />
                            {/* Foreground Dune (moves slightly more for parallax) */}
                            <g style={{ transform: `translateX(${-px * 0.5}px)` }}>
                                <path d="M-100 300 Q 400 150 900 350 T 1540 250 L 1540 400 L -100 400 Z" fill="#1b3b5f" />
                            </g>
                            
                            {/* Cactus */}
                            <g transform="translate(1100, 180) scale(0.6)">
                                <rect x="45" y="50" width="10" height="120" rx="5" fill="#4a6d55" />
                                <path d="M45 120 Q 20 120 20 80 L 20 50 L 30 50 L 30 80 Q 30 110 45 110 Z" fill="#4a6d55" />
                                <path d="M55 100 Q 80 100 80 60 L 80 30 L 70 30 L 70 60 Q 70 90 55 90 Z" fill="#4a6d55" />
                            </g>

                            {/* 404 Sign */}
                            <g transform="translate(850, 260) scale(0.8)">
                                <rect x="45" y="50" width="10" height="90" fill="#333333" />
                                <polygon points="10,20 90,20 90,50 10,50" fill="#f2b824" />
                                <text x="50" y="42" fontFamily="system-ui, sans-serif" fontSize="24" fontWeight="900" fill="#13191f" textAnchor="middle">404</text>
                                <polygon points="10,20 10,50 0,35" fill="#f2b824" />
                            </g>

                            {/* Truck (parked) */}
                            <g ref={truckRef} transform="translate(150, 200) scale(0.9)">
                                {/* Truck Body */}
                                <rect x="10" y="40" width="120" height="50" rx="4" fill="#f2b824" />
                                <rect x="130" y="55" width="50" height="35" rx="8" fill="#f2b824" />
                                <polygon points="130,55 130,30 160,30 170,55" fill="#f2b824" />
                                {/* Window */}
                                <polygon points="135,50 135,35 155,35 162,50" fill="#13191f" />
                                {/* Wheels */}
                                <circle cx="40" cy="95" r="15" fill="#13191f" />
                                <circle cx="40" cy="95" r="7" fill="#666" />
                                <circle cx="150" cy="95" r="15" fill="#13191f" />
                                <circle cx="150" cy="95" r="7" fill="#666" />
                                {/* Headlight Source */}
                                <circle cx="180" cy="70" r="4" fill="#ffffff" />
                                <path ref={headlightRef} d="M180 70 L 400 0 L 350 150 Z" fill="url(#headlight-grad)" opacity="0.6" />
                                <defs>
                                    <linearGradient id="headlight-grad" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                                        <stop offset="100%" stopColor="#f2b824" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                            </g>
                        </svg>
                    </div>
                    
                    {/* Revealed Text Content */}
                    <div ref={titleRef} className="absolute top-[20%] w-full text-center px-4" style={{ transform: `translate(${px}px, ${py}px)` }}>
                        <h1 className="text-9xl font-black text-secondary tracking-tighter drop-shadow-2xl mb-4">404</h1>
                        <h2 className="text-3xl font-bold text-white mb-3 tracking-wide">Tujuan Tidak Ditemukan</h2>
                        <p className="text-lg text-white/80 max-w-md mx-auto leading-relaxed">
                            Sepertinya armada kami tersesat di antah berantah. Radar tidak dapat menemukan rute yang Anda tuju.
                        </p>
                    </div>
                </div>
            </div>

            {/* Always Visible UI (Top level z-index) */}
            <div className="relative z-20 flex flex-col items-center justify-center w-full h-full pointer-events-none">
                
                {/* Header Logo overlay */}
                <div className="absolute top-0 left-0 w-full px-6 pt-4 pb-6 flex justify-between items-center">
                     <Link to="/" className="flex items-center gap-3 pointer-events-auto group">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 text-secondary transition-all duration-300 group-hover:bg-secondary/20 group-hover:border-secondary/30">
                            <Icon name="local_shipping" size={28} />
                        </div>
                        <h1 className="text-xl font-bold leading-tight tracking-tight text-white/90 group-hover:text-white transition-colors">
                            PT Mahkota Putra Logistik
                        </h1>
                    </Link>
                </div>

                {/* Hint Text */}
                <div className={`absolute top-[40%] text-white/50 transition-opacity duration-1000 ${isHovering ? 'opacity-0' : 'opacity-100'}`}>
                    <p className="animate-bounce flex items-center gap-2 bg-white/5 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-full shadow-lg">
                        <Icon name="mouse" size={20} /> Gerakkan kursor Anda untuk menjelajah
                    </p>
                </div>

                <div className="mt-[50vh] pointer-events-auto">
                     <Link
                        to="/"
                        className="inline-flex h-14 items-center justify-center rounded-xl bg-white/5 backdrop-blur-md border border-white/10 px-8 text-base font-bold text-white/90 shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all duration-300 hover:bg-secondary/20 hover:border-secondary/50 hover:text-secondary hover:shadow-[0_0_30px_rgba(242,184,36,0.3)] hover:-translate-y-1"
                    >
                        <Icon name="explore" className="mr-2" size={24} />
                        Kembali ke Peradaban
                    </Link>
                </div>
            </div>
            
            {/* Ambient Dark Overlay (The unrevealed part) */}
            <div className="absolute inset-0 bg-[#0d1318] z-0 flex items-center justify-center">
                 <div className="opacity-[0.03] text-white text-[15rem] font-black tracking-tighter mix-blend-overlay">404</div>
            </div>
        </div>
    );
}
