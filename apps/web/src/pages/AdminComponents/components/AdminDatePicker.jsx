import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/Icon';
import anime from 'animejs';

export default function AdminDatePicker({ value, onChange, placeholder = 'Pilih Tanggal', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Use today's date if value is empty/invalid
  const initialDate = value && !isNaN(new Date(value).getTime()) ? new Date(value) : new Date();
  const [currentMonth, setCurrentMonth] = useState(initialDate);
  
  const popoverRef = useRef(null);
  const containerRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

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
        // Check if there is enough space below, if not, open upwards
        const spaceBelow = window.innerHeight - rect.bottom;
        const popoverHeight = 320; // approximate height of the calendar
        let top = rect.bottom + 8;
        
        if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
          top = rect.top - popoverHeight - 8;
        }

        setCoords({
          top,
          left: rect.left,
        });
      }
    };
    
    updatePosition(); // Initial position
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

  // Animation
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      anime({
        targets: popoverRef.current,
        translateY: [-10, 0],
        opacity: [0, 1],
        easing: 'easeOutExpo',
        duration: 300,
      });
    }
  }, [isOpen]);

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e) => {
    e.preventDefault();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateSelect = (day) => {
    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const yyyy = selected.getFullYear();
    const mm = String(selected.getMonth() + 1).padStart(2, '0');
    const dd = String(selected.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);
  
  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    days.push(i);
  }

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
        className="flex items-center justify-between w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus-within:ring-2 focus-within:ring-dash-secondary/20 focus-within:border-dash-secondary bg-gray-50 hover:bg-white transition-all cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <input
          type="text"
          readOnly
          placeholder={placeholder}
          value={formatDisplay(value)}
          className="w-full bg-transparent outline-none cursor-pointer text-gray-700"
        />
        <Icon name="calendar_today" size={18} className="text-gray-400" />
      </div>

      {isOpen && createPortal(
        <div 
          ref={popoverRef}
          className="fixed z-[9999] p-4 bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl shadow-2xl w-[280px]"
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="flex justify-between items-center mb-4">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            >
              <Icon name="chevron_left" size={20} />
            </button>
            <span className="font-black text-dash-primary text-[15px]">
              {monthNames[month]} {year}
            </span>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            >
              <Icon name="chevron_right" size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'].map(day => (
              <span key={day} className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{day}</span>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (!day) return <div key={idx} className="aspect-square"></div>;
              
              const isSelected = value && new Date(value).getDate() === day && 
                                new Date(value).getMonth() === month && 
                                new Date(value).getFullYear() === year;
              
              const isToday = new Date().getDate() === day && 
                              new Date().getMonth() === new Date().getMonth() && 
                              new Date().getFullYear() === new Date().getFullYear();

              const isSunday = (startDay + day - 1) % 7 === 0;

              return (
                <button
                  key={idx}
                  onClick={(e) => { e.preventDefault(); handleDateSelect(day); }}
                  className={`aspect-square w-full rounded-full flex items-center justify-center text-[13px] font-bold transition-all ${
                    isSelected 
                      ? (isSunday ? 'bg-red-500 text-white shadow-md transform scale-110' : 'bg-dash-primary text-white shadow-md transform scale-110')
                      : isToday 
                        ? (isSunday ? 'bg-red-50 text-red-500' : 'bg-dash-secondary/20 text-dash-primary')
                        : (isSunday ? 'text-red-500 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-100 hover:text-dash-primary')
                  }`}
                >
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
