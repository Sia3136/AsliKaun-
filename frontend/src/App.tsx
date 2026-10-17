import React, { useState, useEffect } from 'react';
import { BackgroundVideo } from './components/BackgroundVideo';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Marquee } from './components/Marquee';
import { TheProblem } from './components/TheProblem';
import { TheApproach } from './components/TheApproach';
import { ArchitectureStack } from './components/ArchitectureStack';
import { CallToAction } from './components/CallToAction';
import { Footer } from './components/Footer';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tm_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tm_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <>
      <BackgroundVideo theme={theme} />
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      <main id="top">
        <Hero />
        <Marquee />
        <TheProblem />
        <TheApproach />
        <ArchitectureStack />
        <CallToAction />
      </main>

      <Footer />
    </>
  );
}
