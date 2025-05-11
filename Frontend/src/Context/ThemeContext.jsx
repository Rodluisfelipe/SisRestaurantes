import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Define theme color schemes
export const themes = {
  dark: {
    mainBackground: '#051C2C', // Dark blue
    primaryButton: '#3A7AFF', // Electric blue (kept same for consistency)
    textPrimary: '#FFFFFF', // White 
    textSecondary: '#D1D9FF', // Light gray
    secondarySections: '#A5B9FF', // Pale blue
    secondaryButton: '#5FF9B4', // Mint green (kept same for consistency)
    panels: '#333F50', // Dark gray
    footer: '#333F50', // Dark gray for footer
  },
  light: {
    mainBackground: '#F4F7FB', // Gris azulado muy claro
    primaryButton: '#3A7AFF', // Azul eléctrico suave (same as dark mode for consistency)
    textPrimary: '#1F2937', // Gris oscuro azulado
    textSecondary: '#6C7A92', // Gris medio claro
    secondarySections: '#FFFFFF', // Blanco puro
    secondaryButton: '#5FF9B4', // Verde menta claro (same as dark mode for consistency)
    panels: '#FFFFFF', // White for panels in light mode
    footer: '#E5EAF5', // Azul grisáceo claro
    borders: '#DCE4F5', // Azul grisáceo tenue (for borders)
  }
};

// Create the context
const ThemeContext = createContext();

// Create a provider component
export function ThemeProvider({ children }) {
  const location = useLocation();
  // Check if the current path is for admin panel
  const isAdminPanel = location?.pathname?.includes('/admin');
  
  // Use light theme by default for admin panel, otherwise use saved theme or dark
  const savedTheme = localStorage.getItem('menuby-theme');
  const [theme, setTheme] = useState(
    isAdminPanel ? 'light' : (savedTheme === 'light' ? 'light' : 'dark')
  );
  
  // Toggle between light and dark mode
  const toggleTheme = () => {
    // If in admin panel, don't allow toggling
    if (isAdminPanel) return;
    
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('menuby-theme', newTheme);
  };
  
  // Update theme when path changes (to force light theme in admin)
  useEffect(() => {
    if (isAdminPanel && theme !== 'light') {
      setTheme('light');
    } else if (!isAdminPanel && savedTheme) {
      setTheme(savedTheme === 'light' ? 'light' : 'dark');
    }
  }, [location, isAdminPanel]);
  
  // Add/remove theme-specific classes to the body
  useEffect(() => {
    const bodyClasses = document.body.classList;
    
    if (theme === 'dark') {
      bodyClasses.add('dark-theme');
      bodyClasses.remove('light-theme');
    } else {
      bodyClasses.add('light-theme');
      bodyClasses.remove('dark-theme');
    }
    
    // Save theme preference (but only if not in admin panel)
    if (!isAdminPanel) {
      localStorage.setItem('menuby-theme', theme);
    }
  }, [theme, isAdminPanel]);
  
  // Context value to be provided
  const value = {
    theme,
    colors: themes[theme],
    toggleTheme,
    isAdminPanel
  };
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook to use the theme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 