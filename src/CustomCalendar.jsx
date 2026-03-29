import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './CustomCalendar.css';

const CustomCalendar = ({ 
  selectedDate, // YYYY-MM-DD formatında (string)
  onSelectDate, // Seçeceğimiz fonksiyon
  callHistoryDates, // Set veya Array: "29.03.2026" (yerel formatlı stringler)
  onClose
}) => {
  const containerRef = useRef(null);
  
  // Dışarı tıklama kontrolü
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Şu anki gösterilen ay/yıl (varsayılan: selectedDate varsa o, yoksa mevcut ay)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDateClick = (dateObj) => {
    // YYYY-MM-DD formatına çevir, saat dilimi sapmasını (timezone offset) engelle
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    onSelectDate(`${year}-${month}-${day}`);
    onClose();
  };

  // Takvim günlerini hesapla
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Ayın ilk gününün haftanın hangi günü olduğu (0: Pazar, 1: Pazartesi)
    const firstDay = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    
    // Pazartesiyi başlangıç yapmak için kaydırma
    const offset = firstDay === 0 ? 6 : firstDay - 1; 
    
    const days = [];
    // Boşluklar (önceki ayın günleri boş kalır veya soluk görünür)
    for (let i = 0; i < offset; i++) {
        days.push(null);
    }
    
    for (let i = 1; i <= daysInCurrentMonth; i++) {
        days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const daysResult = getDaysInMonth();
  const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  // Bugün kontrolü
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() +1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  return (
    <div className="custom-calendar-popup" ref={containerRef}>
      <div className="cc-header">
        <button className="cc-nav-btn" onClick={handlePrevMonth}><ChevronLeft size={18} /></button>
        <div className="cc-title">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </div>
        <button className="cc-nav-btn" onClick={handleNextMonth}><ChevronRight size={18} /></button>
      </div>
      
      <div className="cc-weekdays">
        {weekDays.map(w => <div key={w} className="cc-weekday">{w}</div>)}
      </div>

      <div className="cc-days-grid">
        {daysResult.map((dateObj, index) => {
          if (!dateObj) return <div key={`empty-${index}`} className="cc-day empty"></div>;

          // Seçili mi? (YYYY-MM-DD olarak eşleşmesi lazım)
          const y = dateObj.getFullYear();
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const d = String(dateObj.getDate()).padStart(2, '0');
          const dateString = `${y}-${m}-${d}`;
          const isSelected = selectedDate === dateString;
          const isToday = todayStr === dateString;

          // Çağrı (Kayıt) var mı? 
          // App.jsx içindeki format: toLocaleDateString('tr-TR')
          const localizedDateStr = dateObj.toLocaleDateString('tr-TR');
          const hasCall = callHistoryDates.has(localizedDateStr);

          // Dinamik Sınıflar
          let baseClass = "cc-day active";
          if (isSelected) baseClass += " selected";
          if (isToday) baseClass += " today";
          if (hasCall) baseClass += " has-call";

          return (
            <div 
              key={dateString} 
              className={baseClass} 
              onClick={() => handleDateClick(dateObj)}
            >
              <span>{dateObj.getDate()}</span>
              {hasCall && <div className="cc-call-dot"></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CustomCalendar;
