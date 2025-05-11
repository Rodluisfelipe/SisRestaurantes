import React, { createContext, useContext, useState, useEffect } from 'react';

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
  // Check if there's a saved theme preference in localStorage
  const savedTheme = localStorage.getItem('menuby-theme');
  const [theme, setTheme] = useState(savedTheme === 'light' ? 'light' : 'dark');
  
  // Toggle between light and dark mode
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('menuby-theme', newTheme);
  };
  
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
    
    // Save theme preference
    localStorage.setItem('menuby-theme', theme);
  }, [theme]);
  
  // Context value to be provided
  const value = {
    theme,
    colors: themes[theme],
    toggleTheme
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