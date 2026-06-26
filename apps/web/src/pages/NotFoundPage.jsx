import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';

export default function NotFoundPage() {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setMousePos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                });
            }
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Set an initial position in the center so it doesn't look broken before mouse moves
    useEffect(() => {
         if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setMousePos({
                    x: rect.width / 2,
                    y: rect.height / 2,
                });
            }
    }, []);

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
                    WebkitMaskImage: `radial-gradient(circle 250px at ${mousePos.x}px ${mousePos.y}px, black 30%, transparent 80%)`,
                    maskImage: `radial-gradient(circle 250px at ${mousePos.x}px ${mousePos.y}px, black 30%, transparent 80%)`,
                }}
            >
                {/* Background landscape */}
                <div className="absolute inset-0 bg-[#0a0f14]">
                    {/* Stars */}
                    <div className="absolute top-20 left-40 w-1 h-1 bg-secondary rounded-full shadow-[0_0_8px_#f2b824]"></div>
                    <div className="absolute top-32 right-[20%] w-1.5 h-1.5 bg-secondary rounded-full shadow-[0_0_10px_#f2b824]"></div>
                    <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-white rounded-full shadow-[0_0_6px_#fff]"></div>
                    <div className="absolute top-[15%] right-[40%] w-0.5 h-0.5 bg-white rounded-full"></div>
                    
                    {/* SVG Desert Scene */}
                    <svg className="absolute bottom-0 w-full h-[60vh] min-h-[300px]" preserveAspectRatio="none" viewBox="0 0 1440 400" xmlns="http://www.w3.org/2000/svg">
                        {/* Background Dune */}
                        <path d="M0 200 Q 300 100 720 250 T 1440 150 L 1440 400 L 0 400 Z" fill="#152332" />
                        {/* Foreground Dune */}
                        <path d="M0 300 Q 400 150 900 350 T 1440 250 L 1440 400 L 0 400 Z" fill="#1b3b5f" />
                        
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
                        <g transform="translate(150, 200) scale(0.9)">
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
                            <path d="M180 70 L 300 30 L 300 110 Z" fill="url(#headlight-grad)" opacity="0.6" />
                            <defs>
                                <linearGradient id="headlight-grad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="#f2b824" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </g>
                    </svg>
                    
                    {/* Revealed Text Content */}
                    <div className="absolute top-[20%] w-full text-center px-4">
                        <h1 className="text-9xl font-black text-secondary tracking-tighter drop-shadow-xl mb-4">404</h1>
                        <h2 className="text-3xl font-bold text-white mb-3">Tujuan Tidak Ditemukan</h2>
                        <p className="text-lg text-white/80 max-w-md mx-auto leading-relaxed">
                            Sepertinya armada kami tersesat di antah berantah. Radar tidak dapat menemukan rute yang Anda tuju.
                        </p>
                    </div>
                </div>
            </div>

            {/* Always Visible UI (Top level z-index) */}
            <div className="relative z-20 flex flex-col items-center justify-center w-full h-full pointer-events-none">
                
                {/* Header Logo overlay */}
                <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center">
                     <Link to="/" className="flex items-center gap-3 pointer-events-auto group">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary transition-colors group-hover:bg-secondary/20">
                            <Icon name="local_shipping" size={28} />
                        </div>
                        <h1 className="text-xl font-bold leading-tight tracking-tight text-white">
                            PT Mahkota Putra Logistik
                        </h1>
                    </Link>
                </div>

                {/* Hint Text */}
                <div className={`absolute top-[40%] text-white/50 transition-opacity duration-1000 ${isHovering ? 'opacity-0' : 'opacity-100'}`}>
                    <p className="animate-bounce flex items-center gap-2 bg-background-dark/50 px-4 py-2 rounded-full backdrop-blur-sm">
                        <Icon name="mouse" size={20} /> Gerakkan kursor Anda untuk menjelajah
                    </p>
                </div>

                <div className="mt-[50vh] pointer-events-auto">
                     <Link
                        to="/"
                        className="inline-flex h-14 items-center justify-center rounded-xl bg-background-dark/50 backdrop-blur-sm border-2 border-secondary px-8 text-base font-bold text-secondary shadow-[0_0_15px_rgba(242,184,36,0.3)] transition-all hover:bg-secondary hover:text-primary hover:scale-105 hover:shadow-[0_0_30px_rgba(242,184,36,0.8)]"
                    >
                        <Icon name="explore" className="mr-2" size={24} />
                        Kembali ke Peradaban
                    </Link>
                </div>
            </div>
            
            {/* Ambient Dark Overlay (The unrevealed part) */}
            <div className="absolute inset-0 bg-[#0d1318] z-0 flex items-center justify-center">
                 <div className="opacity-10 text-white/20 text-9xl font-black">404</div>
            </div>
        </div>
    );
}
