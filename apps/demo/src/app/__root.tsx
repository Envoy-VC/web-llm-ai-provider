import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import * as React from 'react';

import '../styles/globals.css';

const RootComponent = () => {
  return (
    <>
      <Outlet />
      <TanStackRouterDevtools position='bottom-right' />
    </>
  );
};

export const Route = createRootRoute({
  component: RootComponent,
});
