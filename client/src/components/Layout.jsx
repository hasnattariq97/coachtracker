import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ role }) => (
  <div className="flex min-h-dvh bg-primary-50">
    <Sidebar role={role} />
    <div className="flex flex-col flex-1 min-w-0 md:ml-[240px]">
      <Header />
      <main className="flex-1 px-4 md:px-8 pt-6 pb-16 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  </div>
);

export default Layout;
