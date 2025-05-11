import React from 'react';
import { Route, Routes } from 'react-router-dom';
import LandingLayout from './Layouts/LandingLayout';
import Home from './Pages/Landing/Home';
import Login from './Pages/Landing/Login';
import Register from './Pages/Landing/Register';
import Features from './Pages/Landing/Features';
import Contact from './Pages/Landing/Contact';

const LandingRoutes = () => {
  return (
    <Routes>
      <Route element={<LandingLayout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="features" element={<Features />} />
        <Route path="contact" element={<Contact />} />
      </Route>
    </Routes>
  );
};

export default LandingRoutes; 