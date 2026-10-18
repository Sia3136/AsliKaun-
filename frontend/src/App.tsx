import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Marquee } from './components/Marquee';
import { TheProblem } from './components/TheProblem';
import { ScrollWordReveal } from './components/ScrollWordReveal';
import { TheApproach } from './components/TheApproach';
import { ArchitectureStack } from './components/ArchitectureStack';
import { CallToAction } from './components/CallToAction';
import { Footer } from './components/Footer';
import { AuthPage } from './components/AuthPage';

export default function App() {
  const isAuthPage = window.location.pathname.replace(/\/$/, '') === '/auth';
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tm_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tm_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  if (isAuthPage) {
    return <AuthPage initialMode={new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'login'} />;
  }

  return (
    <>
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      <main id="top">
        <Hero />
        <Marquee />
        <ScrollWordReveal />
        <TheProblem />
        <TheApproach />
        <ArchitectureStack />
        <CallToAction />
      </main>

      <Footer />
    </>
  );
}
