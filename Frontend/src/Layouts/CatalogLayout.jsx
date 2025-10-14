import React from 'react';
import { Outlet } from 'react-router-dom';

const CatalogLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default CatalogLayout;
