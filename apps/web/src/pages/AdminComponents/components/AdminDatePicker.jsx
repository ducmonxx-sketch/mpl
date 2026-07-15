import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/Icon';
import anime from 'animejs';

export default function AdminDatePicker({ value, onChange, placeholder = 'Pilih Tanggal', className = '', minDate }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Use today's date if value is empty/invalid
  const initialDate = value && !isNaN(new Date(value).getTime()) ? new Date(value) : new Date();
  const [currentMonth, setCurrentMonth] = useState(initialDate);
  const [animDirection, setAnimDirection] = useState(1); // 1 for next, -1 for prev
  
  const popoverRef = useRef(null);
  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // Convert minDate to a normalized Date object (00:00:00) if provided
  const minDateObj = minDate ? new Date(new Date(minDate).setHours(0,0,0,0)) : null;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        popoverRef.current && !popoverRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const popoverHeight = 320; 
        let top = rect.bottom + 8;
        
        if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
          top = rect.top - popoverHeight - 8;
        }

        let left = rect.left;
        const isMobile = window.innerWidth < 640;
        const popoverWidth = 300;
        
        if (isMobile) {
          left = (window.innerWidth - popoverWidth) / 2;
        } else if (left + popoverWidth > window.innerWidth - 16) {
          left = Math.max(16, rect.right - popoverWidth);
        }

        setCoords({ top, left });
      }
    };
    
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // Update currentMonth if value changes from outside
  useEffect(() => {
    if (value && !isNaN(new Date(value).getTime())) {
      setCurrentMonth(new Date(value));
    }
  }, [value]);

  // Open Animation
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      anime({
        targets: popoverRef.current,
        translateY: [-10, 0],
        opacity: [0, 1],
        easing: 'easeOutExpo',
        duration: 400,
      });
    }
  }, [isOpen]);

  // Month Change Animation
  useEffect(() => {
    if (isOpen && gridRef.current) {
      anime({
        targets: gridRef.current,
        translateX: [20 * animDirection, 0],
        opacity: [0, 1],
        easing: 'easeOutQuint',
        duration: 350,
      });
    }
  }, [currentMonth, animDirection, isOpen]);

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e) => {
    e.preventDefault();
    setAnimDirection(-1);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    setAnimDirection(1);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateSelect = (e, day) => {
    e.preventDefault();
    // Bounce animation on select before closing
    anime({
      targets: e.currentTarget,
      scale: [1, 0.8, 1],
      duration: 300,
      easing: 'easeOutBack',
      complete: () => {
        const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const yyyy = selected.getFullYear();
        const mm = String(selected.getMonth() + 1).padStart(2, '0');
        const dd = String(selected.getDate()).padStart(2, '0');
        onChange(`${yyyy}-${mm}-${dd}`);
        setIsOpen(false);
      }
    });
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);
  
  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const formatDisplay = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className="flex items-center justify-between w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus-within:ring-2 focus-within:ring-[#fec330]/20 focus-within:border-[#fec330] bg-gray-50 hover:bg-white transition-all cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <input
          type="text"
          readOnly
          placeholder={placeholder}
          value={formatDisplay(value)}
          className="w-full bg-transparent outline-none cursor-pointer text-gray-900 font-medium"
        />
        <Icon name="calendar_today" size={18} className="text-gray-400" />
      </div>

      {isOpen && createPortal(
        <div 
          ref={popoverRef}
          className="fixed z-[9999] p-5 bg-white border border-gray-200 rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.1)] w-[300px]"
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="flex justify-between items-center mb-5">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-800 transition-colors"
            >
              <Icon name="chevron_left" size={20} />
            </button>
            <span className="font-bold text-gray-900 text-[15px] tracking-tight">
              {monthNames[month]} {year}
            </span>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-800 transition-colors"
            >
              <Icon name="chevron_right" size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-3">
            {['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'].map(day => (
              <span key={day} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{day}</span>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1" ref={gridRef}>
            {days.map((day, idx) => {
              if (!day) return <div key={idx} className="aspect-square"></div>;
              
              const currentDateObj = new Date(year, month, day);
              const isDisabled = minDateObj && currentDateObj < minDateObj;

              const isSelected = value && new Date(value).getDate() === day && 
                                new Date(value).getMonth() === month && 
                                new Date(value).getFullYear() === year;
              
              const isToday = new Date().getDate() === day && 
                              new Date().getMonth() === month && 
                              new Date().getFullYear() === year;

              const isSunday = (startDay + day - 1) % 7 === 0;

              return (
                <button
                  key={idx}
                  disabled={isDisabled}
                  onClick={(e) => !isDisabled && handleDateSelect(e, day)}
                  className={`relative aspect-square w-full rounded-full flex items-center justify-center text-[13px] font-semibold transition-all duration-200 group ${
                    isDisabled
                      ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                      : isSelected 
                        ? 'bg-[#1b3b5f] text-white shadow-md'
                        : isToday 
                          ? 'text-[#1b3b5f] bg-blue-50/50'
                          : isSunday 
                            ? 'text-red-500 hover:bg-red-50 cursor-pointer' 
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer'
                  }`}
                >
                  {isToday && !isSelected && !isDisabled && (
                    <span className="absolute inset-0 rounded-full border border-dashed border-[#1b3b5f]/40"></span>
                  )}
                  {day}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
