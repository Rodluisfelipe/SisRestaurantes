import React from 'react';
import { Outlet } from 'react-router-dom';
import CatalogNavbar from '../Components/Catalog/CatalogNavbar';

const CatalogLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <CatalogNavbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default CatalogLayout;
