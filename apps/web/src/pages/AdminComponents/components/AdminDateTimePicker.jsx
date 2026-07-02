import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/Icon';
import anime from 'animejs';

export default function AdminDateTimePicker({ value, onChange, placeholder = 'Pilih Tanggal & Waktu', className = '', disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse initial value or use current date/time
  const parseDate = (val) => {
    if (!val) return new Date();
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const initialDate = parseDate(value);
  const [currentMonth, setCurrentMonth] = useState(initialDate);
  const [selectedHour, setSelectedHour] = useState(String(initialDate.getHours()).padStart(2, '0'));
  const [selectedMinute, setSelectedMinute] = useState(String(initialDate.getMinutes()).padStart(2, '0'));
  
  const popoverRef = useRef(null);
  const containerRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // Sync internal state if value changes from outside
  useEffect(() => {
    if (value) {
      const parsed = parseDate(value);
      setCurrentMonth(parsed);
      setSelectedHour(String(parsed.getHours()).padStart(2, '0'));
      setSelectedMinute(String(parsed.getMinutes()).padStart(2, '0'));
    }
  }, [value]);

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
        // Popover height is now slightly larger to accommodate time dropdowns
        const spaceBelow = window.innerHeight - rect.bottom;
        const popoverHeight = 380; 
        let top = rect.bottom + 8;
        
        if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
          top = rect.top - popoverHeight - 8;
        }

        let left = rect.left;
        const popoverWidth = 280;
        if (left + popoverWidth > window.innerWidth - 16) {
          left = rect.right - popoverWidth;
        }

        setCoords({
          top,
          left,
        });
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

  const updateValue = (day, hour, minute) => {
    const yyyy = currentMonth.getFullYear();
    const mm = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    // Format: YYYY-MM-DDTHH:mm
    onChange(`${yyyy}-${mm}-${dd}T${hour}:${minute}`);
  };

  const handleDateSelect = (day) => {
    updateValue(day, selectedHour, selectedMinute);
  };

  const handleHourChange = (e) => {
    const h = e.target.value;
    setSelectedHour(h);
    if (value) {
      const parsed = parseDate(value);
      updateValue(parsed.getDate(), h, selectedMinute);
    }
  };

  const handleMinuteChange = (e) => {
    const m = e.target.value;
    setSelectedMinute(m);
    if (value) {
      const parsed = parseDate(value);
      updateValue(parsed.getDate(), selectedHour, m);
    }
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
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}, ${hh}:${min}`;
  };

  const hoursOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutesOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className={`flex items-center justify-between w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm transition-all ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-gray-50 hover:bg-white focus-within:ring-2 focus-within:ring-[#fec330]/20 focus-within:border-[#fec330] cursor-pointer'}`}
        onClick={() => { if (!disabled) setIsOpen(!isOpen) }}
      >
        <input
          type="text"
          readOnly
          disabled={disabled}
          placeholder={placeholder}
          value={formatDisplay(value)}
          className={`w-full bg-transparent outline-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} text-gray-700`}
        />
        <Icon name="schedule" size={18} className={disabled ? "text-gray-300" : "text-gray-400"} />
      </div>

      {isOpen && !disabled && createPortal(
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
          
          <div className="grid grid-cols-7 gap-1 mb-4">
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

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Icon name="schedule" size={16} className="text-gray-400" />
              <div className="flex items-center gap-1 flex-1">
                <select 
                  value={selectedHour}
                  onChange={handleHourChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-dash-primary focus:outline-none focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330]"
                >
                  {hoursOptions.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-gray-400 font-bold">:</span>
                <select 
                  value={selectedMinute}
                  onChange={handleMinuteChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-dash-primary focus:outline-none focus:ring-2 focus:ring-[#fec330]/20 focus:border-[#fec330]"
                >
                  {minutesOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 bg-[#fec330] hover:bg-[#eab308] text-[#002442] text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              Tutup
            </button>
          </div>

        </div>,
        document.body
      )}
    </div>
  );
}
