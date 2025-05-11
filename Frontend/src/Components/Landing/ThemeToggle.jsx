import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../Context/ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme, isAdminPanel } = useTheme();
  
  // No renderizar el botón en el panel de administración
  if (isAdminPanel) {
    return null;
  }
  
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={toggleTheme}
      className={`p-2 rounded-full transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-[#333F50]/70 hover:bg-[#333F50]' 
          : 'bg-white/70 hover:bg-white shadow-sm border border-[#DCE4F5]'
      }`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        // Sun icon for dark mode (to switch to light)
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 text-[#5FF9B4]" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" 
          />
        </svg>
      ) : (
        // Moon icon for light mode (to switch to dark)
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 text-[#3A7AFF]" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" 
          />
        </svg>
      )}
    </motion.button>
  );
};

export default ThemeToggle; 