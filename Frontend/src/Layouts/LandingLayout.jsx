import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../Components/Landing/Navbar';
import Footer from '../Components/Landing/Footer';

const LandingLayout = () => {
  return (
    <div className="relative flex flex-col min-h-screen">
      {/* Sentinel used by Navbar's IntersectionObserver to detect scroll past the top (avoids a scroll-listener + setState on every scroll event) */}
      <div id="scroll-sentinel" className="absolute top-0 left-0 h-5 w-px pointer-events-none" aria-hidden="true" />
      <Navbar />
      <main id="main-content" className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default LandingLayout; 