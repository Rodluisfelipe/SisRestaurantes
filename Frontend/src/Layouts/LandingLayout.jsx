import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../Components/Landing/Navbar';
import Footer from '../Components/Landing/Footer';

const LandingLayout = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default LandingLayout; 