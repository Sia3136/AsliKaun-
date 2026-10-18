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
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const pathname = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
  const hash = typeof window !== 'undefined' ? window.location.hash : '';

  const isAuthPage =
    pathname === '/auth' ||
    pathname.endsWith('/auth') ||
    searchParams.has('mode') ||
    searchParams.has('auth_token') ||
    searchParams.has('expired') ||
    hash === '#signup' ||
    hash === '#login' ||
    hash === '#auth';

  const initialMode: 'login' | 'signup' =
    searchParams.get('mode') === 'signup' || hash === '#signup' ? 'signup' : 'login';

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
    return <AuthPage initialMode={initialMode} />;
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
